use aip_domain::{EaipChartScope, EaipChartSummary, EaipStatusResponse};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use std::{collections::HashMap, path::Path, sync::Mutex};

use crate::{
    error::ChartError,
    model::{ChartRecord, PackageAccessReader, ReadyStore},
};

pub(crate) fn build_ready_store(
    reader: PackageAccessReader,
    package_file: String,
    memory_only: bool,
    source: String,
) -> Result<ReadyStore, ChartError> {
    let cycle = match &reader {
        PackageAccessReader::File(reader) => reader.header.cycle,
        PackageAccessReader::Memory(reader) => reader.header.cycle,
    };

    let mut chart_records = collect_chart_records(&reader);
    chart_records.sort_by(chart_sort_key);
    let chart_count = chart_records.len();

    let mut charts_by_id = HashMap::with_capacity(chart_records.len());
    let mut charts_by_airport: HashMap<String, Vec<usize>> = HashMap::new();
    let mut general_document_count = 0usize;
    let mut enroute_document_count = 0usize;

    for (index, record) in chart_records.iter().enumerate() {
        charts_by_id.insert(record.summary.chart_id.clone(), index);

        match record.summary.scope {
            EaipChartScope::Airport => {
                if let Some(airport_icao) = &record.summary.airport_icao {
                    charts_by_airport
                        .entry(airport_icao.clone())
                        .or_default()
                        .push(index);
                }
            }
            EaipChartScope::General => general_document_count += 1,
            EaipChartScope::Enroute => enroute_document_count += 1,
            EaipChartScope::Other => {}
        }
    }

    let airport_count = charts_by_airport.len();

    Ok(ReadyStore {
        reader: Mutex::new(reader),
        chart_records,
        charts_by_id,
        charts_by_airport,
        status: EaipStatusResponse {
            configured: true,
            ready: true,
            package_file: Some(package_file),
            cycle: Some(cycle),
            chart_count,
            airport_count,
            general_document_count,
            enroute_document_count,
            max_upload_bytes: 0,
            memory_only,
            source,
            message: None,
        },
    })
}

fn collect_chart_records(reader: &PackageAccessReader) -> Vec<ChartRecord> {
    let mut paths = match reader {
        PackageAccessReader::File(reader) => {
            reader.index.lookup.keys().cloned().collect::<Vec<_>>()
        }
        PackageAccessReader::Memory(reader) => {
            reader.index.lookup.keys().cloned().collect::<Vec<_>>()
        }
    };
    paths.sort();

    paths
        .into_iter()
        .filter_map(|path| build_chart_record(&path))
        .collect()
}

pub(crate) fn build_chart_record(path: &str) -> Option<ChartRecord> {
    let normalized_path = path.trim().replace('\\', "/");
    if normalized_path.is_empty() || !normalized_path.to_ascii_lowercase().ends_with(".pdf") {
        return None;
    }

    let segments = normalized_path
        .split('/')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>();
    if segments.is_empty() {
        return None;
    }

    let (scope_anchor, scope) = resolve_chart_scope(&segments);
    let airport_icao = airport_icao_for_segments(scope, &segments, scope_anchor);
    let file_name = segments.last()?.to_string();
    let title = file_name
        .strip_suffix(".pdf")
        .or_else(|| file_name.strip_suffix(".PDF"))
        .unwrap_or(&file_name)
        .to_string();
    let category = chart_category(scope, &segments, scope_anchor);

    Some(ChartRecord {
        internal_path: normalized_path.clone(),
        summary: EaipChartSummary {
            chart_id: encode_chart_id(&normalized_path),
            scope,
            airport_icao,
            category,
            title,
            file_name: file_name.clone(),
            is_merged: file_name.to_ascii_uppercase().contains("-MERGED"),
        },
    })
}

fn resolve_chart_scope(segments: &[&str]) -> (Option<usize>, EaipChartScope) {
    for (index, segment) in segments.iter().enumerate() {
        match segment.trim().to_ascii_uppercase().as_str() {
            "TERMINAL" => return (Some(index), EaipChartScope::Airport),
            "ENR" => return (Some(index), EaipChartScope::Enroute),
            "GENERALDOC" => return (Some(index), EaipChartScope::General),
            _ => {}
        }
    }

    (None, EaipChartScope::Other)
}

fn non_file_segment(segments: &[&str], index: usize) -> Option<String> {
    if index >= segments.len().saturating_sub(1) {
        return None;
    }

    let normalized = segments[index].trim().to_ascii_uppercase();
    if normalized.is_empty() {
        return None;
    }

    Some(normalized)
}

fn airport_icao_for_segments(
    scope: EaipChartScope,
    segments: &[&str],
    anchor: Option<usize>,
) -> Option<String> {
    let Some(anchor) = anchor else {
        return None;
    };
    if scope != EaipChartScope::Airport {
        return None;
    }

    non_file_segment(segments, anchor + 1)
}

fn chart_category(scope: EaipChartScope, segments: &[&str], anchor: Option<usize>) -> String {
    match scope {
        EaipChartScope::Airport => anchor
            .and_then(|index| non_file_segment(segments, index + 2))
            .unwrap_or_else(|| "TERMINAL".to_string()),
        EaipChartScope::Enroute => anchor
            .and_then(|index| non_file_segment(segments, index + 1))
            .unwrap_or_else(|| "ENR".to_string()),
        EaipChartScope::General => anchor
            .and_then(|index| non_file_segment(segments, index + 1))
            .unwrap_or_else(|| "GENERALDOC".to_string()),
        EaipChartScope::Other => {
            if let Some(anchor) = anchor {
                return segments[anchor].trim().to_ascii_uppercase();
            }

            segments
                .first()
                .map(|segment| segment.trim().to_ascii_uppercase())
                .filter(|segment| !segment.is_empty())
                .unwrap_or_else(|| "OTHER".to_string())
        }
    }
}

fn chart_sort_key(left: &ChartRecord, right: &ChartRecord) -> std::cmp::Ordering {
    (
        left.summary.airport_icao.as_deref().unwrap_or_default(),
        chart_category_rank(&left.summary.category),
        left.summary.category.as_str(),
        left.summary.title.as_str(),
    )
        .cmp(&(
            right.summary.airport_icao.as_deref().unwrap_or_default(),
            chart_category_rank(&right.summary.category),
            right.summary.category.as_str(),
            right.summary.title.as_str(),
        ))
}

pub(crate) fn chart_category_rank(category: &str) -> usize {
    match category {
        "ADC" => 0,
        "APDC" => 1,
        "GMC" => 2,
        "PARKING" => 3,
        "SID" => 10,
        "STAR" => 11,
        "IAC" => 12,
        "VAC" => 13,
        "AOC" => 14,
        "GENERALDOC" => 20,
        "ENR" => 21,
        _ => 99,
    }
}

pub(crate) fn normalize_airport_code(value: &str) -> Result<String, ChartError> {
    let normalized = value.trim().to_ascii_uppercase();
    if normalized.is_empty() {
        return Err(ChartError::InvalidInput(
            "airport identifier must not be blank".to_string(),
        ));
    }

    Ok(normalized)
}

fn encode_chart_id(path: &str) -> String {
    URL_SAFE_NO_PAD.encode(path.as_bytes())
}

pub(crate) fn package_file_name(path: &Path) -> Option<String> {
    path.file_name()
        .and_then(|value| value.to_str())
        .map(|value| value.to_string())
}
