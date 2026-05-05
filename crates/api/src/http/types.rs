use serde::{Deserialize, Serialize};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthResponse {
    pub service: &'static str,
    pub status: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionResponse {
    pub service: &'static str,
    pub version: &'static str,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MapLayersQuery {
    pub west: f64,
    pub south: f64,
    pub east: f64,
    pub north: f64,
    pub zoom: f64,
    pub airports: Option<bool>,
    pub waypoints: Option<bool>,
    pub vors: Option<bool>,
    pub ndbs: Option<bool>,
    pub airways: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchQuery {
    pub q: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AirportOverviewQuery {
    pub history_hours: Option<usize>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoutePlanQuery {
    pub departure: String,
    pub arrival: String,
    pub cruise_altitude_ft: i64,
    pub limit: Option<usize>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigureEaipRequest {
    pub package_path: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PickEaipPackageResponse {
    pub package_path: Option<String>,
}
