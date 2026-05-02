use aip_domain::{
    AirportInfoSummary, AirportWeatherOverviewResponse, MetarObservation, NoaaCycleMetar,
    NoaaWeatherSupplement, StationInfoSummary, TafForecastSegment, TafReport, WeatherCloudLayer,
    WeatherTextBulletin,
};
use chrono::{Duration, Timelike, Utc};
use futures_util::future::join_all;
use reqwest::{Client, StatusCode, Url};
use serde_json::Value;
use std::{env, fmt, time::Duration as StdDuration};

const DEFAULT_AWC_BASE_URL: &str = "https://aviationweather.gov/api/data";
const DEFAULT_NOAA_BASE_URL: &str = "https://tgftp.nws.noaa.gov/data/observations/metar";

#[derive(Debug)]
pub enum WeatherError {
    InvalidInput(String),
    NotFound(String),
    Upstream(String),
}

impl fmt::Display for WeatherError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidInput(message) | Self::NotFound(message) | Self::Upstream(message) => {
                formatter.write_str(message)
            }
        }
    }
}

impl std::error::Error for WeatherError {}

#[derive(Clone)]
pub struct WeatherService {
    client: Client,
    awc_base_url: String,
    noaa_base_url: String,
}

impl WeatherService {
    pub fn from_env() -> Result<Self, WeatherError> {
        let awc_base_url =
            env::var("AIP_AWC_BASE_URL").unwrap_or_else(|_| DEFAULT_AWC_BASE_URL.to_string());
        let noaa_base_url =
            env::var("AIP_NOAA_BASE_URL").unwrap_or_else(|_| DEFAULT_NOAA_BASE_URL.to_string());

        Self::new(awc_base_url, noaa_base_url)
    }

    pub fn new(
        awc_base_url: impl Into<String>,
        noaa_base_url: impl Into<String>,
    ) -> Result<Self, WeatherError> {
        let client = Client::builder()
            .user_agent("AIP-On-Hand/0.1 weather-service")
            .timeout(StdDuration::from_secs(15))
            .build()
            .map_err(|error| {
                WeatherError::Upstream(format!("failed to build HTTP client: {error}"))
            })?;

        Ok(Self {
            client,
            awc_base_url: awc_base_url.into(),
            noaa_base_url: noaa_base_url.into(),
        })
    }

    pub async fn airport_overview(
        &self,
        station_id: &str,
        history_hours: usize,
    ) -> Result<AirportWeatherOverviewResponse, WeatherError> {
        let requested_id = normalize_station_id(station_id);
        if requested_id.is_empty() {
            return Err(WeatherError::InvalidInput(
                "station id must not be blank".to_string(),
            ));
        }

        let history_hours = history_hours.min(24);
        let noaa_station_path = format!("stations/{requested_id}.TXT");
        let noaa_decoded_path = format!("decoded/{requested_id}.TXT");
        let (
            airport_payload,
            station_payload,
            metar_payload,
            taf_payload,
            noaa_current_raw,
            noaa_current_decoded,
        ) = tokio::try_join!(
            self.fetch_awc_array("airport", &requested_id),
            self.fetch_awc_array("stationinfo", &requested_id),
            self.fetch_awc_array("metar", &requested_id),
            self.fetch_awc_array("taf", &requested_id),
            self.fetch_noaa_text(&noaa_station_path),
            self.fetch_noaa_text(&noaa_decoded_path),
        )?;

        let airport = airport_payload.first().map(map_airport_info);
        let station = station_payload.first().map(map_station_info);
        let metar = metar_payload.first().map(map_metar);
        let taf = taf_payload.first().map(map_taf);
        let recent_cycles = if history_hours > 0 {
            self.fetch_recent_cycles(&requested_id, history_hours)
                .await?
        } else {
            Vec::new()
        };

        if airport.is_none()
            && station.is_none()
            && metar.is_none()
            && taf.is_none()
            && noaa_current_raw.is_none()
            && noaa_current_decoded.is_none()
            && recent_cycles.is_empty()
        {
            return Err(WeatherError::NotFound(format!(
                "no airport or weather data was found for `{requested_id}`"
            )));
        }

        let resolved_id = airport
            .as_ref()
            .and_then(|item| item.icao_id.clone())
            .or_else(|| station.as_ref().and_then(|item| item.icao_id.clone()))
            .or_else(|| metar.as_ref().map(|item| item.icao_id.clone()))
            .or_else(|| taf.as_ref().map(|item| item.icao_id.clone()))
            .unwrap_or_else(|| requested_id.clone());

        let mut warnings = Vec::new();
        if history_hours > 0 && recent_cycles.len() < history_hours {
            warnings.push(format!(
                "NOAA cycle history returned {} entries out of the requested {} hours.",
                recent_cycles.len(),
                history_hours
            ));
        }
        if metar.is_none() {
            warnings
                .push("AWC METAR payload is currently unavailable for this station.".to_string());
        }
        if taf.is_none() {
            warnings.push("AWC TAF payload is currently unavailable for this station.".to_string());
        }

        Ok(AirportWeatherOverviewResponse {
            requested_id,
            resolved_id,
            airport,
            station,
            metar,
            taf,
            communications: Vec::new(),
            noaa: NoaaWeatherSupplement {
                current_raw: noaa_current_raw,
                current_decoded: noaa_current_decoded,
                recent_cycles,
            },
            warnings,
        })
    }

    async fn fetch_awc_array(
        &self,
        endpoint: &str,
        station_id: &str,
    ) -> Result<Vec<Value>, WeatherError> {
        let url = build_awc_url(&self.awc_base_url, endpoint, station_id)?;
        let response = self.client.get(url.clone()).send().await.map_err(|error| {
            WeatherError::Upstream(format!("AWC request failed for {url}: {error}"))
        })?;

        if response.status() == StatusCode::NOT_FOUND || response.status() == StatusCode::NO_CONTENT
        {
            return Ok(Vec::new());
        }

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(WeatherError::Upstream(format!(
                "AWC request returned {status} for {url}: {body}"
            )));
        }

        response.json::<Vec<Value>>().await.map_err(|error| {
            WeatherError::Upstream(format!("failed to decode AWC JSON from {url}: {error}"))
        })
    }

    async fn fetch_noaa_text(
        &self,
        relative_path: &str,
    ) -> Result<Option<WeatherTextBulletin>, WeatherError> {
        let url = build_noaa_url(&self.noaa_base_url, relative_path)?;
        let response = self.client.get(url.clone()).send().await.map_err(|error| {
            WeatherError::Upstream(format!("NOAA request failed for {url}: {error}"))
        })?;

        if response.status() == StatusCode::NOT_FOUND || response.status() == StatusCode::NO_CONTENT
        {
            return Ok(None);
        }

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(WeatherError::Upstream(format!(
                "NOAA request returned {status} for {url}: {body}"
            )));
        }

        let text = response.text().await.map_err(|error| {
            WeatherError::Upstream(format!("failed to read NOAA text from {url}: {error}"))
        })?;

        Ok(parse_noaa_bulletin(&text))
    }

    async fn fetch_recent_cycles(
        &self,
        station_id: &str,
        history_hours: usize,
    ) -> Result<Vec<NoaaCycleMetar>, WeatherError> {
        let cycle_labels = recent_cycle_labels(history_hours);
        let requests = cycle_labels.iter().map(|label| {
            let label = label.clone();
            async move { self.fetch_cycle_entry(station_id, &label).await }
        });

        let mut entries = join_all(requests)
            .await
            .into_iter()
            .collect::<Result<Vec<_>, _>>()?
            .into_iter()
            .flatten()
            .collect::<Vec<_>>();

        entries.sort_by(|left, right| right.cycle_label.cmp(&left.cycle_label));
        Ok(entries)
    }

    async fn fetch_cycle_entry(
        &self,
        station_id: &str,
        cycle_label: &str,
    ) -> Result<Option<NoaaCycleMetar>, WeatherError> {
        let url = build_noaa_url(&self.noaa_base_url, &format!("cycles/{cycle_label}.TXT"))?;
        let response = self.client.get(url.clone()).send().await.map_err(|error| {
            WeatherError::Upstream(format!("NOAA cycle request failed for {url}: {error}"))
        })?;

        if response.status() == StatusCode::NOT_FOUND || response.status() == StatusCode::NO_CONTENT
        {
            return Ok(None);
        }

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(WeatherError::Upstream(format!(
                "NOAA cycle request returned {status} for {url}: {body}"
            )));
        }

        let text = response.text().await.map_err(|error| {
            WeatherError::Upstream(format!(
                "failed to read NOAA cycle text from {url}: {error}"
            ))
        })?;

        Ok(extract_cycle_metar(station_id, cycle_label, &text))
    }
}

fn normalize_station_id(station_id: &str) -> String {
    station_id.trim().to_uppercase()
}

fn build_awc_url(base_url: &str, endpoint: &str, station_id: &str) -> Result<Url, WeatherError> {
    let mut url = Url::parse(&format!("{}/{}", base_url.trim_end_matches('/'), endpoint))
        .map_err(|error| WeatherError::Upstream(format!("invalid AWC base url: {error}")))?;
    url.query_pairs_mut()
        .append_pair("ids", station_id)
        .append_pair("format", "json");
    Ok(url)
}

fn build_noaa_url(base_url: &str, relative_path: &str) -> Result<Url, WeatherError> {
    Url::parse(&format!(
        "{}/{}",
        base_url.trim_end_matches('/'),
        relative_path.trim_start_matches('/')
    ))
    .map_err(|error| WeatherError::Upstream(format!("invalid NOAA base url: {error}")))
}

fn map_airport_info(value: &Value) -> AirportInfoSummary {
    AirportInfoSummary {
        icao_id: string_field(value, "icaoId"),
        iata_id: string_field(value, "iataId"),
        faa_id: string_field(value, "faaId"),
        name: string_field(value, "name").unwrap_or_else(|| "Unknown airport".to_string()),
        state: string_field(value, "state"),
        country: string_field(value, "country"),
        source: string_field(value, "source"),
        airport_type: string_field(value, "type"),
        latitude: f64_field(value, "lat"),
        longitude: f64_field(value, "lon"),
        elevation_ft: f64_field(value, "elev"),
        magnetic_declination: string_field(value, "magdec"),
        owner: string_field(value, "owner"),
        runway_count: value
            .get("runways")
            .and_then(Value::as_array)
            .map_or(0, Vec::len),
    }
}

fn map_station_info(value: &Value) -> StationInfoSummary {
    StationInfoSummary {
        icao_id: string_field(value, "icaoId"),
        iata_id: string_field(value, "iataId"),
        faa_id: string_field(value, "faaId"),
        site: string_field(value, "site").unwrap_or_else(|| "Unknown station".to_string()),
        state: string_field(value, "state"),
        country: string_field(value, "country"),
        latitude: f64_field(value, "lat"),
        longitude: f64_field(value, "lon"),
        elevation_m: f64_field(value, "elev"),
        priority: i64_field(value, "priority"),
        site_types: value
            .get("siteType")
            .and_then(Value::as_array)
            .map(|items| items.iter().filter_map(value_to_string).collect())
            .unwrap_or_default(),
    }
}

fn map_metar(value: &Value) -> MetarObservation {
    MetarObservation {
        icao_id: string_field(value, "icaoId").unwrap_or_else(|| "UNKNOWN".to_string()),
        station_name: string_field(value, "name"),
        observed_at_unix: i64_field(value, "obsTime"),
        received_at: string_field(value, "receiptTime"),
        reported_at: string_field(value, "reportTime"),
        raw_text: string_field(value, "rawOb").unwrap_or_default(),
        flight_category: string_field(value, "fltCat"),
        metar_type: string_field(value, "metarType"),
        temperature_c: f64_field(value, "temp"),
        dewpoint_c: f64_field(value, "dewp"),
        wind_direction: string_field(value, "wdir"),
        wind_speed_kt: i64_field(value, "wspd"),
        wind_gust_kt: i64_field(value, "wgst"),
        visibility_sm: string_field(value, "visib"),
        altimeter_hpa: f64_field(value, "altim"),
        sea_level_pressure_hpa: f64_field(value, "slp"),
        weather: string_field(value, "wxString"),
        vertical_visibility_ft: i64_field(value, "vertVis"),
        precipitation_last_hour_in: f64_field(value, "precip"),
        precipitation_last_3h_in: f64_field(value, "pcp3hr"),
        precipitation_last_6h_in: f64_field(value, "pcp6hr"),
        precipitation_last_24h_in: f64_field(value, "pcp24hr"),
        clouds: cloud_layers(value.get("clouds")),
    }
}

fn map_taf(value: &Value) -> TafReport {
    let forecast_segments = value
        .get("fcsts")
        .and_then(Value::as_array)
        .map(|items| items.iter().map(map_taf_segment).collect())
        .unwrap_or_default();

    TafReport {
        icao_id: string_field(value, "icaoId").unwrap_or_else(|| "UNKNOWN".to_string()),
        station_name: string_field(value, "name"),
        issued_at: string_field(value, "issueTime"),
        bulletin_time: string_field(value, "bulletinTime"),
        valid_from_unix: i64_field(value, "validTimeFrom"),
        valid_to_unix: i64_field(value, "validTimeTo"),
        raw_text: string_field(value, "rawTAF").unwrap_or_default(),
        remarks: string_field(value, "remarks"),
        forecast_segments,
    }
}

fn map_taf_segment(value: &Value) -> TafForecastSegment {
    TafForecastSegment {
        valid_from_unix: i64_field(value, "timeFrom"),
        valid_to_unix: i64_field(value, "timeTo"),
        transition_end_unix: i64_field(value, "timeBec"),
        change_type: string_field(value, "fcstChange"),
        probability: i64_field(value, "probability"),
        wind_direction: string_field(value, "wdir"),
        wind_speed_kt: i64_field(value, "wspd"),
        wind_gust_kt: i64_field(value, "wgst"),
        visibility_sm: string_field(value, "visib"),
        altimeter_hpa: f64_field(value, "altim"),
        weather: string_field(value, "wxString"),
        vertical_visibility_ft: i64_field(value, "vertVis"),
        not_decoded: string_field(value, "notDecoded"),
        clouds: cloud_layers(value.get("clouds")),
    }
}

fn cloud_layers(value: Option<&Value>) -> Vec<WeatherCloudLayer> {
    value
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| {
                    Some(WeatherCloudLayer {
                        cover: string_field(item, "cover")?,
                        base_ft: i64_field(item, "base"),
                        top_ft: i64_field(item, "top"),
                    })
                })
                .collect()
        })
        .unwrap_or_default()
}

fn parse_noaa_bulletin(text: &str) -> Option<WeatherTextBulletin> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return None;
    }

    let mut lines = trimmed.lines();
    let issued_at = lines
        .next()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(str::to_string);
    let body = lines
        .map(str::trim_end)
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string();

    Some(WeatherTextBulletin {
        issued_at,
        text: if body.is_empty() {
            trimmed.to_string()
        } else {
            body
        },
    })
}

fn extract_cycle_metar(station_id: &str, cycle_label: &str, text: &str) -> Option<NoaaCycleMetar> {
    let needle = format!("{station_id} ");
    text.lines().find_map(|line| {
        let candidate = line.trim();
        if candidate.starts_with(&needle) {
            Some(NoaaCycleMetar {
                cycle_label: cycle_label.to_string(),
                raw_text: candidate.to_string(),
            })
        } else {
            None
        }
    })
}

fn recent_cycle_labels(history_hours: usize) -> Vec<String> {
    let now = Utc::now();
    (0..history_hours)
        .map(|offset| now - Duration::hours(offset as i64))
        .map(|instant| format!("{:02}Z", instant.hour()))
        .collect()
}

fn string_field(value: &Value, key: &str) -> Option<String> {
    value.get(key).and_then(value_to_string)
}

fn value_to_string(value: &Value) -> Option<String> {
    match value {
        Value::Null => None,
        Value::String(item) => {
            let trimmed = item.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        }
        Value::Number(item) => Some(item.to_string()),
        Value::Bool(item) => Some(item.to_string()),
        _ => None,
    }
}

fn f64_field(value: &Value, key: &str) -> Option<f64> {
    value.get(key).and_then(value_to_f64)
}

fn value_to_f64(value: &Value) -> Option<f64> {
    match value {
        Value::Null => None,
        Value::Number(item) => item.as_f64(),
        Value::String(item) => item.trim().parse::<f64>().ok(),
        _ => None,
    }
}

fn i64_field(value: &Value, key: &str) -> Option<i64> {
    value.get(key).and_then(value_to_i64)
}

fn value_to_i64(value: &Value) -> Option<i64> {
    match value {
        Value::Null => None,
        Value::Number(item) => item.as_i64(),
        Value::String(item) => item.trim().parse::<i64>().ok(),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_airport_info_from_awc_json() {
        let airport = map_airport_info(&json!({
            "icaoId": "ZBAA",
            "iataId": "PEK",
            "name": "BEIJING/CAPITAL INTL",
            "state": "BJ",
            "country": "CN",
            "source": "FAA",
            "type": "ARP",
            "lat": "40.0733",
            "lon": "116.5983",
            "elev": "116",
            "magdec": "06W",
            "owner": "P",
            "runways": [{}, {}, {}]
        }));

        assert_eq!(airport.icao_id.as_deref(), Some("ZBAA"));
        assert_eq!(airport.iata_id.as_deref(), Some("PEK"));
        assert_eq!(airport.runway_count, 3);
        assert_eq!(airport.elevation_ft, Some(116.0));
    }

    #[test]
    fn parses_metar_with_cloud_layers() {
        let metar = map_metar(&json!({
            "icaoId": "ZBAA",
            "rawOb": "ZBAA 291700Z 02005MPS 9999 SCT020 18/06 Q1018 NOSIG",
            "obsTime": 1714410000,
            "temp": 18.0,
            "dewp": 6.0,
            "wdir": 20,
            "wspd": 10,
            "visib": "10+",
            "altim": 1018.0,
            "fltCat": "VFR",
            "clouds": [
                { "cover": "SCT", "base": 2000 }
            ]
        }));

        assert_eq!(metar.icao_id, "ZBAA");
        assert_eq!(metar.flight_category.as_deref(), Some("VFR"));
        assert_eq!(metar.clouds.len(), 1);
        assert_eq!(metar.clouds[0].cover, "SCT");
    }

    #[test]
    fn parses_noaa_decoded_bulletin() {
        let bulletin = parse_noaa_bulletin(
            "2026/04/29 17:00\nZBAA 291700Z 02005MPS 9999 SCT020 18/06 Q1018 NOSIG\n",
        )
        .expect("bulletin should parse");

        assert_eq!(bulletin.issued_at.as_deref(), Some("2026/04/29 17:00"));
        assert!(bulletin.text.contains("ZBAA 291700Z"));
    }

    #[test]
    fn extracts_station_metar_from_noaa_cycle_file() {
        let entry = extract_cycle_metar(
            "ZBAA",
            "17Z",
            "ZSPD 291700Z 14005MPS 9999 SCT020 20/14 Q1008 NOSIG\nZBAA 291700Z 02005MPS 9999 SCT020 18/06 Q1018 NOSIG\n",
        )
        .expect("expected ZBAA cycle line");

        assert_eq!(entry.cycle_label, "17Z");
        assert!(entry.raw_text.starts_with("ZBAA "));
    }

    #[test]
    fn recent_cycle_labels_follow_descending_utc_hours() {
        let labels = recent_cycle_labels(4);
        assert_eq!(labels.len(), 4);
        assert!(labels.iter().all(|label| label.ends_with('Z')));
    }
}
