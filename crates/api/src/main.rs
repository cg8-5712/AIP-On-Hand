use actix_cors::Cors;
use actix_multipart::Multipart;
use actix_web::{
    get,
    http::{header, StatusCode},
    middleware::Logger,
    post,
    web::{self, Data, Json, Path, Query},
    App, HttpResponse, HttpServer, Responder, ResponseError,
};
use aip_charts::{ChartError, EaipChartService};
use aip_navigation::{LayerQuery, NavDb};
use aip_weather::{WeatherError, WeatherService};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::{
    env, fmt, io,
    path::{Path as FsPath, PathBuf},
    sync::{Arc, RwLock},
};
use tracing::info;
use tracing_subscriber::EnvFilter;

#[derive(Clone)]
struct AppState {
    nav_db: NavDb,
    chart_service: Arc<RwLock<EaipChartService>>,
    weather_service: WeatherService,
}

#[derive(Debug)]
enum ApiError {
    BadRequest(String),
    NotFound(String),
    ServiceUnavailable(String),
    Upstream(String),
    Internal(String),
}

impl fmt::Display for ApiError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::BadRequest(message)
            | Self::NotFound(message)
            | Self::ServiceUnavailable(message)
            | Self::Upstream(message)
            | Self::Internal(message) => formatter.write_str(message),
        }
    }
}

impl ResponseError for ApiError {
    fn status_code(&self) -> StatusCode {
        match self {
            Self::BadRequest(_) => StatusCode::BAD_REQUEST,
            Self::NotFound(_) => StatusCode::NOT_FOUND,
            Self::ServiceUnavailable(_) => StatusCode::SERVICE_UNAVAILABLE,
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RoutePlanQuery {
    departure: String,
    arrival: String,
    cruise_altitude_ft: i64,
    limit: Option<usize>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConfigureEaipRequest {
    package_path: String,
    password: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PickEaipPackageResponse {
    package_path: Option<String>,
}

const DEFAULT_EAIP_UPLOAD_LIMIT_BYTES: usize = 512 * 1024 * 1024;

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

#[get("/api/v1/eaip/status")]
async fn eaip_status(state: Data<AppState>) -> impl Responder {
    let service = state
        .chart_service
        .read()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let mut status = service.status();
    status.max_upload_bytes = eaip_upload_limit_bytes();
    HttpResponse::Ok().json(status)
}

#[get("/api/v1/eaip/airports/{airport_ident}/charts")]
async fn eaip_airport_charts(
    state: Data<AppState>,
    airport_ident: Path<String>,
) -> Result<Json<aip_domain::EaipAirportChartsResponse>, ApiError> {
    let service = state
        .chart_service
        .read()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let payload = service
        .list_airport_charts(&airport_ident.into_inner())
        .map_err(map_chart_error)?;

    Ok(Json(payload))
}

#[get("/api/v1/eaip/catalog")]
async fn eaip_catalog(
    state: Data<AppState>,
) -> Result<Json<aip_domain::EaipCatalogResponse>, ApiError> {
    let service = state
        .chart_service
        .read()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let payload = service.catalog().map_err(map_chart_error)?;

    Ok(Json(payload))
}

#[get("/api/v1/eaip/charts/{chart_id}/content")]
async fn eaip_chart_content(
    state: Data<AppState>,
    chart_id: Path<String>,
) -> Result<HttpResponse, ApiError> {
    let chart_id = chart_id.into_inner();
    let summary = {
        let service = state
            .chart_service
            .read()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        service.chart_summary(&chart_id).map_err(map_chart_error)?
    };

    let chart_service = {
        let service = state
            .chart_service
            .read()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        service.clone()
    };
    let chart_id_for_read = chart_id.clone();
    let bytes = web::block(move || chart_service.read_chart_bytes(&chart_id_for_read))
        .await
        .map_err(|error| {
            ApiError::Internal(format!(
                "failed to load eAIP chart content in background task: {error}"
            ))
        })?
        .map_err(map_chart_error)?;

    Ok(HttpResponse::Ok()
        .insert_header((header::CONTENT_TYPE, "application/pdf"))
        .insert_header((
            header::CACHE_CONTROL,
            "no-store, no-cache, must-revalidate, private, max-age=0",
        ))
        .insert_header((header::PRAGMA, "no-cache"))
        .insert_header((header::EXPIRES, "0"))
        .insert_header((header::X_CONTENT_TYPE_OPTIONS, "nosniff"))
        .insert_header((
            header::CONTENT_DISPOSITION,
            format!(
                "inline; filename=\"{}\"",
                sanitize_content_disposition_filename(&summary.file_name)
            ),
        ))
        .body(bytes))
}

#[post("/api/v1/eaip/configure")]
async fn configure_eaip(
    state: Data<AppState>,
    payload: Json<ConfigureEaipRequest>,
) -> Result<Json<aip_domain::EaipStatusResponse>, ApiError> {
    let package_path = payload.package_path.trim();
    let password = payload.password.trim();

    if package_path.is_empty() {
        return Err(ApiError::BadRequest(
            "package path must not be blank".to_string(),
        ));
    }

    if password.is_empty() {
        return Err(ApiError::BadRequest(
            "package password must not be blank".to_string(),
        ));
    }

    if !FsPath::new(package_path).exists() {
        return Err(ApiError::BadRequest(format!(
            "package path does not exist: {package_path}"
        )));
    }

    let package_path = package_path.to_string();
    let password = password.to_string();
    let service = web::block(move || {
        EaipChartService::from_package_path(
            PathBuf::from(package_path),
            &password,
            EaipChartService::default_cache_capacity(),
        )
    })
    .await
    .map_err(|error| {
        ApiError::Internal(format!(
            "failed to configure eAIP package in background task: {error}"
        ))
    })?
    .map_err(map_chart_error)?;
    let status = service.status();

    let mut chart_service = state
        .chart_service
        .write()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    *chart_service = service;

    let mut status = status;
    status.max_upload_bytes = eaip_upload_limit_bytes();
    Ok(Json(status))
}

#[post("/api/v1/eaip/pick-package")]
async fn pick_eaip_package() -> Result<Json<PickEaipPackageResponse>, ApiError> {
    let package_path = web::block(|| {
        rfd::FileDialog::new()
            .set_title("Select eAIP package")
            .add_filter("eAIP package", &["aipkg", "aip"])
            .pick_file()
            .map(|path| path.display().to_string())
    })
    .await
    .map_err(|error| {
        ApiError::Internal(format!(
            "failed to open local eAIP package picker in background task: {error}"
        ))
    })?;

    Ok(Json(PickEaipPackageResponse { package_path }))
}

#[post("/api/v1/eaip/upload")]
async fn upload_eaip(
    state: Data<AppState>,
    mut multipart: Multipart,
) -> Result<Json<aip_domain::EaipStatusResponse>, ApiError> {
    let mut password: Option<String> = None;
    let mut package_bytes: Option<Vec<u8>> = None;
    let mut package_file_name: Option<String> = None;

    let upload_limit_bytes = eaip_upload_limit_bytes();

    while let Some(field_result) = multipart.next().await {
        let mut field = field_result.map_err(|error| {
            ApiError::BadRequest(format!("failed to read multipart upload field: {error}"))
        })?;
        let field_name = field
            .content_disposition()
            .and_then(|content| content.get_name())
            .map(str::to_string)
            .unwrap_or_default();

        let mut bytes = Vec::new();
        while let Some(chunk_result) = field.next().await {
            let chunk = chunk_result.map_err(|error| {
                ApiError::BadRequest(format!("failed to read multipart chunk: {error}"))
            })?;
            if field_name == "package"
                && bytes.len().checked_add(chunk.len()).unwrap_or(usize::MAX) > upload_limit_bytes
            {
                return Err(ApiError::BadRequest(format!(
                    "uploaded package exceeds the {} MB in-memory limit",
                    upload_limit_bytes / 1024 / 1024
                )));
            }
            bytes.extend_from_slice(&chunk);
        }

        match field_name.as_str() {
            "password" => {
                let value = String::from_utf8(bytes).map_err(|_| {
                    ApiError::BadRequest("password field must be valid UTF-8".to_string())
                })?;
                password = Some(value);
            }
            "package" => {
                package_file_name = field
                    .content_disposition()
                    .and_then(|content| content.get_filename())
                    .map(sanitize_upload_file_name);
                package_bytes = Some(bytes);
            }
            _ => {}
        }
    }

    let password = password
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| ApiError::BadRequest("upload password is required".to_string()))?;
    let package_bytes = package_bytes
        .filter(|bytes| !bytes.is_empty())
        .ok_or_else(|| ApiError::BadRequest("uploaded package file is required".to_string()))?;
    let package_file_name = package_file_name
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| ApiError::BadRequest("uploaded package file name is missing".to_string()))?;

    let file_name_for_service = package_file_name.clone();
    let service = web::block(move || {
        EaipChartService::from_package_bytes(
            file_name_for_service,
            package_bytes,
            &password,
            EaipChartService::default_cache_capacity(),
        )
    })
    .await
    .map_err(|error| {
        ApiError::Internal(format!(
            "failed to configure uploaded eAIP package in background task: {error}"
        ))
    })?
    .map_err(map_chart_error)?;

    let status = service.status();
    let mut chart_service = state
        .chart_service
        .write()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    *chart_service = service;

    let mut status = status;
    status.max_upload_bytes = upload_limit_bytes;
    Ok(Json(status))
}

#[post("/api/v1/eaip/unload")]
async fn unload_eaip(
    state: Data<AppState>,
) -> Result<Json<aip_domain::EaipStatusResponse>, ApiError> {
    let service = EaipChartService::unloaded(
        "eAIP package was unloaded from memory. No chart package is currently active.",
    );
    let status = service.status();

    let mut chart_service = state
        .chart_service
        .write()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    *chart_service = service;

    let mut status = status;
    status.max_upload_bytes = eaip_upload_limit_bytes();
    Ok(Json(status))
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

#[get("/api/v1/routes/plan")]
async fn route_plan(
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

fn map_weather_error(error: WeatherError) -> ApiError {
    match error {
        WeatherError::InvalidInput(message) => ApiError::BadRequest(message),
        WeatherError::NotFound(message) => ApiError::NotFound(message),
        WeatherError::Upstream(message) => ApiError::Upstream(message),
    }
}

fn map_chart_error(error: ChartError) -> ApiError {
    match error {
        ChartError::InvalidInput(message) => ApiError::BadRequest(message),
        ChartError::Unavailable(message) => ApiError::ServiceUnavailable(message),
        ChartError::NotFound(message) => ApiError::NotFound(message),
        ChartError::Internal(message) => ApiError::Internal(message),
    }
}

fn sanitize_content_disposition_filename(value: &str) -> String {
    value
        .chars()
        .filter(|character| *character != '"' && *character != '\r' && *character != '\n')
        .collect()
}

fn sanitize_upload_file_name(value: &str) -> String {
    value
        .chars()
        .filter(|character| {
            *character != '\0'
                && *character != '\r'
                && *character != '\n'
                && *character != '/'
                && *character != '\\'
        })
        .collect()
}

fn eaip_upload_limit_bytes() -> usize {
    env::var("AIP_EAIP_MAX_UPLOAD_BYTES")
        .ok()
        .and_then(|value| value.trim().parse::<usize>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(DEFAULT_EAIP_UPLOAD_LIMIT_BYTES)
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
        .unwrap_or_else(|_| {
            PathBuf::from(r"F:\bian\jsproject\Open-Navigraph\data\little_navmap_navigraph.sqlite")
        })
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
    let chart_service = Arc::new(RwLock::new(EaipChartService::from_env()));
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
        chart_service,
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
            .service(eaip_status)
            .service(eaip_catalog)
            .service(pick_eaip_package)
            .service(configure_eaip)
            .service(upload_eaip)
            .service(unload_eaip)
            .service(eaip_airport_charts)
            .service(eaip_chart_content)
            .service(map_layers)
            .service(airport_procedures)
            .service(airport_overview)
            .service(procedure_geometry)
            .service(route_plan)
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
