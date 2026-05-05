use serde::Serialize;

use crate::shared::LatLon;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NavDbMetadata {
    pub airac_cycle: String,
    pub valid_through: String,
    pub data_source: String,
    pub has_sid_star: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AirportFeature {
    pub id: i64,
    pub ident: String,
    pub icao: Option<String>,
    pub name: String,
    pub country: Option<String>,
    pub num_approaches: i64,
    pub longest_runway_length: i64,
    pub location: LatLon,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WaypointFeature {
    pub id: i64,
    pub ident: String,
    pub name: Option<String>,
    pub waypoint_type: Option<String>,
    pub arinc_type: Option<String>,
    pub airport_id: Option<i64>,
    pub is_airport_waypoint: bool,
    pub airport_ident: Option<String>,
    pub location: LatLon,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NavaidFeature {
    pub id: i64,
    pub ident: String,
    pub name: Option<String>,
    pub navaid_type: String,
    pub facility_type: Option<String>,
    pub airport_ident: Option<String>,
    pub location: LatLon,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AirwayFeature {
    pub id: i64,
    pub airway_name: String,
    pub airway_type: String,
    pub route_type: Option<String>,
    pub direction: Option<String>,
    pub minimum_altitude: Option<i64>,
    pub maximum_altitude: Option<i64>,
    pub from: LatLon,
    pub to: LatLon,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LayerTruncation {
    pub airports: bool,
    pub waypoints: bool,
    pub vors: bool,
    pub ndbs: bool,
    pub airways: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MapLayersResponse {
    pub metadata: NavDbMetadata,
    pub airports: Vec<AirportFeature>,
    pub waypoints: Vec<WaypointFeature>,
    pub vors: Vec<NavaidFeature>,
    pub ndbs: Vec<NavaidFeature>,
    pub airways: Vec<AirwayFeature>,
    pub truncation: LayerTruncation,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcedureAirport {
    pub id: i64,
    pub ident: String,
    pub icao: Option<String>,
    pub name: String,
    pub location: LatLon,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ProcedureKind {
    Sid,
    Star,
    Approach,
    Procedure,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SearchEntityType {
    Airport,
    Waypoint,
    Vor,
    Ndb,
    Airway,
    Sid,
    Star,
    Approach,
    Procedure,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcedureSummary {
    pub id: i64,
    pub airport_ident: String,
    pub airport_name: String,
    pub name: String,
    pub arinc_name: String,
    pub procedure_type: String,
    pub procedure_kind: ProcedureKind,
    pub runway_name: Option<String>,
    pub legs: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcedureLegPoint {
    pub ident: Option<String>,
    pub leg_type: Option<String>,
    pub position: LatLon,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcedureGeometryResponse {
    pub summary: ProcedureSummary,
    pub airport: ProcedureAirport,
    pub path: Vec<ProcedureLegPoint>,
    pub missed_path: Vec<ProcedureLegPoint>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AirportProceduresResponse {
    pub airport: ProcedureAirport,
    pub procedures: Vec<ProcedureSummary>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransitionSummary {
    pub id: i64,
    pub airport_ident: String,
    pub airport_name: String,
    pub approach_id: i64,
    pub approach_name: String,
    pub runway_name: Option<String>,
    pub name: String,
    pub transition_type: String,
    pub legs: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransitionGeometryResponse {
    pub summary: TransitionSummary,
    pub airport: ProcedureAirport,
    pub path: Vec<ProcedureLegPoint>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AirportTransitionsResponse {
    pub airport: ProcedureAirport,
    pub transitions: Vec<TransitionSummary>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResultItem {
    pub id: String,
    pub entity_type: SearchEntityType,
    pub ident: String,
    pub name: Option<String>,
    pub airport_ident: Option<String>,
    pub airport_name: Option<String>,
    pub procedure_id: Option<i64>,
    pub procedure_kind: Option<ProcedureKind>,
    pub procedure_type: Option<String>,
    pub runway_name: Option<String>,
    pub airway_type: Option<String>,
    pub location: Option<LatLon>,
    pub from: Option<LatLon>,
    pub to: Option<LatLon>,
    pub path: Option<Vec<LatLon>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResponse {
    pub query: String,
    pub results: Vec<SearchResultItem>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RouteProcedureOption {
    pub procedure_id: i64,
    pub name: String,
    pub arinc_name: String,
    pub procedure_type: String,
    pub runway_name: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RouteProcedurePoint {
    pub ident: String,
    pub location: LatLon,
    pub minimum_procedure_distance_nm: f64,
    pub procedures: Vec<RouteProcedureOption>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RouteAirwaySegment {
    pub airway_name: String,
    pub airway_type: String,
    pub route_type: Option<String>,
    pub direction: Option<String>,
    pub minimum_altitude: Option<i64>,
    pub maximum_altitude: Option<i64>,
    pub from_ident: String,
    pub to_ident: String,
    pub from: LatLon,
    pub to: LatLon,
    pub distance_nm: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RoutePlanCandidate {
    pub total_distance_nm: f64,
    pub airway_distance_nm: f64,
    pub departure: RouteProcedurePoint,
    pub airways: Vec<RouteAirwaySegment>,
    pub arrival: RouteProcedurePoint,
    pub approaches: Vec<RouteProcedureOption>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RoutePlanResponse {
    pub departure_airport: ProcedureAirport,
    pub arrival_airport: ProcedureAirport,
    pub cruise_altitude_ft: i64,
    pub candidates: Vec<RoutePlanCandidate>,
    pub notes: Vec<String>,
}
