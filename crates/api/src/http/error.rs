use actix_web::{http::StatusCode, HttpResponse, ResponseError};
use aip_charts::ChartError;
use aip_weather::WeatherError;
use serde::Serialize;
use std::fmt;

#[derive(Debug)]
pub enum ApiError {
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
pub struct ErrorResponse {
    pub error: String,
}

pub fn map_weather_error(error: WeatherError) -> ApiError {
    match error {
        WeatherError::InvalidInput(message) => ApiError::BadRequest(message),
        WeatherError::NotFound(message) => ApiError::NotFound(message),
        WeatherError::Upstream(message) => ApiError::Upstream(message),
    }
}

pub fn map_chart_error(error: ChartError) -> ApiError {
    match error {
        ChartError::InvalidInput(message) => ApiError::BadRequest(message),
        ChartError::Unavailable(message) => ApiError::ServiceUnavailable(message),
        ChartError::NotFound(message) => ApiError::NotFound(message),
        ChartError::Internal(message) => ApiError::Internal(message),
    }
}
