use actix_web::{get, HttpResponse, Responder};

use crate::http::types::{HealthResponse, VersionResponse};

#[get("/api/v1/health")]
pub async fn health() -> impl Responder {
    HttpResponse::Ok().json(HealthResponse {
        service: "aip-on-hand-api",
        status: "ok",
    })
}

#[get("/api/v1/version")]
pub async fn version() -> impl Responder {
    HttpResponse::Ok().json(VersionResponse {
        service: env!("CARGO_PKG_NAME"),
        version: env!("CARGO_PKG_VERSION"),
    })
}
