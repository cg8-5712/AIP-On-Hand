mod memory_reader;

use aip_domain::{
    EaipAirportChartsResponse, EaipCatalogResponse, EaipChartScope, EaipChartSummary,
    EaipStatusResponse,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use eaip_manager::reader::PackageReader;
use memory_reader::InMemoryPackageReader;
use std::{
    collections::HashMap,
    env, fmt,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};
use tracing::{info, warn};

const DEFAULT_SOURCE: &str = "eaip-manager";
const PATH_SOURCE: &str = "backend-path";
const UPLOAD_SOURCE: &str = "browser-upload";
const DEFAULT_CACHE_CAPACITY: usize = 128;

#[derive(Debug)]
pub enum ChartError {
    InvalidInput(String),
    Unavailable(String),
    NotFound(String),
    Internal(String),
}

impl fmt::Display for ChartError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidInput(message)
            | Self::Unavailable(message)
            | Self::NotFound(message)
            | Self::Internal(message) => formatter.write_str(message),
        }
    }
}

impl std::error::Error for ChartError {}

#[derive(Clone)]
pub struct EaipChartService {
    state: Arc<ServiceState>,
}

enum ServiceState {
    Disabled { status: EaipStatusResponse },
    Ready(ReadyStore),
}

struct ReadyStore {
    reader: Mutex<PackageAccessReader>,
    chart_records: Vec<ChartRecord>,
    charts_by_id: HashMap<String, usize>,
    charts_by_airport: HashMap<String, Vec<usize>>,
    status: EaipStatusResponse,
}

#[derive(Clone)]
struct ChartRecord {
    internal_path: String,
    summary: EaipChartSummary,
}

enum PackageAccessReader {
    File(PackageReader),
    Memory(InMemoryPackageReader),
}

impl PackageAccessReader {
    fn read_file(&mut self, path: &str) -> Result<Option<Vec<u8>>, ChartError> {
        match self {
            Self::File(reader) => reader.read_file(path).map_err(|error| {
                ChartError::Internal(format!(
                    "failed to read chart `{path}` from encrypted package file: {error}"
                ))
            }),
            Self::Memory(reader) => reader.read_file(path),
        }
    }
}

impl EaipChartService {
    pub fn unloaded(message: impl Into<String>) -> Self {
        Self {
            state: Arc::new(ServiceState::Disabled {
                status: EaipStatusResponse {
                    configured: false,
                    ready: false,
                    package_file: None,
                    cycle: None,
                    chart_count: 0,
                    airport_count: 0,
                    general_document_count: 0,
                    enroute_document_count: 0,
                    memory_only: true,
                    source: DEFAULT_SOURCE.to_string(),
                    message: Some(message.into()),
                },
            }),
        }
    }

    pub fn default_cache_capacity() -> usize {
        DEFAULT_CACHE_CAPACITY
    }

    pub fn from_env() -> Self {
        let package_path = env::var("AIP_EAIP_PACKAGE_PATH")
            .ok()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());
        let password = env::var("AIP_EAIP_PACKAGE_PASSWORD")
            .ok()
            .filter(|value| !value.trim().is_empty());
        let cache_capacity = env::var("AIP_EAIP_CACHE_CAPACITY")
            .ok()
            .and_then(|value| value.trim().parse::<usize>().ok())
            .filter(|value| *value > 0)
            .unwrap_or(DEFAULT_CACHE_CAPACITY);

        let Some(package_path) = package_path else {
            let message =
                "eAIP package is disabled because AIP_EAIP_PACKAGE_PATH is not configured."
                    .to_string();
            info!("{message}");
            return Self::unloaded(message);
        };

        let package_file = package_file_name(Path::new(&package_path));

        let Some(password) = password else {
            let message =
                "eAIP package is disabled because AIP_EAIP_PACKAGE_PASSWORD is not configured."
                    .to_string();
            warn!("{message}");
            return Self {
                state: Arc::new(ServiceState::Disabled {
                    status: EaipStatusResponse {
                        configured: false,
                        ready: false,
                        package_file,
                        cycle: None,
                        chart_count: 0,
                        airport_count: 0,
                        general_document_count: 0,
                        enroute_document_count: 0,
                        memory_only: true,
                        source: DEFAULT_SOURCE.to_string(),
                        message: Some(message),
                    },
                }),
            };
        };

        match Self::from_package_path(PathBuf::from(&package_path), &password, cache_capacity) {
            Ok(service) => {
                let status = service.status();
                info!(
                    "loaded eAIP package {} with {} PDF charts across {} airports",
                    status.package_file.as_deref().unwrap_or("unknown package"),
                    status.chart_count,
                    status.airport_count
                );
                service
            }
            Err(error) => {
                let message = format!("eAIP package is configured but unavailable: {error}");
                warn!("{message}");
                Self {
                    state: Arc::new(ServiceState::Disabled {
                        status: EaipStatusResponse {
                            configured: true,
                            ready: false,
                            package_file,
                            cycle: None,
                            chart_count: 0,
                            airport_count: 0,
                            general_document_count: 0,
                            enroute_document_count: 0,
                            memory_only: true,
                            source: DEFAULT_SOURCE.to_string(),
                            message: Some(message),
                        },
                    }),
                }
            }
        }
    }

    pub fn from_package_path(
        package_path: PathBuf,
        password: &str,
        cache_capacity: usize,
    ) -> Result<Self, ChartError> {
        if package_path.as_os_str().is_empty() {
            return Err(ChartError::InvalidInput(
                "package path must not be blank".to_string(),
            ));
        }

        if password.trim().is_empty() {
            return Err(ChartError::InvalidInput(
                "package password must not be blank".to_string(),
            ));
        }

        let store = Self::load_ready_store(package_path, password, cache_capacity)?;
        Ok(Self {
            state: Arc::new(ServiceState::Ready(store)),
        })
    }

    pub fn from_package_bytes(
        package_file_name: String,
        package_bytes: Vec<u8>,
        password: &str,
        cache_capacity: usize,
    ) -> Result<Self, ChartError> {
        if package_file_name.trim().is_empty() {
            return Err(ChartError::InvalidInput(
                "package file name must not be blank".to_string(),
            ));
        }

        if package_bytes.is_empty() {
            return Err(ChartError::InvalidInput(
                "package payload must not be empty".to_string(),
            ));
        }

        if password.trim().is_empty() {
            return Err(ChartError::InvalidInput(
                "package password must not be blank".to_string(),
            ));
        }

        let mut reader = InMemoryPackageReader::open(package_bytes, password)?;
        reader.set_cache_capacity(cache_capacity);
        let store = build_ready_store(
            PackageAccessReader::Memory(reader),
            package_file_name,
            true,
            UPLOAD_SOURCE.to_string(),
        )?;

        Ok(Self {
            state: Arc::new(ServiceState::Ready(store)),
        })
    }

    pub fn status(&self) -> EaipStatusResponse {
        match self.state.as_ref() {
            ServiceState::Disabled { status } => status.clone(),
            ServiceState::Ready(store) => store.status.clone(),
        }
    }

    pub fn list_airport_charts(
        &self,
        airport_ident_or_icao: &str,
    ) -> Result<EaipAirportChartsResponse, ChartError> {
        let query = normalize_airport_code(airport_ident_or_icao)?;
        let store = self.ready_store()?;

        let charts = store
            .charts_by_airport
            .get(&query)
            .into_iter()
            .flat_map(|indices| indices.iter())
            .map(|index| store.chart_records[*index].summary.clone())
            .collect::<Vec<_>>();

        Ok(EaipAirportChartsResponse {
            requested_airport: airport_ident_or_icao.trim().to_ascii_uppercase(),
            resolved_airport_icao: query,
            charts,
        })
    }

    pub fn chart_summary(&self, chart_id: &str) -> Result<EaipChartSummary, ChartError> {
        let store = self.ready_store()?;
        let index = store
            .charts_by_id
            .get(chart_id)
            .copied()
            .ok_or_else(|| ChartError::NotFound(format!("chart `{chart_id}` was not found")))?;

        Ok(store.chart_records[index].summary.clone())
    }

    pub fn catalog(&self) -> Result<EaipCatalogResponse, ChartError> {
        let store = self.ready_store()?;
        let mut airport_charts = Vec::new();
        let mut general_documents = Vec::new();
        let mut enroute_documents = Vec::new();

        for record in &store.chart_records {
            match record.summary.scope {
                EaipChartScope::Airport => airport_charts.push(record.summary.clone()),
                EaipChartScope::General => general_documents.push(record.summary.clone()),
                EaipChartScope::Enroute => enroute_documents.push(record.summary.clone()),
                EaipChartScope::Other => {}
            }
        }

        Ok(EaipCatalogResponse {
            airport_charts,
            general_documents,
            enroute_documents,
        })
    }

    pub fn read_chart_bytes(&self, chart_id: &str) -> Result<Vec<u8>, ChartError> {
        let store = self.ready_store()?;
        let index = store
            .charts_by_id
            .get(chart_id)
            .copied()
            .ok_or_else(|| ChartError::NotFound(format!("chart `{chart_id}` was not found")))?;
        let internal_path = store.chart_records[index].internal_path.clone();

        let mut reader = store.reader.lock().map_err(|_| {
            ChartError::Internal("eAIP package reader lock was poisoned".to_string())
        })?;

        reader.read_file(&internal_path)?.ok_or_else(|| {
            ChartError::NotFound(format!(
                "chart `{}` is indexed but missing from the package",
                store.chart_records[index].summary.file_name
            ))
        })
    }

    fn ready_store(&self) -> Result<&ReadyStore, ChartError> {
        match self.state.as_ref() {
            ServiceState::Disabled { status } => Err(ChartError::Unavailable(
                status
                    .message
                    .clone()
                    .unwrap_or_else(|| "eAIP package is not ready".to_string()),
            )),
            ServiceState::Ready(store) => Ok(store),
        }
    }

    fn load_ready_store(
        package_path: PathBuf,
        password: &str,
        cache_capacity: usize,
    ) -> Result<ReadyStore, ChartError> {
        let mut reader = PackageReader::open(&package_path, password).map_err(|error| {
            ChartError::Internal(format!(
                "failed to open `{}`: {error}",
                package_path.display()
            ))
        })?;
        reader.set_cache_capacity(cache_capacity);
        build_ready_store(
            PackageAccessReader::File(reader),
            package_file_name(&package_path).unwrap_or_else(|| "unknown-package".to_string()),
            true,
            PATH_SOURCE.to_string(),
        )
    }
}

fn build_ready_store(
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

fn build_chart_record(path: &str) -> Option<ChartRecord> {
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

    let scope = chart_scope(&segments);
    let airport_icao = airport_icao_for_segments(scope, &segments);
    let file_name = segments.last()?.to_string();
    let title = file_name
        .strip_suffix(".pdf")
        .or_else(|| file_name.strip_suffix(".PDF"))
        .unwrap_or(&file_name)
        .to_string();
    let category = chart_category(scope, &segments);

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

fn chart_scope(segments: &[&str]) -> EaipChartScope {
    match segments.first().map(|segment| segment.to_ascii_uppercase()) {
        Some(value) if value == "TERMINAL" => EaipChartScope::Airport,
        Some(value) if value == "ENR" => EaipChartScope::Enroute,
        Some(value) if value == "GENERALDOC" => EaipChartScope::General,
        _ => EaipChartScope::Other,
    }
}

fn airport_icao_for_segments(scope: EaipChartScope, segments: &[&str]) -> Option<String> {
    if scope != EaipChartScope::Airport || segments.len() < 2 {
        return None;
    }

    Some(segments[1].trim().to_ascii_uppercase())
}

fn chart_category(scope: EaipChartScope, segments: &[&str]) -> String {
    match scope {
        EaipChartScope::Airport => {
            if segments.len() >= 4 {
                segments[2].trim().to_ascii_uppercase()
            } else {
                "TERMINAL".to_string()
            }
        }
        EaipChartScope::Enroute => segments
            .get(1)
            .filter(|_| segments.len() > 2)
            .map(|segment| segment.trim().to_ascii_uppercase())
            .filter(|segment| !segment.is_empty())
            .unwrap_or_else(|| "ENR".to_string()),
        EaipChartScope::General => segments
            .get(1)
            .filter(|_| segments.len() > 2)
            .map(|segment| segment.trim().to_ascii_uppercase())
            .filter(|segment| !segment.is_empty())
            .unwrap_or_else(|| "GENERALDOC".to_string()),
        EaipChartScope::Other => segments
            .first()
            .map(|segment| segment.trim().to_ascii_uppercase())
            .filter(|segment| !segment.is_empty())
            .unwrap_or_else(|| "OTHER".to_string()),
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

fn chart_category_rank(category: &str) -> usize {
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

fn normalize_airport_code(value: &str) -> Result<String, ChartError> {
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

fn package_file_name(path: &Path) -> Option<String> {
    path.file_name()
        .and_then(|value| value.to_str())
        .map(|value| value.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

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
        let record = build_chart_record("GeneralDoc/AIP SUP 01 2026.pdf")
            .expect("general chart should parse");

        assert_eq!(record.summary.scope, EaipChartScope::General);
        assert_eq!(record.summary.category, "GENERALDOC");
        assert_eq!(record.summary.airport_icao, None);
    }

    #[test]
    fn ignores_non_pdf_entries() {
        assert!(build_chart_record("Terminal/ZBAA/notes.txt").is_none());
    }

    #[test]
    fn category_rank_prioritizes_ground_and_terminal_charts() {
        assert!(chart_category_rank("ADC") < chart_category_rank("SID"));
        assert!(chart_category_rank("SID") < chart_category_rank("STAR"));
    }
}
