use aip_domain::{EaipChartSummary, EaipStatusResponse};
use eaip_manager::reader::PackageReader;
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

use crate::{error::ChartError, memory_reader::InMemoryPackageReader};

#[derive(Clone)]
pub struct EaipChartService {
    pub(crate) state: Arc<ServiceState>,
}

pub(crate) enum ServiceState {
    Disabled { status: EaipStatusResponse },
    Ready(ReadyStore),
}

pub(crate) struct ReadyStore {
    pub(crate) reader: Mutex<PackageAccessReader>,
    pub(crate) chart_records: Vec<ChartRecord>,
    pub(crate) charts_by_id: HashMap<String, usize>,
    pub(crate) charts_by_airport: HashMap<String, Vec<usize>>,
    pub(crate) status: EaipStatusResponse,
}

#[derive(Clone)]
pub(crate) struct ChartRecord {
    pub(crate) internal_path: String,
    pub(crate) summary: EaipChartSummary,
}

pub(crate) enum PackageAccessReader {
    File(PackageReader),
    Memory(InMemoryPackageReader),
}

impl PackageAccessReader {
    pub(crate) fn read_file(&mut self, path: &str) -> Result<Option<Vec<u8>>, ChartError> {
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
