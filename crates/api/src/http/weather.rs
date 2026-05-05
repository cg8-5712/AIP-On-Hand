use actix_web::{
    get,
    web::{Data, Json, Path, Query},
};

use crate::{
    atis,
    http::{
        error::{map_weather_error, ApiError},
        state::AppState,
        types::{AirportOverviewQuery, RoutePlanQuery},
    },
};

#[get("/api/v1/airports/{station_id}/overview")]
pub async fn airport_overview(
    state: Data<AppState>,
    station_id: Path<String>,
    query: Query<AirportOverviewQuery>,
) -> Result<Json<aip_domain::AirportWeatherOverviewResponse>, ApiError> {
    let requested_station_id = station_id.into_inner();
    let mut payload = state
        .weather_service
        .airport_overview(&requested_station_id, query.history_hours.unwrap_or(0))
        .await
        .map_err(map_weather_error)?;
    let mut communication_lookup_ids = Vec::new();
    if let Some(airport_icao_id) = payload
        .airport
        .as_ref()
        .and_then(|airport| airport.icao_id.clone())
    {
        communication_lookup_ids.push(airport_icao_id);
    }
    if let Some(station_icao_id) = payload
        .station
        .as_ref()
        .and_then(|station| station.icao_id.clone())
    {
        communication_lookup_ids.push(station_icao_id);
    }
    communication_lookup_ids.push(payload.resolved_id.clone());
    communication_lookup_ids.push(requested_station_id.clone());
    communication_lookup_ids.dedup();

    for lookup_id in &communication_lookup_ids {
        let communications = state
            .nav_db
            .airport_communications(lookup_id)
            .map_err(|error| {
                ApiError::Internal(format!(
                    "failed to query airport communications for `{lookup_id}`: {error}"
                ))
            })?;

        if !communications.is_empty() {
            payload.communications = communications;
            break;
        }
    }

    let mut runway_ends = Vec::new();
    for lookup_id in &communication_lookup_ids {
        let candidate_runway_ends =
            state
                .nav_db
                .airport_runway_ends(lookup_id)
                .map_err(|error| {
                    ApiError::Internal(format!(
                        "failed to query airport runway ends for `{lookup_id}`: {error}"
                    ))
                })?;

        if !candidate_runway_ends.is_empty() {
            runway_ends = candidate_runway_ends;
            break;
        }
    }

    payload.generated_atis = atis::build_generated_atis(&payload, &runway_ends);

    Ok(Json(payload))
}

#[get("/api/v1/routes/plan")]
pub async fn route_plan(
    state: Data<AppState>,
    query: Query<RoutePlanQuery>,
) -> Result<Json<aip_domain::RoutePlanResponse>, ApiError> {
    let departure = query.departure.trim();
    let arrival = query.arrival.trim();
    if departure.is_empty() || arrival.is_empty() {
        return Err(ApiError::BadRequest(
            "departure and arrival airport identifiers are required".to_string(),
        ));
    }

    let payload = state
        .nav_db
        .plan_routes(
            departure,
            arrival,
            query.cruise_altitude_ft,
            query.limit.unwrap_or(5),
        )
        .map_err(|error| ApiError::Internal(format!("failed to plan route: {error}")))?
        .ok_or_else(|| {
            ApiError::NotFound(format!(
                "route planning airports were not found: `{departure}` -> `{arrival}`"
            ))
        })?;

    Ok(Json(payload))
}
