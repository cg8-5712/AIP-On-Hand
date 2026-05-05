use aip_charts::EaipChartService;
use aip_navigation::NavDb;
use aip_weather::WeatherService;
use std::sync::{Arc, RwLock};

#[derive(Clone)]
pub struct AppState {
    pub nav_db: NavDb,
    pub chart_service: Arc<RwLock<EaipChartService>>,
    pub weather_service: WeatherService,
}
