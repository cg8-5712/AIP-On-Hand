use aip_domain::{
    AirportCommunication, AirportRunwayEnd, AirportWeatherOverviewResponse, GeneratedAtisBundle,
    GeneratedAtisReport, GeneratedAtisType, MetarObservation,
};
use chrono::{Datelike, TimeZone, Timelike, Utc};

const PARALLEL_HEADING_TOLERANCE_DEG: f64 = 12.0;
const LIGHT_AND_VARIABLE_WIND_KT: i64 = 3;
const NATO_INFORMATION_CODES: [&str; 26] = [
    "ALPHA", "BRAVO", "CHARLIE", "DELTA", "ECHO", "FOXTROT", "GOLF", "HOTEL", "INDIA", "JULIETT",
    "KILO", "LIMA", "MIKE", "NOVEMBER", "OSCAR", "PAPA", "QUEBEC", "ROMEO", "SIERRA", "TANGO",
    "UNIFORM", "VICTOR", "WHISKEY", "XRAY", "YANKEE", "ZULU",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum AtisOperation {
    Departure,
    Arrival,
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
    let issued_at = derive_issued_at(metar);
    let is_large_airport = runway_ends.len() >= 4 || overview.communications.len() >= 10;

    let departure_runways = select_active_runways(runway_ends, metar, AtisOperation::Departure);
    let arrival_runways = select_active_runways(runway_ends, metar, AtisOperation::Arrival);

    if departure_runways.is_empty() && arrival_runways.is_empty() {
        return None;
    }

    let departure_contacts = select_contacts(
        &overview.communications,
        AtisOperation::Departure,
        is_large_airport,
    );
    let arrival_contacts = select_contacts(
        &overview.communications,
        AtisOperation::Arrival,
        is_large_airport,
    );

    Some(GeneratedAtisBundle {
        departure: build_report(
            &airport_ident,
            &airport_name,
            metar,
            AtisOperation::Departure,
            &information_code,
            issued_at.clone(),
            &departure_runways,
            departure_contacts,
        ),
        arrival: build_report(
            &airport_ident,
            &airport_name,
            metar,
            AtisOperation::Arrival,
            &information_code,
            issued_at,
            &arrival_runways,
            arrival_contacts,
        ),
    })
}

fn build_report(
    airport_ident: &str,
    airport_name: &str,
    metar: &MetarObservation,
    operation: AtisOperation,
    information_code: &str,
    issued_at: Option<String>,
    runways: &[AirportRunwayEnd],
    contacts: Vec<AirportCommunication>,
) -> GeneratedAtisReport {
    let runway_names = runways
        .iter()
        .map(|runway| runway.runway_name.clone())
        .collect::<Vec<_>>();
    let operation_label = match operation {
        AtisOperation::Departure => "DEPARTURE",
        AtisOperation::Arrival => "ARRIVAL",
    };
    let airport_title = if airport_name.trim().is_empty() {
        airport_ident.trim().to_uppercase()
    } else {
        airport_name.trim().to_uppercase()
    };

    let mut lines = vec![format!(
        "{} {} INFORMATION {}.",
        airport_title, operation_label, information_code
    )];

    if let Some(issued_at) = issued_at.as_deref() {
        lines.push(format!("Time {}.", issued_at));
    }

    if !runway_names.is_empty() {
        lines.push(format!(
            "{} {} in use for {}.",
            if runway_names.len() == 1 {
                "Runway"
            } else {
                "Runways"
            },
            join_with_and(&runway_names),
            match operation {
                AtisOperation::Departure => "departure",
                AtisOperation::Arrival => "arrival",
            }
        ));
    }

    if let Some(sentence) = format_wind_sentence(metar) {
        lines.push(sentence);
    }
    if let Some(sentence) = format_visibility_sentence(metar) {
        lines.push(sentence);
    }
    if let Some(sentence) = format_weather_sentence(metar) {
        lines.push(sentence);
    }
    if let Some(sentence) = format_clouds_sentence(metar) {
        lines.push(sentence);
    }
    if let Some(sentence) = format_temperature_sentence(metar) {
        lines.push(sentence);
    }
    if let Some(sentence) = format_qnh_sentence(metar) {
        lines.push(sentence);
    }
    if !contacts.is_empty() {
        lines.push(format!("Contact {}.", format_contact_list(&contacts)));
    }

    lines.push(format!(
        "Advise on initial contact you have information {}.",
        information_code
    ));

    GeneratedAtisReport {
        atis_type: match operation {
            AtisOperation::Departure => GeneratedAtisType::Departure,
            AtisOperation::Arrival => GeneratedAtisType::Arrival,
        },
        information_code: information_code.to_string(),
        issued_at,
        runways_in_use: runway_names,
        contacts,
        text: lines.join(" "),
    }
}

fn select_active_runways(
    runway_ends: &[AirportRunwayEnd],
    metar: &MetarObservation,
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
            runway_anchor_score(left, metar, operation)
                .total_cmp(&runway_anchor_score(right, metar, operation))
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
    metar: &MetarObservation,
    operation: AtisOperation,
) -> f64 {
    let mut score = runway.length_ft / 1000.0;
    if matches!(operation, AtisOperation::Arrival) && runway.ils_ident.is_some() {
        score += 2.5;
    }

    if let Some(headwind_component) = headwind_component_kt(runway.heading_deg, metar) {
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

fn headwind_component_kt(runway_heading_deg: f64, metar: &MetarObservation) -> Option<f64> {
    let wind_direction = parse_wind_direction_deg(metar.wind_direction.as_deref())?;
    let wind_speed = metar.wind_speed_kt?;
    if wind_speed <= LIGHT_AND_VARIABLE_WIND_KT {
        return None;
    }

    let delta_radians = heading_difference_deg(runway_heading_deg, wind_direction).to_radians();
    Some((wind_speed as f64) * delta_radians.cos())
}

fn parse_wind_direction_deg(raw_direction: Option<&str>) -> Option<f64> {
    let raw_direction = raw_direction?.trim();
    if raw_direction.is_empty() {
        return None;
    }

    match raw_direction.to_uppercase().as_str() {
        "VRB" | "VAR" => None,
        _ => raw_direction.parse::<f64>().ok(),
    }
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

fn derive_issued_at(metar: &MetarObservation) -> Option<String> {
    let observed_at_unix = metar.observed_at_unix?;
    let timestamp = Utc.timestamp_opt(observed_at_unix, 0).single()?;
    Some(format!("{:02}{:02}Z", timestamp.hour(), timestamp.minute()))
}

fn format_wind_sentence(metar: &MetarObservation) -> Option<String> {
    let direction = metar.wind_direction.as_deref().map(str::trim);
    let speed = metar.wind_speed_kt;
    let gust = metar.wind_gust_kt;

    if direction.is_none() && speed.is_none() {
        return None;
    }

    let direction_text = match direction {
        Some("VRB") | Some("VAR") => "variable".to_string(),
        Some(value) if !value.is_empty() => format!("{value:0>3}"),
        _ => "variable".to_string(),
    };

    let mut sentence = if let Some(speed) = speed {
        format!("Wind {direction_text} at {speed} knots")
    } else {
        format!("Wind {direction_text}")
    };

    if let Some(gust) = gust {
        sentence.push_str(&format!(" gusting {gust}"));
    }

    Some(format!("{sentence}."))
}

fn format_visibility_sentence(metar: &MetarObservation) -> Option<String> {
    metar
        .visibility_sm
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| format!("Visibility {value}."))
}

fn format_weather_sentence(metar: &MetarObservation) -> Option<String> {
    metar
        .weather
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| format!("Weather {value}."))
}

fn format_clouds_sentence(metar: &MetarObservation) -> Option<String> {
    if metar.clouds.is_empty() && metar.vertical_visibility_ft.is_none() {
        return None;
    }

    let mut parts = metar
        .clouds
        .iter()
        .map(|layer| match layer.base_ft {
            Some(base_ft) => format!("{}{:03}", layer.cover.to_uppercase(), base_ft / 100),
            None => layer.cover.to_uppercase(),
        })
        .collect::<Vec<_>>();

    if let Some(vertical_visibility_ft) = metar.vertical_visibility_ft {
        parts.push(format!("VV{:03}", vertical_visibility_ft / 100));
    }

    Some(format!("Clouds {}.", parts.join(", ")))
}

fn format_temperature_sentence(metar: &MetarObservation) -> Option<String> {
    match (metar.temperature_c, metar.dewpoint_c) {
        (Some(temperature), Some(dewpoint)) => Some(format!(
            "Temperature {}, dew point {}.",
            format_signed_temperature(temperature),
            format_signed_temperature(dewpoint)
        )),
        (Some(temperature), None) => Some(format!(
            "Temperature {}.",
            format_signed_temperature(temperature)
        )),
        _ => None,
    }
}

fn format_signed_temperature(value: f64) -> String {
    if value.fract().abs() < f64::EPSILON {
        format!("{}", value as i64)
    } else {
        format!("{value:.1}")
    }
}

fn format_qnh_sentence(metar: &MetarObservation) -> Option<String> {
    metar
        .altimeter_hpa
        .map(|altimeter_hpa| format!("QNH {}.", altimeter_hpa.round() as i64))
}

fn select_contacts(
    communications: &[AirportCommunication],
    operation: AtisOperation,
    is_large_airport: bool,
) -> Vec<AirportCommunication> {
    let mut contacts = Vec::new();

    match operation {
        AtisOperation::Departure => {
            contacts.extend(pick_contacts(communications, &["clr"], 1));
            contacts.extend(pick_contacts(communications, &["gnd"], 1));
            contacts.extend(pick_contacts(communications, &["twr"], 1));
            contacts.extend(pick_contacts(
                communications,
                &["dep", "app"],
                if is_large_airport { 2 } else { 1 },
            ));
        }
        AtisOperation::Arrival => {
            contacts.extend(pick_contacts(
                communications,
                &["app", "dep"],
                if is_large_airport { 2 } else { 1 },
            ));
            contacts.extend(pick_contacts(communications, &["twr"], 1));
            contacts.extend(pick_contacts(communications, &["gnd"], 1));
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
    let mut seen = std::collections::HashSet::new();

    for contact in contacts {
        let key = format!("{}:{:.3}", contact.service_type, contact.frequency_mhz);
        if seen.insert(key) {
            deduped.push(contact);
        }
    }

    deduped
}

fn format_contact_list(contacts: &[AirportCommunication]) -> String {
    join_with_and(&contacts.iter().map(format_contact).collect::<Vec<_>>())
}

fn format_contact(contact: &AirportCommunication) -> String {
    let service_label = match contact.service_type.as_str() {
        "app" => "approach".to_string(),
        "dep" => "departure".to_string(),
        "clr" => "clearance delivery".to_string(),
        "twr" => "tower".to_string(),
        "gnd" => "ground".to_string(),
        "rmp" => "ramp".to_string(),
        "ops" => "operations".to_string(),
        _ => contact.label.to_lowercase(),
    };

    format!("{service_label} {:.3}", contact.frequency_mhz)
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

#[cfg(test)]
mod tests {
    use super::*;
    use aip_domain::{LatLon, WeatherCloudLayer};

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

    fn sample_metar(wind_direction: &str, wind_speed_kt: i64) -> MetarObservation {
        MetarObservation {
            icao_id: "ZBAA".to_string(),
            station_name: Some("Beijing".to_string()),
            observed_at_unix: Some(1_714_410_000),
            received_at: None,
            reported_at: None,
            raw_text: "ZBAA 291700Z 35012KT 9999 SCT020 18/06 Q1018".to_string(),
            flight_category: Some("VFR".to_string()),
            metar_type: None,
            temperature_c: Some(18.0),
            dewpoint_c: Some(6.0),
            wind_direction: Some(wind_direction.to_string()),
            wind_speed_kt: Some(wind_speed_kt),
            wind_gust_kt: Some(18),
            visibility_sm: Some("10+".to_string()),
            altimeter_hpa: Some(1018.0),
            sea_level_pressure_hpa: None,
            weather: Some("-RA".to_string()),
            vertical_visibility_ft: None,
            precipitation_last_hour_in: None,
            precipitation_last_3h_in: None,
            precipitation_last_6h_in: None,
            precipitation_last_24h_in: None,
            clouds: vec![WeatherCloudLayer {
                cover: "SCT".to_string(),
                base_ft: Some(2000),
                top_ft: None,
            }],
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

        let selected =
            select_active_runways(&runways, &sample_metar("350", 12), AtisOperation::Arrival);
        let names = selected
            .iter()
            .map(|runway| runway.runway_name.as_str())
            .collect::<Vec<_>>();

        assert_eq!(names, vec!["36L", "36R"]);
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
    fn falls_back_to_approach_when_departure_frequency_is_missing() {
        let contacts = select_contacts(
            &[
                AirportCommunication {
                    service_type: "clr".to_string(),
                    label: "CLR".to_string(),
                    name: Some("BEIJING".to_string()),
                    frequency_mhz: 121.600,
                },
                AirportCommunication {
                    service_type: "app".to_string(),
                    label: "APP".to_string(),
                    name: Some("BEIJING".to_string()),
                    frequency_mhz: 119.000,
                },
            ],
            AtisOperation::Departure,
            true,
        );

        assert!(contacts.iter().any(|contact| contact.service_type == "app"));
        assert!(!contacts.iter().any(|contact| contact.service_type == "dep"));
    }

    #[test]
    fn generated_text_contains_runway_and_contact_lines() {
        let report = build_report(
            "ZBAA",
            "Beijing Capital",
            &sample_metar("350", 12),
            AtisOperation::Departure,
            "ALPHA",
            Some("1700Z".to_string()),
            &[sample_runway("36C", 353.0, 0.0, 0.0)],
            vec![AirportCommunication {
                service_type: "twr".to_string(),
                label: "TWR".to_string(),
                name: Some("BEIJING".to_string()),
                frequency_mhz: 118.050,
            }],
        );

        assert!(report
            .text
            .contains("BEIJING CAPITAL DEPARTURE INFORMATION ALPHA."));
        assert!(report.text.contains("Runway 36C in use for departure."));
        assert!(report.text.contains("Contact tower 118.050."));
    }
}
