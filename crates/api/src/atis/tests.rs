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
    let runways = vec![
        sample_runway("07L", 73.0, -0.02, 0.0),
        sample_runway("07C", 73.0, 0.00, 0.0),
        sample_runway("07R", 73.0, 0.02, 0.0),
    ];
    let bundle = build_generated_atis(&overview, &runways).expect("generated atis");

    assert!(!bundle.is_combined);
    assert!(bundle
        .arrival
        .text
        .contains("Hong Kong Arrival information"));
    assert!(bundle.arrival.text.contains("At time 1700Z."));
    assert!(bundle.arrival.text.contains("ILS Runway 07L approach."));
    assert!(bundle
        .arrival
        .text
        .contains("Landing Runway 07L and 07R, Departure Runway 07C."));
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
fn generates_single_combined_atis_for_small_airports() {
    let overview = sample_overview();
    let runways = vec![sample_runway("07L", 73.0, 0.0, 0.0)];
    let bundle = build_generated_atis(&overview, &runways).expect("generated atis");

    assert!(bundle.is_combined);
    assert_eq!(bundle.departure.atis_type, GeneratedAtisType::Combined);
    assert_eq!(bundle.departure.text, bundle.arrival.text);
    assert!(bundle.departure.text.contains("Hong Kong information"));
    assert!(bundle.departure.text.contains("Runway 07L in use."));
    assert!(!bundle
        .departure
        .text
        .contains("Landing Runway 07L, Departure Runway 07L."));
}

#[test]
fn does_not_repeat_same_runway_for_arrival_and_departure_reports() {
    let runway = sample_runway("33", 330.0, 0.0, 0.0);
    let arrival_sentence = format_runway_use_sentence(
        std::slice::from_ref(&runway),
        std::slice::from_ref(&runway),
        ReportMode::Arrival,
    )
    .expect("arrival runway sentence");
    let departure_sentence = format_runway_use_sentence(
        std::slice::from_ref(&runway),
        std::slice::from_ref(&runway),
        ReportMode::Departure,
    )
    .expect("departure runway sentence");

    assert_eq!(arrival_sentence, "Landing Runway 33.");
    assert_eq!(departure_sentence, "Departure Runway 33.");
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
