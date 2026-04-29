use actix_cors::Cors;
use actix_web::{get, middleware::Logger, web, App, HttpResponse, HttpServer, Responder};
use aip_domain::AirportSummary;
use serde::Serialize;
use std::{env, io};
use tracing::info;
use tracing_subscriber::EnvFilter;

#[derive(Clone)]
struct AppState {
    sample_airports: Vec<AirportSummary>,
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

#[get("/api/v1/map/sample-airports")]
async fn sample_airports(state: web::Data<AppState>) -> impl Responder {
    HttpResponse::Ok().json(&state.sample_airports)
}

fn sample_airports_fixture() -> Vec<AirportSummary> {
    vec![
        AirportSummary::new("airport:zbaa", "ZBAA", "Beijing Capital", 40.0801, 116.5846),
        AirportSummary::new("airport:zspd", "ZSPD", "Shanghai Pudong", 31.1434, 121.8052),
        AirportSummary::new(
            "airport:zggg",
            "ZGGG",
            "Guangzhou Baiyun",
            23.3924,
            113.2988,
        ),
    ]
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

#[actix_web::main]
async fn main() -> io::Result<()> {
    configure_logging();

    let host = host();
    let port = port();
    let bind_address = format!("{host}:{port}");

    info!("starting browser-mode API at http://{bind_address}");

    let state = web::Data::new(AppState {
        sample_airports: sample_airports_fixture(),
    });

    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .wrap(Logger::default())
            // Phase 0 keeps CORS permissive so the browser app can iterate quickly.
            .wrap(Cors::permissive())
            .service(health)
            .service(version)
            .service(sample_airports)
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

    fn app_state() -> web::Data<AppState> {
        web::Data::new(AppState {
            sample_airports: sample_airports_fixture(),
        })
    }

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

    #[actix_web::test]
    async fn sample_airports_endpoint_returns_fixture_data() {
        let app =
            test::init_service(App::new().app_data(app_state()).service(sample_airports)).await;

        let request = test::TestRequest::get()
            .uri("/api/v1/map/sample-airports")
            .to_request();
        let response = test::call_service(&app, request).await;

        assert_eq!(response.status(), StatusCode::OK);

        let body = to_bytes(response.into_body()).await.unwrap();
        let payload: Value = serde_json::from_slice(&body).unwrap();
        let airports = payload.as_array().unwrap();

        assert_eq!(airports.len(), 3);
        assert_eq!(airports[0]["icao"], "ZBAA");
        assert_eq!(airports[1]["icao"], "ZSPD");
        assert_eq!(airports[2]["icao"], "ZGGG");
    }
}
