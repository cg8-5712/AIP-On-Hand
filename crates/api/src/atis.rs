use aip_domain::{
    AirportCommunication, AirportRunwayEnd, AirportWeatherOverviewResponse, GeneratedAtisBundle,
    GeneratedAtisReport, GeneratedAtisType, MetarObservation, TafForecastSegment,
    WeatherCloudLayer,
};
use chrono::{Datelike, TimeZone, Timelike, Utc};
use std::collections::HashSet;

const PARALLEL_HEADING_TOLERANCE_DEG: f64 = 12.0;
const LIGHT_AND_VARIABLE_WIND_KT: i64 = 3;
const MPS_TO_KT: f64 = 1.943_844;
const MILES_TO_KM: f64 = 1.609_34;
const MILES_TO_METERS: f64 = 1_609.34;
const FEET_TO_METERS: f64 = 0.3048;
const HPA_TO_INHG: f64 = 0.029_529_983_071_4;
const NATO_INFORMATION_CODES: [&str; 26] = [
    "Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India", "Juliett",
    "Kilo", "Lima", "Mike", "November", "Oscar", "Papa", "Quebec", "Romeo", "Sierra", "Tango",
    "Uniform", "Victor", "Whiskey", "Xray", "Yankee", "Zulu",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum AtisOperation {
    Departure,
    Arrival,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum WindUnit {
    Knots,
    MetersPerSecond,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PressureUnit {
    Hpa,
    InHg,
}

#[derive(Debug, Clone, Copy, PartialEq)]
enum VisibilityMeasure {
    Unlimited,
    Meters(i64),
    StatuteMiles(f64),
}

#[derive(Debug, Clone)]
struct ParsedWind {
    direction_deg: Option<i64>,
    speed: Option<i64>,
    gust: Option<i64>,
    unit: WindUnit,
    variable_from_deg: Option<i64>,
    variable_to_deg: Option<i64>,
}

pub fn build_generated_atis(
    overview: &AirportWeatherOverviewResponse,
    runway_ends: &[AirportRunwayEnd],
) -> Option<GeneratedAtisBundle> {
    let metar = overview.metar.as_ref()?;
    if runway_ends.is_empty() {
        return None;
    }

    let airport_ident = overview
        .airport
        .as_ref()
        .and_then(|airport| airport.icao_id.clone())
        .or_else(|| {
            overview
                .station
                .as_ref()
                .and_then(|station| station.icao_id.clone())
        })
        .unwrap_or_else(|| overview.resolved_id.clone());
    let airport_name = overview
        .airport
        .as_ref()
        .map(|airport| airport.name.clone())
        .or_else(|| {
            overview
                .station
                .as_ref()
                .map(|station| station.site.clone())
        })
        .unwrap_or_else(|| airport_ident.clone());
    let information_code = derive_information_code(metar);
    let issued_at = derive_issued_at_digits(metar);
    let parsed_wind = parse_wind(metar);

    let departure_runways =
        select_active_runways(runway_ends, &parsed_wind, AtisOperation::Departure);
    let arrival_runways = select_active_runways(runway_ends, &parsed_wind, AtisOperation::Arrival);

    if departure_runways.is_empty() && arrival_runways.is_empty() {
        return None;
    }

    let departure_contacts = select_contacts(&overview.communications, AtisOperation::Departure);
    let arrival_contacts = select_contacts(&overview.communications, AtisOperation::Arrival);

    Some(GeneratedAtisBundle {
        departure: build_report(
            &airport_name,
            metar,
            overview,
            AtisOperation::Departure,
            &information_code,
            issued_at.clone(),
            &parsed_wind,
            &departure_runways,
            &arrival_runways,
            departure_contacts,
        ),
        arrival: build_report(
            &airport_name,
            metar,
            overview,
            AtisOperation::Arrival,
            &information_code,
            issued_at,
            &parsed_wind,
            &departure_runways,
            &arrival_runways,
            arrival_contacts,
        ),
    })
}

fn build_report(
    airport_name: &str,
    metar: &MetarObservation,
    overview: &AirportWeatherOverviewResponse,
    operation: AtisOperation,
    information_code: &str,
    issued_at: Option<String>,
    parsed_wind: &ParsedWind,
    departure_runways: &[AirportRunwayEnd],
    arrival_runways: &[AirportRunwayEnd],
    contacts: Vec<AirportCommunication>,
) -> GeneratedAtisReport {
    let airport_title = normalize_airport_name(airport_name);
    let report_type_label = match operation {
        AtisOperation::Departure => "Departure",
        AtisOperation::Arrival => "Arrival",
    };
    let active_runways = match operation {
        AtisOperation::Departure => departure_runways,
        AtisOperation::Arrival => arrival_runways,
    };
    let runways_in_use = active_runways
        .iter()
        .map(|runway| runway.runway_name.clone())
        .collect::<Vec<_>>();

    let mut lines = vec![format!(
        "{airport_title} {report_type_label} information {information_code}."
    )];

    if let Some(issued_at) = issued_at.as_deref() {
        lines.push(format!("At time {issued_at}."));
    }

    if matches!(operation, AtisOperation::Arrival) {
        if let Some(approach_sentence) = format_expected_approach(arrival_runways) {
            lines.push(approach_sentence);
        }
    }

    if let Some(runway_sentence) =
        format_runway_use_sentence(arrival_runways, departure_runways, operation)
    {
        lines.push(runway_sentence);
    }

    if let Some(contact_sentence) = format_frequency_notice(&contacts, active_runways, operation) {
        lines.push(contact_sentence);
    }

    if let Some(runway_condition_sentence) = infer_runway_condition_sentence(metar) {
        lines.push(runway_condition_sentence);
    }

    if let Some(wind_sentence) = format_wind_sentence(parsed_wind) {
        lines.push(wind_sentence);
    }

    if let Some(variable_sentence) = format_variable_wind_sentence(parsed_wind) {
        lines.push(variable_sentence);
    }

    if let Some(visibility_sentence) = format_visibility_sentence(metar) {
        lines.push(visibility_sentence);
    }

    if let Some(weather_sentence) = format_weather_sentence(metar) {
        lines.push(weather_sentence);
    }

    if let Some(clouds_sentence) = format_clouds_sentence(metar) {
        lines.push(clouds_sentence);
    }

    if let Some(temperature_sentence) = format_temperature_sentence(metar) {
        lines.push(temperature_sentence);
    }

    if let Some(pressure_sentence) = format_pressure_sentence(metar, overview) {
        lines.push(pressure_sentence);
    }

    if let Some(trend_sentence) = format_trend_sentence(overview) {
        lines.push(trend_sentence);
    }

    lines.push(match operation {
        AtisOperation::Arrival => {
            format!("Acknowledge information {information_code} on first contact with Approach.")
        }
        AtisOperation::Departure => {
            format!("Advise you have information {information_code} when requesting clearance.")
        }
    });

    GeneratedAtisReport {
        atis_type: match operation {
            AtisOperation::Departure => GeneratedAtisType::Departure,
            AtisOperation::Arrival => GeneratedAtisType::Arrival,
        },
        information_code: information_code.to_string(),
        issued_at,
        runways_in_use,
        contacts,
        text: lines.join(" "),
    }
}

fn select_active_runways(
    runway_ends: &[AirportRunwayEnd],
    parsed_wind: &ParsedWind,
    operation: AtisOperation,
) -> Vec<AirportRunwayEnd> {
    let mut candidates = runway_ends
        .iter()
        .filter(|runway| runway_supports_operation(runway, operation))
        .cloned()
        .collect::<Vec<_>>();

    if candidates.is_empty() {
        candidates = runway_ends.to_vec();
    }
    if candidates.is_empty() {
        return Vec::new();
    }

    let anchor = candidates
        .iter()
        .max_by(|left, right| {
            runway_anchor_score(left, parsed_wind, operation)
                .total_cmp(&runway_anchor_score(right, parsed_wind, operation))
                .then_with(|| left.length_ft.total_cmp(&right.length_ft))
                .then_with(|| left.runway_name.cmp(&right.runway_name))
        })
        .cloned()
        .unwrap_or_else(|| candidates[0].clone());

    let family = candidates
        .into_iter()
        .filter(|runway| {
            heading_difference_deg(runway.heading_deg, anchor.heading_deg)
                <= PARALLEL_HEADING_TOLERANCE_DEG
        })
        .collect::<Vec<_>>();

    let selected = apply_parallel_runway_rules(family, operation);
    if selected.is_empty() {
        vec![anchor]
    } else {
        selected
    }
}

fn apply_parallel_runway_rules(
    mut runway_family: Vec<AirportRunwayEnd>,
    operation: AtisOperation,
) -> Vec<AirportRunwayEnd> {
    if runway_family.len() <= 2 {
        return runway_family;
    }

    let mean_heading = average_heading(
        &runway_family
            .iter()
            .map(|runway| runway.heading_deg)
            .collect::<Vec<_>>(),
    );
    let mean_lat = runway_family
        .iter()
        .map(|runway| runway.location.lat)
        .sum::<f64>()
        / runway_family.len() as f64;
    let mean_lon = runway_family
        .iter()
        .map(|runway| runway.location.lon)
        .sum::<f64>()
        / runway_family.len() as f64;
    let cos_lat = mean_lat.to_radians().cos();
    let heading_radians = mean_heading.to_radians();
    let perp_x = heading_radians.cos();
    let perp_y = -heading_radians.sin();

    runway_family.sort_by(|left, right| {
        lateral_position(left, mean_lon, cos_lat, perp_x, perp_y)
            .total_cmp(&lateral_position(right, mean_lon, cos_lat, perp_x, perp_y))
            .then_with(|| left.runway_name.cmp(&right.runway_name))
    });

    match operation {
        AtisOperation::Arrival => {
            vec![
                runway_family.first().cloned().unwrap(),
                runway_family.last().cloned().unwrap(),
            ]
        }
        AtisOperation::Departure => runway_family[1..runway_family.len() - 1].to_vec(),
    }
}

fn lateral_position(
    runway: &AirportRunwayEnd,
    mean_lon: f64,
    cos_lat: f64,
    perp_x: f64,
    perp_y: f64,
) -> f64 {
    let east = (runway.location.lon - mean_lon) * cos_lat;
    let north = runway.location.lat;
    east * perp_x + north * perp_y
}

fn runway_anchor_score(
    runway: &AirportRunwayEnd,
    parsed_wind: &ParsedWind,
    operation: AtisOperation,
) -> f64 {
    let mut score = runway.length_ft / 1000.0;
    if matches!(operation, AtisOperation::Arrival) && runway.ils_ident.is_some() {
        score += 2.5;
    }

    if let Some(headwind_component) = headwind_component(runway.heading_deg, parsed_wind) {
        if headwind_component >= 0.0 {
            score += headwind_component * 4.0;
        } else {
            score += headwind_component * 8.0;
        }
    }

    score
}

fn runway_supports_operation(runway: &AirportRunwayEnd, operation: AtisOperation) -> bool {
    match operation {
        AtisOperation::Departure => runway.is_takeoff,
        AtisOperation::Arrival => runway.is_landing,
    }
}

fn headwind_component(runway_heading_deg: f64, parsed_wind: &ParsedWind) -> Option<f64> {
    let wind_direction = parsed_wind.direction_deg?;
    let wind_speed = parsed_wind
        .speed
        .map(|speed| normalize_speed_to_knots(speed, parsed_wind.unit))?;
    if wind_speed <= LIGHT_AND_VARIABLE_WIND_KT as f64 {
        return None;
    }

    let delta_radians =
        heading_difference_deg(runway_heading_deg, wind_direction as f64).to_radians();
    Some(wind_speed * delta_radians.cos())
}

fn parse_wind(metar: &MetarObservation) -> ParsedWind {
    let raw_text = metar.raw_text.to_uppercase();
    let raw_tokens = raw_text.split_whitespace().collect::<Vec<_>>();
    let mut variable_from_deg = None;
    let mut variable_to_deg = None;

    for window in raw_tokens.windows(3) {
        if let [from, "V", to] = window {
            if from.len() == 3 && to.len() == 3 {
                variable_from_deg = from.parse::<i64>().ok();
                variable_to_deg = to.parse::<i64>().ok();
                break;
            }
        }
    }

    let token_parse = raw_tokens.iter().find_map(|token| parse_wind_token(token));
    let direction_deg = token_parse
        .as_ref()
        .and_then(|parsed| parsed.direction_deg)
        .or_else(|| {
            metar
                .wind_direction
                .as_deref()
                .map(str::trim)
                .and_then(|value| match value.to_uppercase().as_str() {
                    "VRB" | "VAR" => None,
                    _ => value.parse::<i64>().ok(),
                })
        });
    let speed = token_parse
        .as_ref()
        .and_then(|parsed| parsed.speed)
        .or(metar.wind_speed_kt);
    let gust = token_parse
        .as_ref()
        .and_then(|parsed| parsed.gust)
        .or(metar.wind_gust_kt);
    let unit = token_parse
        .as_ref()
        .map(|parsed| parsed.unit)
        .unwrap_or(WindUnit::Knots);

    ParsedWind {
        direction_deg,
        speed,
        gust,
        unit,
        variable_from_deg,
        variable_to_deg,
    }
}

fn parse_wind_token(token: &str) -> Option<ParsedWind> {
    let normalized = token.trim().to_uppercase();
    let (body, unit) = if let Some(body) = normalized.strip_suffix("KT") {
        (body, WindUnit::Knots)
    } else if let Some(body) = normalized.strip_suffix("MPS") {
        (body, WindUnit::MetersPerSecond)
    } else {
        return None;
    };

    if body.len() < 5 {
        return None;
    }

    let direction_text = &body[..3];
    let rest = &body[3..];
    let direction_deg = match direction_text {
        "VRB" | "VAR" => None,
        _ => direction_text.parse::<i64>().ok(),
    };
    let (speed_text, gust_text) = if let Some((speed_text, gust_text)) = rest.split_once('G') {
        (speed_text, Some(gust_text))
    } else {
        (rest, None)
    };
    let speed = speed_text.parse::<i64>().ok();
    let gust = gust_text.and_then(|value| value.parse::<i64>().ok());

    Some(ParsedWind {
        direction_deg,
        speed,
        gust,
        unit,
        variable_from_deg: None,
        variable_to_deg: None,
    })
}

fn average_heading(headings: &[f64]) -> f64 {
    let (sin_sum, cos_sum) = headings
        .iter()
        .fold((0.0, 0.0), |(sin_sum, cos_sum), heading| {
            let radians = heading.to_radians();
            (sin_sum + radians.sin(), cos_sum + radians.cos())
        });

    if sin_sum == 0.0 && cos_sum == 0.0 {
        0.0
    } else {
        sin_sum.atan2(cos_sum).to_degrees().rem_euclid(360.0)
    }
}

fn heading_difference_deg(left: f64, right: f64) -> f64 {
    let difference = (left - right).rem_euclid(360.0);
    difference.min(360.0 - difference)
}

fn derive_information_code(metar: &MetarObservation) -> String {
    let Some(observed_at_unix) = metar.observed_at_unix else {
        return NATO_INFORMATION_CODES[0].to_string();
    };
    let Some(timestamp) = Utc.timestamp_opt(observed_at_unix, 0).single() else {
        return NATO_INFORMATION_CODES[0].to_string();
    };

    let cycle_index =
        (timestamp.ordinal0() * 48 + timestamp.hour() * 2 + u32::from(timestamp.minute() >= 30))
            % NATO_INFORMATION_CODES.len() as u32;
    NATO_INFORMATION_CODES[cycle_index as usize].to_string()
}

fn derive_issued_at_digits(metar: &MetarObservation) -> Option<String> {
    let observed_at_unix = metar.observed_at_unix?;
    let timestamp = Utc.timestamp_opt(observed_at_unix, 0).single()?;
    Some(format!("{:02}{:02}Z", timestamp.hour(), timestamp.minute()))
}

fn normalize_airport_name(name: &str) -> String {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return "Airport".to_string();
    }
    trimmed.to_string()
}

fn format_expected_approach(arrival_runways: &[AirportRunwayEnd]) -> Option<String> {
    let primary_runway = arrival_runways.first()?;
    if primary_runway.ils_ident.is_some() {
        Some(format!(
            "ILS Runway {} approach.",
            primary_runway.runway_name
        ))
    } else {
        Some(format!(
            "Expected approach Runway {}.",
            primary_runway.runway_name
        ))
    }
}

fn format_runway_use_sentence(
    arrival_runways: &[AirportRunwayEnd],
    departure_runways: &[AirportRunwayEnd],
    operation: AtisOperation,
) -> Option<String> {
    let arrival_names = arrival_runways
        .iter()
        .map(|runway| runway.runway_name.clone())
        .collect::<Vec<_>>();
    let departure_names = departure_runways
        .iter()
        .map(|runway| runway.runway_name.clone())
        .collect::<Vec<_>>();

    match operation {
        AtisOperation::Arrival => {
            if arrival_names.is_empty() && departure_names.is_empty() {
                None
            } else if departure_names.is_empty() {
                Some(format!(
                    "Landing Runway {}.",
                    join_runway_phrase(&arrival_names)
                ))
            } else {
                Some(format!(
                    "Landing Runway {}, Departure Runway {}.",
                    join_runway_phrase(&arrival_names),
                    join_runway_phrase(&departure_names)
                ))
            }
        }
        AtisOperation::Departure => {
            if departure_names.is_empty() && arrival_names.is_empty() {
                None
            } else if arrival_names.is_empty() {
                Some(format!(
                    "Departure Runway {}.",
                    join_runway_phrase(&departure_names)
                ))
            } else {
                Some(format!(
                    "Departure Runway {}, Landing Runway {}.",
                    join_runway_phrase(&departure_names),
                    join_runway_phrase(&arrival_names)
                ))
            }
        }
    }
}

fn format_frequency_notice(
    contacts: &[AirportCommunication],
    active_runways: &[AirportRunwayEnd],
    operation: AtisOperation,
) -> Option<String> {
    if contacts.is_empty() {
        return None;
    }

    if matches!(operation, AtisOperation::Arrival) {
        return None;
    }

    let runway_names = active_runways
        .iter()
        .map(|runway| runway.runway_name.clone())
        .collect::<Vec<_>>();

    if runway_names.is_empty() {
        return Some(format!(
            "Departure Frequency {}.",
            join_contact_short_list(contacts)
        ));
    }

    Some(format!(
        "Departure Frequency {}.",
        assign_contacts_to_runways(contacts, &runway_names)
    ))
}

fn assign_contacts_to_runways(
    contacts: &[AirportCommunication],
    runway_names: &[String],
) -> String {
    if contacts.is_empty() {
        return String::new();
    }

    if contacts.len() == 1 {
        return format!("{:.3}", contacts[0].frequency_mhz);
    }

    runway_names
        .iter()
        .enumerate()
        .map(|(index, runway_name)| {
            let contact = &contacts[index.min(contacts.len() - 1)];
            format!("{:.3} Runway {}", contact.frequency_mhz, runway_name)
        })
        .collect::<Vec<_>>()
        .join(", ")
}

fn join_contact_short_list(contacts: &[AirportCommunication]) -> String {
    contacts
        .iter()
        .map(|contact| format!("{:.3}", contact.frequency_mhz))
        .collect::<Vec<_>>()
        .join(", ")
}

fn infer_runway_condition_sentence(metar: &MetarObservation) -> Option<String> {
    let weather = metar.weather.as_deref()?.to_uppercase();
    if weather.contains("RA")
        || weather.contains("DZ")
        || weather.contains("SN")
        || weather.contains("SH")
    {
        Some("Runway surface wet.".to_string())
    } else {
        None
    }
}

fn format_wind_sentence(parsed_wind: &ParsedWind) -> Option<String> {
    let speed = parsed_wind.speed?;
    let direction = parsed_wind.direction_deg;

    let wind_unit = match parsed_wind.unit {
        WindUnit::Knots => "KT",
        WindUnit::MetersPerSecond => "MPS",
    };

    let mut text = if let Some(direction) = direction {
        format!("Wind {:03} degrees at {} {}", direction, speed, wind_unit)
    } else {
        format!("Wind variable {} {}", speed, wind_unit)
    };

    if let Some(gust) = parsed_wind.gust {
        let gust_keyword = match parsed_wind.unit {
            WindUnit::Knots => "maximum",
            WindUnit::MetersPerSecond => "gust",
        };
        text.push_str(&format!(" {gust_keyword} {}", gust));
    }

    Some(format!("{text}."))
}

fn format_variable_wind_sentence(parsed_wind: &ParsedWind) -> Option<String> {
    let from_deg = parsed_wind.variable_from_deg?;
    let to_deg = parsed_wind.variable_to_deg?;
    Some(format!(
        "Direction variable between {:03} and {:03}.",
        from_deg, to_deg
    ))
}

fn format_visibility_sentence(metar: &MetarObservation) -> Option<String> {
    let measure = parse_visibility_measure(metar)?;
    Some(format_visibility_measure(measure))
}

fn format_weather_sentence(metar: &MetarObservation) -> Option<String> {
    let weather = metar.weather.as_deref()?.trim();
    if weather.is_empty() {
        return None;
    }
    Some(format!("{}.", decode_weather_string(weather)))
}

fn format_clouds_sentence(metar: &MetarObservation) -> Option<String> {
    let mut parts = metar
        .clouds
        .iter()
        .map(format_cloud_layer_spoken)
        .collect::<Vec<_>>();

    if let Some(vertical_visibility_ft) = metar.vertical_visibility_ft {
        let meters = (vertical_visibility_ft as f64 * FEET_TO_METERS).round() as i64;
        parts.push(format!(
            "Vertical visibility {} meters",
            number_to_atis(meters)
        ));
    }

    if parts.is_empty() {
        return None;
    }

    Some(format!("Clouds {}.", parts.join(". ")))
}

fn format_cloud_layer_spoken(layer: &WeatherCloudLayer) -> String {
    let cover = decode_cloud_cover(&layer.cover);
    let cloud_type = infer_cloud_shape_label(layer);
    match layer.base_ft {
        Some(base_ft) => {
            let base_spoken = altitude_ft_to_spoken(base_ft);
            if let Some(cloud_type) = cloud_type {
                format!("{cover} {base_spoken} {cloud_type}")
            } else {
                format!("{cover} {base_spoken}")
            }
        }
        None => {
            if let Some(cloud_type) = cloud_type {
                format!("{cover} {cloud_type}")
            } else {
                cover.to_string()
            }
        }
    }
}

fn infer_cloud_shape_label(layer: &WeatherCloudLayer) -> Option<&'static str> {
    let cover = layer.cover.to_uppercase();
    if cover.contains("CB") {
        Some("cumulonimbus")
    } else if cover.contains("TCU") {
        Some("towering cumulus")
    } else {
        None
    }
}

fn decode_cloud_cover(raw_cover: &str) -> &'static str {
    let normalized = raw_cover.to_uppercase();
    if normalized.starts_with("FEW") {
        "Few"
    } else if normalized.starts_with("SCT") {
        "Scattered"
    } else if normalized.starts_with("BKN") {
        "Broken"
    } else if normalized.starts_with("OVC") {
        "Overcast"
    } else if normalized.starts_with("VV") {
        "Vertical visibility"
    } else {
        "Clouds"
    }
}

fn altitude_ft_to_spoken(base_ft: i64) -> String {
    if base_ft < 10_000 {
        let thousands = base_ft / 1000;
        let hundreds = (base_ft % 1000) / 100;
        match (thousands, hundreds) {
            (0, 0) => "zero".to_string(),
            (0, hundreds) => format!("{} hundred", number_to_atis(hundreds)),
            (thousands, 0) => format!("{} thousand", number_to_atis(thousands)),
            (thousands, hundreds) => format!(
                "{} thousand {} hundred",
                number_to_atis(thousands),
                number_to_atis(hundreds)
            ),
        }
    } else {
        let thousands = base_ft / 1000;
        format!("{} thousand", number_to_atis(thousands))
    }
}

fn format_temperature_sentence(metar: &MetarObservation) -> Option<String> {
    match (metar.temperature_c, metar.dewpoint_c) {
        (Some(temperature), Some(dewpoint)) => Some(format!(
            "Temperature {}, dew point {}.",
            temperature.round() as i64,
            dewpoint.round() as i64
        )),
        (Some(temperature), None) => Some(format!("Temperature {}.", temperature.round() as i64)),
        _ => None,
    }
}

fn format_pressure_sentence(
    metar: &MetarObservation,
    overview: &AirportWeatherOverviewResponse,
) -> Option<String> {
    let (pressure_unit, reported_qnh) = parse_reported_pressure(metar)
        .or_else(|| metar.altimeter_hpa.map(|value| (PressureUnit::Hpa, value)))?;
    let qnh_hpa = pressure_to_hpa(reported_qnh, pressure_unit);
    let qfe_hpa = overview
        .airport
        .as_ref()
        .and_then(|airport| airport.elevation_ft)
        .map(|elevation_ft| qnh_hpa - elevation_ft * 0.035);
    let qnh_display = format_pressure_value(reported_qnh, pressure_unit);
    let unit_label = pressure_unit_label(pressure_unit);

    if let Some(qfe_hpa) = qfe_hpa.filter(|qfe_hpa| (qnh_hpa - *qfe_hpa).abs() >= 2.0) {
        let qfe_display =
            format_pressure_value(pressure_from_hpa(qfe_hpa, pressure_unit), pressure_unit);
        Some(format!(
            "QFE {} {}, QNH {} {}.",
            qfe_display, unit_label, qnh_display, unit_label
        ))
    } else {
        Some(format!("QNH {} {}.", qnh_display, unit_label))
    }
}

fn format_trend_sentence(overview: &AirportWeatherOverviewResponse) -> Option<String> {
    let taf = overview.taf.as_ref()?;
    let segment = taf.forecast_segments.iter().find(|segment| {
        segment
            .change_type
            .as_deref()
            .map(|value| value.eq_ignore_ascii_case("TEMPO"))
            .unwrap_or(false)
    })?;
    format_taf_segment_trend(segment)
}

fn format_taf_segment_trend(segment: &TafForecastSegment) -> Option<String> {
    let mut parts = vec!["Tempo".to_string()];

    if let Some(visibility) = segment
        .visibility_sm
        .as_deref()
        .and_then(parse_visibility_from_awc_field)
    {
        parts.push(format!(
            "visibility {}",
            visibility_measure_text(visibility)
        ));
    }

    if let Some(weather) = segment.weather.as_deref() {
        parts.push(decode_weather_string(weather));
    }

    if parts.len() == 1 {
        None
    } else {
        Some(format!("{}.", parts.join(", ")))
    }
}

fn select_contacts(
    communications: &[AirportCommunication],
    operation: AtisOperation,
) -> Vec<AirportCommunication> {
    let mut contacts = Vec::new();

    match operation {
        AtisOperation::Departure => {
            contacts.extend(pick_contacts(communications, &["dep"], 2));
            if contacts.is_empty() {
                contacts.extend(pick_contacts(communications, &["app"], 2));
            }
            if contacts.is_empty() {
                contacts.extend(pick_contacts(communications, &["twr"], 2));
            }
        }
        AtisOperation::Arrival => {
            contacts.extend(pick_contacts(communications, &["app"], 2));
            if contacts.is_empty() {
                contacts.extend(pick_contacts(communications, &["dep"], 2));
            }
        }
    }

    dedupe_contacts(contacts)
}

fn pick_contacts(
    communications: &[AirportCommunication],
    service_types: &[&str],
    limit: usize,
) -> Vec<AirportCommunication> {
    for service_type in service_types {
        let matching = communications
            .iter()
            .filter(|entry| entry.service_type == *service_type)
            .take(limit)
            .cloned()
            .collect::<Vec<_>>();
        if !matching.is_empty() {
            return matching;
        }
    }

    Vec::new()
}

fn dedupe_contacts(contacts: Vec<AirportCommunication>) -> Vec<AirportCommunication> {
    let mut deduped = Vec::new();
    let mut seen = HashSet::new();

    for contact in contacts {
        let key = format!("{}:{:.3}", contact.service_type, contact.frequency_mhz);
        if seen.insert(key) {
            deduped.push(contact);
        }
    }

    deduped
}

fn join_runway_phrase(runways: &[String]) -> String {
    join_with_and(
        &runways
            .iter()
            .map(|runway| runway.to_string())
            .collect::<Vec<_>>(),
    )
}

fn join_with_and(items: &[String]) -> String {
    match items.len() {
        0 => String::new(),
        1 => items[0].clone(),
        2 => format!("{} and {}", items[0], items[1]),
        _ => {
            let mut prefix = items[..items.len() - 1].join(", ");
            prefix.push_str(", and ");
            prefix.push_str(&items[items.len() - 1]);
            prefix
        }
    }
}

fn decode_weather_string(raw_weather: &str) -> String {
    let normalized = raw_weather.trim().to_uppercase();
    if normalized.is_empty() {
        return "Weather unavailable".to_string();
    }

    normalized
        .split_whitespace()
        .map(decode_weather_token)
        .collect::<Vec<_>>()
        .join(", ")
}

fn decode_weather_token(token: &str) -> String {
    let mut remaining = token.trim().to_uppercase();
    let intensity = if let Some(stripped) = remaining.strip_prefix('+') {
        remaining = stripped.to_string();
        Some("Heavy")
    } else if let Some(stripped) = remaining.strip_prefix('-') {
        remaining = stripped.to_string();
        Some("Light")
    } else {
        None
    };

    let mut pieces = Vec::new();
    if remaining.contains("SH") {
        pieces.push("Showers");
        remaining = remaining.replace("SH", "");
    }
    if remaining.contains("TS") {
        pieces.push("Thunderstorm");
        remaining = remaining.replace("TS", "");
    }
    if remaining.contains("RA") {
        pieces.push("Rain");
        remaining = remaining.replace("RA", "");
    }
    if remaining.contains("DZ") {
        pieces.push("Drizzle");
        remaining = remaining.replace("DZ", "");
    }
    if remaining.contains("SN") {
        pieces.push("Snow");
        remaining = remaining.replace("SN", "");
    }
    if remaining.contains("FG") {
        pieces.push("Fog");
        remaining = remaining.replace("FG", "");
    }
    if remaining.contains("BR") {
        pieces.push("Mist");
        remaining = remaining.replace("BR", "");
    }
    if remaining.contains("HZ") {
        pieces.push("Haze");
    }

    if pieces.is_empty() {
        return token.to_string();
    }

    let weather_text = pieces.join(" ");
    match intensity {
        Some(intensity) => format!("{intensity} {weather_text}"),
        None => weather_text,
    }
}

fn normalize_speed_to_knots(value: i64, unit: WindUnit) -> f64 {
    match unit {
        WindUnit::Knots => value as f64,
        WindUnit::MetersPerSecond => value as f64 * MPS_TO_KT,
    }
}

fn parse_reported_pressure(metar: &MetarObservation) -> Option<(PressureUnit, f64)> {
    metar.raw_text.split_whitespace().find_map(|token| {
        let token = token.trim().to_uppercase();

        if let Some(value) = token.strip_prefix('Q') {
            if value.len() == 4 && value.chars().all(|character| character.is_ascii_digit()) {
                return value
                    .parse::<f64>()
                    .ok()
                    .map(|parsed| (PressureUnit::Hpa, parsed));
            }
        }

        if let Some(value) = token.strip_prefix('A') {
            if value.len() == 4 && value.chars().all(|character| character.is_ascii_digit()) {
                return value
                    .parse::<f64>()
                    .ok()
                    .map(|parsed| (PressureUnit::InHg, parsed / 100.0));
            }
        }

        None
    })
}

fn pressure_to_hpa(value: f64, unit: PressureUnit) -> f64 {
    match unit {
        PressureUnit::Hpa => value,
        PressureUnit::InHg => value / HPA_TO_INHG,
    }
}

fn pressure_from_hpa(value: f64, unit: PressureUnit) -> f64 {
    match unit {
        PressureUnit::Hpa => value,
        PressureUnit::InHg => value * HPA_TO_INHG,
    }
}

fn format_pressure_value(value: f64, unit: PressureUnit) -> String {
    match unit {
        PressureUnit::Hpa => format!("{}", value.round() as i64),
        PressureUnit::InHg => format!("{value:.2}"),
    }
}

fn pressure_unit_label(unit: PressureUnit) -> &'static str {
    match unit {
        PressureUnit::Hpa => "HPa",
        PressureUnit::InHg => "InHg",
    }
}

fn parse_visibility_measure(metar: &MetarObservation) -> Option<VisibilityMeasure> {
    parse_visibility_from_raw_text(&metar.raw_text).or_else(|| {
        metar
            .visibility_sm
            .as_deref()
            .and_then(parse_visibility_from_awc_field)
    })
}

fn parse_visibility_from_raw_text(raw_text: &str) -> Option<VisibilityMeasure> {
    let upper = raw_text.to_uppercase();
    let tokens = upper.split_whitespace().collect::<Vec<_>>();

    for (index, token) in tokens.iter().enumerate() {
        if *token == "CAVOK" || *token == "9999" {
            return Some(VisibilityMeasure::Unlimited);
        }

        if token.starts_with('R') && token.contains('/') {
            continue;
        }

        if token.len() == 4 && token.chars().all(|character| character.is_ascii_digit()) {
            return token.parse::<i64>().ok().map(VisibilityMeasure::Meters);
        }

        if let Some(statute_miles) = parse_statute_miles_token(&tokens, index) {
            return Some(statute_miles);
        }
    }

    None
}

fn parse_visibility_from_awc_field(value: &str) -> Option<VisibilityMeasure> {
    let normalized = value.trim().to_uppercase();
    if normalized.is_empty() {
        return None;
    }

    if normalized == "10+" || normalized == "P6" || normalized == "P6SM" || normalized == "6+" {
        return Some(VisibilityMeasure::Unlimited);
    }

    if normalized == "9999" {
        return Some(VisibilityMeasure::Unlimited);
    }

    if normalized.len() == 4
        && normalized
            .chars()
            .all(|character| character.is_ascii_digit())
    {
        return normalized
            .parse::<i64>()
            .ok()
            .map(VisibilityMeasure::Meters);
    }

    if normalized.ends_with("SM") || normalized.contains('/') || normalized.contains('.') {
        return parse_statute_miles_token(&[normalized.as_str()], 0);
    }

    if let Ok(sm) = normalized.parse::<f64>() {
        return Some(VisibilityMeasure::StatuteMiles(sm));
    }

    None
}

fn parse_statute_miles_token(tokens: &[&str], index: usize) -> Option<VisibilityMeasure> {
    let token = *tokens.get(index)?;
    let body = token.strip_suffix("SM")?;

    if let Some(value) = body.strip_prefix('P') {
        let sm = parse_fractional_number(value)?;
        return if sm >= 6.0 {
            Some(VisibilityMeasure::Unlimited)
        } else {
            Some(VisibilityMeasure::StatuteMiles(sm))
        };
    }

    if let Some(previous) = index
        .checked_sub(1)
        .and_then(|position| tokens.get(position))
    {
        if previous.chars().all(|character| character.is_ascii_digit()) && body.contains('/') {
            let whole = previous.parse::<f64>().ok()?;
            let fraction = parse_fractional_number(body)?;
            return Some(VisibilityMeasure::StatuteMiles(whole + fraction));
        }
    }

    parse_fractional_number(body).map(VisibilityMeasure::StatuteMiles)
}

fn parse_fractional_number(value: &str) -> Option<f64> {
    let normalized = value.trim().trim_start_matches('M');
    if let Some((numerator, denominator)) = normalized.split_once('/') {
        let numerator = numerator.parse::<f64>().ok()?;
        let denominator = denominator.parse::<f64>().ok()?;
        if denominator.abs() < f64::EPSILON {
            return None;
        }
        Some(numerator / denominator)
    } else {
        normalized.parse::<f64>().ok()
    }
}

fn format_visibility_measure(measure: VisibilityMeasure) -> String {
    format!("Visibility {}.", visibility_measure_text(measure))
}

fn visibility_measure_text(measure: VisibilityMeasure) -> String {
    match measure {
        VisibilityMeasure::Unlimited => "10 km or more".to_string(),
        VisibilityMeasure::Meters(meters) => {
            if meters >= 10_000 {
                "10 km or more".to_string()
            } else if meters >= 6_000 {
                format!("{} km", round_visibility_km(meters as f64 / 1000.0))
            } else {
                format!("{:04} meters", round_visibility_meters(meters))
            }
        }
        VisibilityMeasure::StatuteMiles(statute_miles) => {
            let kilometers = statute_miles * MILES_TO_KM;
            if kilometers >= 10.0 {
                "10 km or more".to_string()
            } else if kilometers >= 6.0 {
                format!("{} km", round_visibility_km(kilometers))
            } else {
                let meters = (statute_miles * MILES_TO_METERS).round() as i64;
                format!("{:04} meters", round_visibility_meters(meters))
            }
        }
    }
}

fn round_visibility_km(kilometers: f64) -> i64 {
    kilometers.round() as i64
}

fn round_visibility_meters(meters: i64) -> i64 {
    ((meters + 50) / 100) * 100
}

fn number_to_atis(value: i64) -> String {
    if value < 0 {
        return format!("minus {}", number_to_atis(-value));
    }

    value
        .to_string()
        .chars()
        .map(digit_to_word)
        .collect::<Vec<_>>()
        .join(" ")
}

fn digit_to_word(digit: char) -> &'static str {
    match digit {
        '0' => "zero",
        '1' => "one",
        '2' => "two",
        '3' => "three",
        '4' => "four",
        '5' => "five",
        '6' => "six",
        '7' => "seven",
        '8' => "eight",
        '9' => "niner",
        _ => "",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use aip_domain::{AirportInfoSummary, LatLon, NoaaWeatherSupplement, WeatherCloudLayer};

    fn sample_runway(runway_name: &str, heading_deg: f64, lon: f64, lat: f64) -> AirportRunwayEnd {
        AirportRunwayEnd {
            runway_name: runway_name.to_string(),
            reciprocal_runway_name: "XX".to_string(),
            heading_deg,
            length_ft: 12000.0,
            width_ft: 180.0,
            surface: Some("ASP".to_string()),
            is_takeoff: true,
            is_landing: true,
            ils_ident: Some(format!("I{runway_name}")),
            location: LatLon { lon, lat },
        }
    }

    fn sample_metar_knots() -> MetarObservation {
        MetarObservation {
            icao_id: "VHHH".to_string(),
            station_name: Some("Hong Kong".to_string()),
            observed_at_unix: Some(1_714_410_000),
            received_at: None,
            reported_at: None,
            raw_text: "VHHH 291700Z 11014G28KT 340V040 3400 -SHRA FEW007 SCT018 BKN050 26/25 Q0994"
                .to_string(),
            flight_category: Some("MVFR".to_string()),
            metar_type: None,
            temperature_c: Some(26.0),
            dewpoint_c: Some(25.0),
            wind_direction: Some("110".to_string()),
            wind_speed_kt: Some(14),
            wind_gust_kt: Some(28),
            visibility_sm: Some("3400".to_string()),
            altimeter_hpa: Some(994.0),
            sea_level_pressure_hpa: None,
            weather: Some("-SHRA".to_string()),
            vertical_visibility_ft: None,
            precipitation_last_hour_in: None,
            precipitation_last_3h_in: None,
            precipitation_last_6h_in: None,
            precipitation_last_24h_in: None,
            clouds: vec![
                WeatherCloudLayer {
                    cover: "FEW".to_string(),
                    base_ft: Some(700),
                    top_ft: None,
                },
                WeatherCloudLayer {
                    cover: "SCT".to_string(),
                    base_ft: Some(1800),
                    top_ft: None,
                },
                WeatherCloudLayer {
                    cover: "BKN".to_string(),
                    base_ft: Some(5000),
                    top_ft: None,
                },
            ],
        }
    }

    fn sample_overview() -> AirportWeatherOverviewResponse {
        AirportWeatherOverviewResponse {
            requested_id: "VHHH".to_string(),
            resolved_id: "VHHH".to_string(),
            airport: Some(AirportInfoSummary {
                icao_id: Some("VHHH".to_string()),
                iata_id: None,
                faa_id: None,
                name: "Hong Kong".to_string(),
                state: None,
                country: Some("CN".to_string()),
                source: None,
                airport_type: None,
                latitude: Some(22.3089),
                longitude: Some(113.9146),
                elevation_ft: Some(28.0),
                magnetic_declination: None,
                owner: None,
                runway_count: 2,
            }),
            station: None,
            metar: Some(sample_metar_knots()),
            taf: None,
            communications: vec![AirportCommunication {
                service_type: "app".to_string(),
                label: "APP".to_string(),
                name: Some("HONG KONG".to_string()),
                frequency_mhz: 119.100,
            }],
            generated_atis: None,
            noaa: NoaaWeatherSupplement {
                current_raw: None,
                current_decoded: None,
                recent_cycles: Vec::new(),
            },
            warnings: Vec::new(),
        }
    }

    #[test]
    fn uses_headwind_runway_family_for_north_flow() {
        let runways = vec![
            sample_runway("36L", 353.0, 0.00, 0.00),
            sample_runway("36R", 353.0, 0.02, 0.00),
            sample_runway("18L", 173.0, 0.00, 0.01),
            sample_runway("18R", 173.0, 0.02, 0.01),
        ];

        let selected = select_active_runways(
            &runways,
            &parse_wind(&sample_metar_knots()),
            AtisOperation::Arrival,
        );
        let names = selected
            .iter()
            .map(|runway| runway.runway_name.as_str())
            .collect::<Vec<_>>();

        assert_eq!(names, vec!["18L", "18R"]);
    }

    #[test]
    fn applies_inner_departure_outer_arrival_rule_for_three_parallels() {
        let runways = vec![
            sample_runway("36L", 353.0, -0.02, 0.00),
            sample_runway("36C", 353.0, 0.00, 0.00),
            sample_runway("36R", 353.0, 0.02, 0.00),
        ];

        let departure = apply_parallel_runway_rules(runways.clone(), AtisOperation::Departure);
        let arrival = apply_parallel_runway_rules(runways, AtisOperation::Arrival);

        assert_eq!(departure.len(), 1);
        assert_eq!(departure[0].runway_name, "36C");
        assert_eq!(
            arrival
                .iter()
                .map(|runway| runway.runway_name.as_str())
                .collect::<Vec<_>>(),
            vec!["36L", "36R"]
        );
    }

    #[test]
    fn decodes_cloud_phrase_in_atis_style() {
        let metar = sample_metar_knots();
        let sentence = format_clouds_sentence(&metar).expect("cloud sentence");
        assert!(sentence.contains("Few zero thousand seven hundred"));
        assert!(sentence.contains("Scattered one thousand eight hundred"));
        assert!(sentence.contains("Broken five thousand"));
    }

    #[test]
    fn generated_arrival_text_matches_atis_structure() {
        let overview = sample_overview();
        let runways = vec![sample_runway("07L", 73.0, 0.0, 0.0)];
        let bundle = build_generated_atis(&overview, &runways).expect("generated atis");

        assert!(bundle
            .arrival
            .text
            .contains("Hong Kong Arrival information"));
        assert!(bundle.arrival.text.contains("At time 1700Z."));
        assert!(bundle.arrival.text.contains("ILS Runway 07L approach."));
        assert!(bundle.arrival.text.contains("Landing Runway 07L."));
        assert!(bundle.arrival.text.contains("Runway surface wet."));
        assert!(bundle
            .arrival
            .text
            .contains("Wind 110 degrees at 14 knots maximum 28."));
        assert!(bundle
            .arrival
            .text
            .contains("Direction variable between 340 and 040."));
        assert!(bundle.arrival.text.contains("Visibility 3400 meters."));
        assert!(bundle
            .arrival
            .text
            .contains("Temperature 26, dew point 25."));
        assert!(bundle.arrival.text.contains("QNH 994 HPa."));
        assert!(bundle.arrival.text.contains("Acknowledge information"));
    }

    #[test]
    fn uses_inhg_when_raw_metar_reports_altimeter_in_inches() {
        let mut overview = sample_overview();
        overview.metar = Some(MetarObservation {
            raw_text: "KJFK 291700Z 18006KT 10SM FEW015 20/15 A2980".to_string(),
            altimeter_hpa: Some(1009.0),
            visibility_sm: Some("10".to_string()),
            wind_direction: Some("180".to_string()),
            wind_speed_kt: Some(6),
            wind_gust_kt: None,
            temperature_c: Some(20.0),
            dewpoint_c: Some(15.0),
            weather: None,
            clouds: vec![WeatherCloudLayer {
                cover: "FEW".to_string(),
                base_ft: Some(1500),
                top_ft: None,
            }],
            ..sample_metar_knots()
        });

        let sentence = format_pressure_sentence(overview.metar.as_ref().expect("metar"), &overview)
            .expect("pressure sentence");

        assert!(sentence.contains("QNH 29.80 InHg."));
    }

    #[test]
    fn formats_cavok_as_ten_km_or_more() {
        let metar = MetarObservation {
            raw_text: "EGLL 291720Z AUTO 26008KT CAVOK 18/07 Q1018".to_string(),
            visibility_sm: Some("6+".to_string()),
            altimeter_hpa: Some(1018.0),
            wind_direction: Some("260".to_string()),
            wind_speed_kt: Some(8),
            temperature_c: Some(18.0),
            dewpoint_c: Some(7.0),
            ..sample_metar_knots()
        };

        let sentence = format_visibility_sentence(&metar).expect("visibility sentence");
        assert_eq!(sentence, "Visibility 10 km or more.");
    }
}
