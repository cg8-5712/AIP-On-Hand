use actix_web::{body::to_bytes, http::StatusCode, test, App};
use serde_json::Value;

use crate::http::routes::{health, version};

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
