use serde::Serialize;

use crate::shared::LatLon;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AirportInfoSummary {
    pub icao_id: Option<String>,
    pub iata_id: Option<String>,
    pub faa_id: Option<String>,
    pub name: String,
    pub state: Option<String>,
    pub country: Option<String>,
    pub source: Option<String>,
    pub airport_type: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub elevation_ft: Option<f64>,
    pub magnetic_declination: Option<String>,
    pub owner: Option<String>,
    pub runway_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StationInfoSummary {
    pub icao_id: Option<String>,
    pub iata_id: Option<String>,
    pub faa_id: Option<String>,
    pub site: String,
    pub state: Option<String>,
    pub country: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub elevation_m: Option<f64>,
    pub priority: Option<i64>,
    pub site_types: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WeatherCloudLayer {
    pub cover: String,
    pub base_ft: Option<i64>,
    pub top_ft: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MetarObservation {
    pub icao_id: String,
    pub station_name: Option<String>,
    pub observed_at_unix: Option<i64>,
    pub received_at: Option<String>,
    pub reported_at: Option<String>,
    pub raw_text: String,
    pub flight_category: Option<String>,
    pub metar_type: Option<String>,
    pub temperature_c: Option<f64>,
    pub dewpoint_c: Option<f64>,
    pub wind_direction: Option<String>,
    pub wind_speed_kt: Option<i64>,
    pub wind_gust_kt: Option<i64>,
    pub visibility_sm: Option<String>,
    pub altimeter_hpa: Option<f64>,
    pub sea_level_pressure_hpa: Option<f64>,
    pub weather: Option<String>,
    pub vertical_visibility_ft: Option<i64>,
    pub precipitation_last_hour_in: Option<f64>,
    pub precipitation_last_3h_in: Option<f64>,
    pub precipitation_last_6h_in: Option<f64>,
    pub precipitation_last_24h_in: Option<f64>,
    pub clouds: Vec<WeatherCloudLayer>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TafForecastSegment {
    pub valid_from_unix: Option<i64>,
    pub valid_to_unix: Option<i64>,
    pub transition_end_unix: Option<i64>,
    pub change_type: Option<String>,
    pub probability: Option<i64>,
    pub wind_direction: Option<String>,
    pub wind_speed_kt: Option<i64>,
    pub wind_gust_kt: Option<i64>,
    pub visibility_sm: Option<String>,
    pub altimeter_hpa: Option<f64>,
    pub weather: Option<String>,
    pub vertical_visibility_ft: Option<i64>,
    pub not_decoded: Option<String>,
    pub clouds: Vec<WeatherCloudLayer>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TafReport {
    pub icao_id: String,
    pub station_name: Option<String>,
    pub issued_at: Option<String>,
    pub bulletin_time: Option<String>,
    pub valid_from_unix: Option<i64>,
    pub valid_to_unix: Option<i64>,
    pub raw_text: String,
    pub remarks: Option<String>,
    pub forecast_segments: Vec<TafForecastSegment>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WeatherTextBulletin {
    pub issued_at: Option<String>,
    pub text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoaaCycleMetar {
    pub cycle_label: String,
    pub raw_text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoaaWeatherSupplement {
    pub current_raw: Option<WeatherTextBulletin>,
    pub current_decoded: Option<WeatherTextBulletin>,
    pub recent_cycles: Vec<NoaaCycleMetar>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AirportCommunication {
    pub service_type: String,
    pub label: String,
    pub name: Option<String>,
    pub frequency_mhz: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AirportRunwayEnd {
    pub runway_name: String,
    pub reciprocal_runway_name: String,
    pub heading_deg: f64,
    pub length_ft: f64,
    pub width_ft: f64,
    pub surface: Option<String>,
    pub is_takeoff: bool,
    pub is_landing: bool,
    pub ils_ident: Option<String>,
    pub location: LatLon,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum GeneratedAtisType {
    Combined,
    Departure,
    Arrival,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneratedAtisReport {
    pub atis_type: GeneratedAtisType,
    pub information_code: String,
    pub issued_at: Option<String>,
    pub runways_in_use: Vec<String>,
    pub contacts: Vec<AirportCommunication>,
    pub text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneratedAtisBundle {
    pub is_combined: bool,
    pub departure: GeneratedAtisReport,
    pub arrival: GeneratedAtisReport,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AirportWeatherOverviewResponse {
    pub requested_id: String,
    pub resolved_id: String,
    pub airport: Option<AirportInfoSummary>,
    pub station: Option<StationInfoSummary>,
    pub metar: Option<MetarObservation>,
    pub taf: Option<TafReport>,
    pub communications: Vec<AirportCommunication>,
    pub generated_atis: Option<GeneratedAtisBundle>,
    pub noaa: NoaaWeatherSupplement,
    pub warnings: Vec<String>,
}
