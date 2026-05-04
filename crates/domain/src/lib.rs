use serde::Serialize;

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LatLon {
    pub lat: f64,
    pub lon: f64,
}

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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AirportInfoSummary {
    pub icao_id: Option<String>,
    pub iata_id: Option<String>,
    pub faa_id: Option<String>,
    pub name: String,
    pub state: Option<String>,
    pub country: Option<String>,
    pub source: Option<String>,
    pub airport_type: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub elevation_ft: Option<f64>,
    pub magnetic_declination: Option<String>,
    pub owner: Option<String>,
    pub runway_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StationInfoSummary {
    pub icao_id: Option<String>,
    pub iata_id: Option<String>,
    pub faa_id: Option<String>,
    pub site: String,
    pub state: Option<String>,
    pub country: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub elevation_m: Option<f64>,
    pub priority: Option<i64>,
    pub site_types: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WeatherCloudLayer {
    pub cover: String,
    pub base_ft: Option<i64>,
    pub top_ft: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MetarObservation {
    pub icao_id: String,
    pub station_name: Option<String>,
    pub observed_at_unix: Option<i64>,
    pub received_at: Option<String>,
    pub reported_at: Option<String>,
    pub raw_text: String,
    pub flight_category: Option<String>,
    pub metar_type: Option<String>,
    pub temperature_c: Option<f64>,
    pub dewpoint_c: Option<f64>,
    pub wind_direction: Option<String>,
    pub wind_speed_kt: Option<i64>,
    pub wind_gust_kt: Option<i64>,
    pub visibility_sm: Option<String>,
    pub altimeter_hpa: Option<f64>,
    pub sea_level_pressure_hpa: Option<f64>,
    pub weather: Option<String>,
    pub vertical_visibility_ft: Option<i64>,
    pub precipitation_last_hour_in: Option<f64>,
    pub precipitation_last_3h_in: Option<f64>,
    pub precipitation_last_6h_in: Option<f64>,
    pub precipitation_last_24h_in: Option<f64>,
    pub clouds: Vec<WeatherCloudLayer>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TafForecastSegment {
    pub valid_from_unix: Option<i64>,
    pub valid_to_unix: Option<i64>,
    pub transition_end_unix: Option<i64>,
    pub change_type: Option<String>,
    pub probability: Option<i64>,
    pub wind_direction: Option<String>,
    pub wind_speed_kt: Option<i64>,
    pub wind_gust_kt: Option<i64>,
    pub visibility_sm: Option<String>,
    pub altimeter_hpa: Option<f64>,
    pub weather: Option<String>,
    pub vertical_visibility_ft: Option<i64>,
    pub not_decoded: Option<String>,
    pub clouds: Vec<WeatherCloudLayer>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TafReport {
    pub icao_id: String,
    pub station_name: Option<String>,
    pub issued_at: Option<String>,
    pub bulletin_time: Option<String>,
    pub valid_from_unix: Option<i64>,
    pub valid_to_unix: Option<i64>,
    pub raw_text: String,
    pub remarks: Option<String>,
    pub forecast_segments: Vec<TafForecastSegment>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WeatherTextBulletin {
    pub issued_at: Option<String>,
    pub text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoaaCycleMetar {
    pub cycle_label: String,
    pub raw_text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoaaWeatherSupplement {
    pub current_raw: Option<WeatherTextBulletin>,
    pub current_decoded: Option<WeatherTextBulletin>,
    pub recent_cycles: Vec<NoaaCycleMetar>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AirportCommunication {
    pub service_type: String,
    pub label: String,
    pub name: Option<String>,
    pub frequency_mhz: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AirportRunwayEnd {
    pub runway_name: String,
    pub reciprocal_runway_name: String,
    pub heading_deg: f64,
    pub length_ft: f64,
    pub width_ft: f64,
    pub surface: Option<String>,
    pub is_takeoff: bool,
    pub is_landing: bool,
    pub ils_ident: Option<String>,
    pub location: LatLon,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum GeneratedAtisType {
    Departure,
    Arrival,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneratedAtisReport {
    pub atis_type: GeneratedAtisType,
    pub information_code: String,
    pub issued_at: Option<String>,
    pub runways_in_use: Vec<String>,
    pub contacts: Vec<AirportCommunication>,
    pub text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneratedAtisBundle {
    pub departure: GeneratedAtisReport,
    pub arrival: GeneratedAtisReport,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AirportWeatherOverviewResponse {
    pub requested_id: String,
    pub resolved_id: String,
    pub airport: Option<AirportInfoSummary>,
    pub station: Option<StationInfoSummary>,
    pub metar: Option<MetarObservation>,
    pub taf: Option<TafReport>,
    pub communications: Vec<AirportCommunication>,
    pub generated_atis: Option<GeneratedAtisBundle>,
    pub noaa: NoaaWeatherSupplement,
    pub warnings: Vec<String>,
}

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
