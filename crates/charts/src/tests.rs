use aip_domain::EaipChartScope;

use crate::catalog::{build_chart_record, chart_category_rank};

#[test]
fn builds_airport_chart_metadata_from_terminal_path() {
    let record = build_chart_record(
        "Terminal/ZSSS/SID/ZSSS-7F-SID RNAV RWY36L-36R(ADBAS-NXD-SASAN-PIKAS).pdf",
    )
    .expect("airport chart should parse");

    assert_eq!(record.summary.scope, EaipChartScope::Airport);
    assert_eq!(record.summary.airport_icao.as_deref(), Some("ZSSS"));
    assert_eq!(record.summary.category, "SID");
    assert!(record.summary.chart_id.chars().all(|character| {
        character.is_ascii_alphanumeric() || character == '-' || character == '_'
    }));
}

#[test]
fn builds_general_chart_metadata() {
    let record =
        build_chart_record("GeneralDoc/AIP SUP 01 2026.pdf").expect("general chart should parse");

    assert_eq!(record.summary.scope, EaipChartScope::General);
    assert_eq!(record.summary.category, "GENERALDOC");
    assert_eq!(record.summary.airport_icao, None);
}

#[test]
fn ignores_non_pdf_entries() {
    assert!(build_chart_record("Terminal/ZBAA/notes.txt").is_none());
}

#[test]
fn builds_chart_metadata_from_prefixed_terminal_path() {
    let record = build_chart_record(
        "EAIP2026-04.V1.4/Terminal/ZSSS/SID/ZSSS-7F-SID RNAV RWY36L-36R(ADBAS).pdf",
    )
    .expect("prefixed airport chart should parse");

    assert_eq!(record.summary.scope, EaipChartScope::Airport);
    assert_eq!(record.summary.airport_icao.as_deref(), Some("ZSSS"));
    assert_eq!(record.summary.category, "SID");
}

#[test]
fn builds_enroute_chart_metadata_from_prefixed_path() {
    let record = build_chart_record("EAIP2026-04.V1.4/ENR/AREA/route.pdf")
        .expect("prefixed enroute chart should parse");

    assert_eq!(record.summary.scope, EaipChartScope::Enroute);
    assert_eq!(record.summary.airport_icao, None);
    assert_eq!(record.summary.category, "AREA");
}

#[test]
fn category_rank_prioritizes_ground_and_terminal_charts() {
    assert!(chart_category_rank("ADC") < chart_category_rank("SID"));
    assert!(chart_category_rank("SID") < chart_category_rank("STAR"));
}
