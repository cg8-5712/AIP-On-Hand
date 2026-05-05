use aip_domain::{
    EaipAirportChartsResponse, EaipCatalogResponse, EaipChartScope, EaipChartSummary,
    EaipStatusResponse,
};
use eaip_manager::reader::PackageReader;
use std::{env, path::Path, path::PathBuf, sync::Arc};
use tracing::{info, warn};

use crate::{
    catalog::{build_ready_store, normalize_airport_code, package_file_name},
    error::ChartError,
    memory_reader::InMemoryPackageReader,
    model::{EaipChartService, PackageAccessReader, ReadyStore, ServiceState},
};

const DEFAULT_SOURCE: &str = "eaip-manager";
const PATH_SOURCE: &str = "backend-path";
const UPLOAD_SOURCE: &str = "browser-upload";
const DEFAULT_CACHE_CAPACITY: usize = 128;

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
                    max_upload_bytes: 0,
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
                        max_upload_bytes: 0,
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
                            max_upload_bytes: 0,
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
