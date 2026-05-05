mod atis;
mod http;

use actix_cors::Cors;
use actix_web::{middleware::Logger, web::Data, App, HttpServer};
use aip_charts::EaipChartService;
use aip_navigation::NavDb;
use aip_weather::WeatherService;
use std::{
    io,
    sync::{Arc, RwLock},
};
use tracing::info;

use crate::http::{
    config::{configure_logging, host, nav_db_path, port},
    eaip::{
        configure_eaip, eaip_airport_charts, eaip_catalog, eaip_chart_content, eaip_status,
        pick_eaip_package, unload_eaip, upload_eaip,
    },
    nav::{
        airport_procedures, airport_runway_ends, airport_transitions, airway_segments, map_layers,
        procedure_geometry, search, transition_geometry,
    },
    routes::{health, version},
    state::AppState,
    weather::{airport_overview, route_plan},
};

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
            .service(airport_transitions)
            .service(airport_runway_ends)
            .service(airport_overview)
            .service(procedure_geometry)
            .service(transition_geometry)
            .service(route_plan)
            .service(search)
            .service(airway_segments)
    })
    .bind(bind_address)?
    .run()
    .await
}
