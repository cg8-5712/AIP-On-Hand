use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum EaipChartScope {
    Airport,
    Enroute,
    General,
    Other,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EaipChartSummary {
    pub chart_id: String,
    pub scope: EaipChartScope,
    pub airport_icao: Option<String>,
    pub category: String,
    pub title: String,
    pub file_name: String,
    pub is_merged: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EaipAirportChartsResponse {
    pub requested_airport: String,
    pub resolved_airport_icao: String,
    pub charts: Vec<EaipChartSummary>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EaipCatalogResponse {
    pub airport_charts: Vec<EaipChartSummary>,
    pub general_documents: Vec<EaipChartSummary>,
    pub enroute_documents: Vec<EaipChartSummary>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EaipStatusResponse {
    pub configured: bool,
    pub ready: bool,
    pub package_file: Option<String>,
    pub cycle: Option<u16>,
    pub chart_count: usize,
    pub airport_count: usize,
    pub general_document_count: usize,
    pub enroute_document_count: usize,
    pub max_upload_bytes: usize,
    pub memory_only: bool,
    pub source: String,
    pub message: Option<String>,
}
