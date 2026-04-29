use actix_cors::Cors;
use actix_web::{
    get,
    http::StatusCode,
    middleware::Logger,
    web::{Data, Json, Path, Query},
    App, HttpResponse, HttpServer, Responder, ResponseError,
};
use aip_navigation::{LayerQuery, NavDb};
use aip_weather::{WeatherError, WeatherService};
use serde::{Deserialize, Serialize};
use std::{env, fmt, io, path::PathBuf};
use tracing::info;
use tracing_subscriber::EnvFilter;

#[derive(Clone)]
struct AppState {
    nav_db: NavDb,
    weather_service: WeatherService,
}

#[derive(Debug)]
enum ApiError {
    NotFound(String),
    Upstream(String),
    Internal(String),
}

impl fmt::Display for ApiError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NotFound(message)
            | Self::Upstream(message)
            | Self::Internal(message) => formatter.write_str(message),
        }
    }
}

impl ResponseError for ApiError {
    fn status_code(&self) -> StatusCode {
        match self {
            Self::NotFound(_) => StatusCode::NOT_FOUND,
            Self::Upstream(_) => StatusCode::BAD_GATEWAY,
            Self::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    fn error_response(&self) -> HttpResponse {
        HttpResponse::build(self.status_code()).json(ErrorResponse {
            error: self.to_string(),
        })
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HealthResponse {
    service: &'static str,
    status: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VersionResponse {
    service: &'static str,
    version: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ErrorResponse {
    error: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MapLayersQuery {
    west: f64,
    south: f64,
    east: f64,
    north: f64,
    zoom: i64,
    airports: Option<bool>,
    waypoints: Option<bool>,
    vors: Option<bool>,
    ndbs: Option<bool>,
    airways: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SearchQuery {
    q: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AirportOverviewQuery {
    history_hours: Option<usize>,
}

#[get("/api/v1/health")]
async fn health() -> impl Responder {
    HttpResponse::Ok().json(HealthResponse {
        service: "aip-on-hand-api",
        status: "ok",
    })
}

#[get("/api/v1/version")]
async fn version() -> impl Responder {
    HttpResponse::Ok().json(VersionResponse {
        service: env!("CARGO_PKG_NAME"),
        version: env!("CARGO_PKG_VERSION"),
    })
}

#[get("/api/v1/map/layers")]
async fn map_layers(
    state: Data<AppState>,
    query: Query<MapLayersQuery>,
) -> Result<Json<aip_domain::MapLayersResponse>, ApiError> {
    let payload = state
        .nav_db
        .load_layers(LayerQuery {
            west: query.west,
            south: query.south,
            east: query.east,
            north: query.north,
            zoom: query.zoom,
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
async fn airport_procedures(
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

#[get("/api/v1/procedures/{procedure_id}")]
async fn procedure_geometry(
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

#[get("/api/v1/search")]
async fn search(
    state: Data<AppState>,
    query: Query<SearchQuery>,
) -> Result<Json<aip_domain::SearchResponse>, ApiError> {
    let payload = state
        .nav_db
        .search(&query.q)
        .map_err(|error| ApiError::Internal(format!("failed to search nav database: {error}")))?;

    Ok(Json(payload))
}

#[get("/api/v1/airports/{station_id}/overview")]
async fn airport_overview(
    state: Data<AppState>,
    station_id: Path<String>,
    query: Query<AirportOverviewQuery>,
) -> Result<Json<aip_domain::AirportWeatherOverviewResponse>, ApiError> {
    let payload = state
        .weather_service
        .airport_overview(&station_id.into_inner(), query.history_hours.unwrap_or(0))
        .await
        .map_err(map_weather_error)?;

    Ok(Json(payload))
}

fn map_weather_error(error: WeatherError) -> ApiError {
    match error {
        WeatherError::InvalidInput(message) => ApiError::Internal(message),
        WeatherError::NotFound(message) => ApiError::NotFound(message),
        WeatherError::Upstream(message) => ApiError::Upstream(message),
    }
}

fn configure_logging() {
    let filter =
        EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info,actix_web=info"));

    tracing_subscriber::fmt().with_env_filter(filter).init();
}

fn host() -> String {
    env::var("AIP_API_HOST").unwrap_or_else(|_| "127.0.0.1".to_string())
}

fn port() -> u16 {
    env::var("AIP_API_PORT")
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(8080)
}

fn nav_db_path() -> PathBuf {
    env::var("AIP_NAVDB_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from(r"F:\bian\jsproject\Open-Navigraph\data\little_navmap_navigraph.sqlite"))
}

#[actix_web::main]
async fn main() -> io::Result<()> {
    configure_logging();

    let host = host();
    let port = port();
    let bind_address = format!("{host}:{port}");
    let nav_db = NavDb::new(nav_db_path()).map_err(|error| {
        io::Error::new(
            io::ErrorKind::Other,
            format!("failed to open nav database: {error}"),
        )
    })?;
    let weather_service = WeatherService::from_env().map_err(|error| {
        io::Error::new(
            io::ErrorKind::Other,
            format!("failed to initialize weather service: {error}"),
        )
    })?;
    let metadata = nav_db.metadata();

    info!(
        "starting browser-mode API at http://{} with AIRAC {} ({})",
        bind_address, metadata.airac_cycle, metadata.data_source
    );

    let state = Data::new(AppState {
        nav_db,
        weather_service,
    });

    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .wrap(Logger::default())
            // Phase 1 still keeps CORS permissive to simplify browser-mode development.
            .wrap(Cors::permissive())
            .service(health)
            .service(version)
            .service(map_layers)
            .service(airport_procedures)
            .service(airport_overview)
            .service(procedure_geometry)
            .service(search)
    })
    .bind(bind_address)?
    .run()
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{body::to_bytes, http::StatusCode, test, App};
    use serde_json::Value;

    #[actix_web::test]
    async fn health_endpoint_returns_ok() {
        let app = test::init_service(App::new().service(health)).await;
        let request = test::TestRequest::get().uri("/api/v1/health").to_request();
        let response = test::call_service(&app, request).await;

        assert_eq!(response.status(), StatusCode::OK);

        let body = to_bytes(response.into_body()).await.unwrap();
        let payload = std::str::from_utf8(&body).unwrap();

        assert!(payload.contains("\"status\":\"ok\""));
    }

    #[actix_web::test]
    async fn version_endpoint_returns_package_metadata() {
        let app = test::init_service(App::new().service(version)).await;
        let request = test::TestRequest::get().uri("/api/v1/version").to_request();
        let response = test::call_service(&app, request).await;

        assert_eq!(response.status(), StatusCode::OK);

        let body = to_bytes(response.into_body()).await.unwrap();
        let payload: Value = serde_json::from_slice(&body).unwrap();

        assert_eq!(payload["service"], env!("CARGO_PKG_NAME"));
        assert_eq!(payload["version"], env!("CARGO_PKG_VERSION"));
    }
}
