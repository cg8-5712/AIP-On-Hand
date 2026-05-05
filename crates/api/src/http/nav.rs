use actix_web::{
    get,
    web::{Data, Json, Path, Query},
};
use aip_navigation::LayerQuery;

use crate::http::{
    error::ApiError,
    state::AppState,
    types::{MapLayersQuery, SearchQuery},
};

#[get("/api/v1/map/layers")]
pub async fn map_layers(
    state: Data<AppState>,
    query: Query<MapLayersQuery>,
) -> Result<Json<aip_domain::MapLayersResponse>, ApiError> {
    if !query.zoom.is_finite() {
        return Err(ApiError::BadRequest(
            "zoom query parameter must be a finite number".to_string(),
        ));
    }

    let zoom = query.zoom.round().clamp(0.0, 24.0) as i64;
    let payload = state
        .nav_db
        .load_layers(LayerQuery {
            west: query.west,
            south: query.south,
            east: query.east,
            north: query.north,
            zoom,
            include_airports: query.airports.unwrap_or(true),
            include_waypoints: query.waypoints.unwrap_or(true),
            include_vors: query.vors.unwrap_or(true),
            include_ndbs: query.ndbs.unwrap_or(true),
            include_airways: query.airways.unwrap_or(true),
        })
        .map_err(|error| ApiError::Internal(format!("failed to query map layers: {error}")))?;

    Ok(Json(payload))
}

#[get("/api/v1/airports/{airport_ident}/procedures")]
pub async fn airport_procedures(
    state: Data<AppState>,
    airport_ident: Path<String>,
) -> Result<Json<aip_domain::AirportProceduresResponse>, ApiError> {
    let airport_ident = airport_ident.into_inner();
    let payload = state
        .nav_db
        .procedures_for_airport(&airport_ident)
        .map_err(|error| {
            ApiError::Internal(format!("failed to query airport procedures: {error}"))
        })?
        .ok_or_else(|| ApiError::NotFound(format!("airport `{airport_ident}` was not found")))?;

    Ok(Json(payload))
}

#[get("/api/v1/airports/{airport_ident}/transitions")]
pub async fn airport_transitions(
    state: Data<AppState>,
    airport_ident: Path<String>,
) -> Result<Json<aip_domain::AirportTransitionsResponse>, ApiError> {
    let airport_ident = airport_ident.into_inner();
    let payload = state
        .nav_db
        .transitions_for_airport(&airport_ident)
        .map_err(|error| {
            ApiError::Internal(format!("failed to query airport transitions: {error}"))
        })?
        .ok_or_else(|| ApiError::NotFound(format!("airport `{airport_ident}` was not found")))?;

    Ok(Json(payload))
}

#[get("/api/v1/airports/{airport_ident}/runway-ends")]
pub async fn airport_runway_ends(
    state: Data<AppState>,
    airport_ident: Path<String>,
) -> Result<Json<Vec<aip_domain::AirportRunwayEnd>>, ApiError> {
    let airport_ident = airport_ident.into_inner();
    let payload = state
        .nav_db
        .airport_runway_ends(&airport_ident)
        .map_err(|error| {
            ApiError::Internal(format!("failed to query airport runway ends: {error}"))
        })?;

    Ok(Json(payload))
}

#[get("/api/v1/procedures/{procedure_id}")]
pub async fn procedure_geometry(
    state: Data<AppState>,
    procedure_id: Path<i64>,
) -> Result<Json<aip_domain::ProcedureGeometryResponse>, ApiError> {
    let procedure_id = procedure_id.into_inner();
    let payload = state
        .nav_db
        .procedure_geometry(procedure_id)
        .map_err(|error| {
            ApiError::Internal(format!("failed to query procedure geometry: {error}"))
        })?
        .ok_or_else(|| ApiError::NotFound(format!("procedure `{procedure_id}` was not found")))?;

    Ok(Json(payload))
}

#[get("/api/v1/transitions/{transition_id}")]
pub async fn transition_geometry(
    state: Data<AppState>,
    transition_id: Path<i64>,
) -> Result<Json<aip_domain::TransitionGeometryResponse>, ApiError> {
    let transition_id = transition_id.into_inner();
    let payload = state
        .nav_db
        .transition_geometry(transition_id)
        .map_err(|error| {
            ApiError::Internal(format!("failed to query transition geometry: {error}"))
        })?
        .ok_or_else(|| ApiError::NotFound(format!("transition `{transition_id}` was not found")))?;

    Ok(Json(payload))
}

#[get("/api/v1/search")]
pub async fn search(
    state: Data<AppState>,
    query: Query<SearchQuery>,
) -> Result<Json<aip_domain::SearchResponse>, ApiError> {
    let payload = state
        .nav_db
        .search(&query.q)
        .map_err(|error| ApiError::Internal(format!("failed to search nav database: {error}")))?;

    Ok(Json(payload))
}

#[get("/api/v1/airways/{airway_name}/segments")]
pub async fn airway_segments(
    state: Data<AppState>,
    airway_name: Path<String>,
) -> Result<Json<Vec<aip_domain::AirwayFeature>>, ApiError> {
    let payload = state
        .nav_db
        .airway_segments(&airway_name)
        .map_err(|error| ApiError::Internal(format!("failed to query airway segments: {error}")))?;

    Ok(Json(payload))
}
