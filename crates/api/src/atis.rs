mod phrasing;
mod runways;
#[cfg(test)]
mod tests;
mod weather;

use aip_domain::{
    AirportCommunication, AirportRunwayEnd, AirportWeatherOverviewResponse, GeneratedAtisBundle,
    GeneratedAtisReport, GeneratedAtisType, MetarObservation, TafForecastSegment,
    WeatherCloudLayer,
};
use chrono::{Datelike, TimeZone, Timelike, Utc};
use std::collections::HashSet;

use phrasing::*;
use runways::*;
use weather::*;

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
enum ReportMode {
    Combined,
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
    let is_combined = physical_runway_count(runway_ends) <= 2;

    if departure_runways.is_empty() && arrival_runways.is_empty() {
        return None;
    }

    let departure_contacts = select_contacts(&overview.communications, AtisOperation::Departure);
    let arrival_contacts = select_contacts(&overview.communications, AtisOperation::Arrival);

    if is_combined {
        let combined_contacts = if !departure_contacts.is_empty() {
            departure_contacts
        } else {
            arrival_contacts
        };
        let combined_report = build_report(
            &airport_name,
            metar,
            overview,
            ReportMode::Combined,
            &information_code,
            issued_at,
            &parsed_wind,
            &departure_runways,
            &arrival_runways,
            combined_contacts,
        );

        return Some(GeneratedAtisBundle {
            is_combined: true,
            departure: combined_report.clone(),
            arrival: combined_report,
        });
    }

    Some(GeneratedAtisBundle {
        departure: build_report(
            &airport_name,
            metar,
            overview,
            ReportMode::Departure,
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
            ReportMode::Arrival,
            &information_code,
            issued_at,
            &parsed_wind,
            &departure_runways,
            &arrival_runways,
            arrival_contacts,
        ),
        is_combined: false,
    })
}

fn build_report(
    airport_name: &str,
    metar: &MetarObservation,
    overview: &AirportWeatherOverviewResponse,
    mode: ReportMode,
    information_code: &str,
    issued_at: Option<String>,
    parsed_wind: &ParsedWind,
    departure_runways: &[AirportRunwayEnd],
    arrival_runways: &[AirportRunwayEnd],
    contacts: Vec<AirportCommunication>,
) -> GeneratedAtisReport {
    let airport_title = normalize_airport_name(airport_name);
    let report_type_label = match mode {
        ReportMode::Combined => None,
        ReportMode::Departure => Some("Departure"),
        ReportMode::Arrival => Some("Arrival"),
    };
    let active_runways = match mode {
        ReportMode::Combined => {
            if !departure_runways.is_empty() {
                departure_runways
            } else {
                arrival_runways
            }
        }
        ReportMode::Departure => departure_runways,
        ReportMode::Arrival => arrival_runways,
    };
    let runways_in_use = if matches!(mode, ReportMode::Combined) {
        merged_runway_names(arrival_runways, departure_runways)
    } else {
        active_runways
            .iter()
            .map(|runway| runway.runway_name.clone())
            .collect::<Vec<_>>()
    };

    let mut lines = vec![match report_type_label {
        Some(report_type_label) => {
            format!("{airport_title} {report_type_label} information {information_code}.")
        }
        None => format!("{airport_title} information {information_code}."),
    }];

    if let Some(issued_at) = issued_at.as_deref() {
        lines.push(format!("At time {issued_at}."));
    }

    if matches!(mode, ReportMode::Arrival | ReportMode::Combined) {
        if let Some(approach_sentence) = format_expected_approach(arrival_runways) {
            lines.push(approach_sentence);
        }
    }

    if let Some(runway_sentence) =
        format_runway_use_sentence(arrival_runways, departure_runways, mode)
    {
        lines.push(runway_sentence);
    }

    if let Some(contact_sentence) = format_frequency_notice(&contacts, active_runways, mode) {
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

    lines.push(match mode {
        ReportMode::Arrival => {
            format!("Acknowledge information {information_code} on first contact with Approach.")
        }
        ReportMode::Departure => {
            format!("Advise you have information {information_code} when requesting clearance.")
        }
        ReportMode::Combined => format!("Advise you have information {information_code}."),
    });

    GeneratedAtisReport {
        atis_type: match mode {
            ReportMode::Combined => GeneratedAtisType::Combined,
            ReportMode::Departure => GeneratedAtisType::Departure,
            ReportMode::Arrival => GeneratedAtisType::Arrival,
        },
        information_code: information_code.to_string(),
        issued_at,
        runways_in_use,
        contacts,
        text: lines.join(" "),
    }
}
