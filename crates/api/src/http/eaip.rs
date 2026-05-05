use actix_multipart::Multipart;
use actix_web::{
    get,
    http::header,
    post,
    web::{self, Data, Json, Path},
    HttpResponse,
};
use aip_charts::EaipChartService;
use futures_util::StreamExt;
use std::path::{Path as FsPath, PathBuf};

use crate::http::{
    config::{
        eaip_upload_limit_bytes, sanitize_content_disposition_filename, sanitize_upload_file_name,
    },
    error::{map_chart_error, ApiError},
    state::AppState,
    types::{ConfigureEaipRequest, PickEaipPackageResponse},
};

#[get("/api/v1/eaip/status")]
pub async fn eaip_status(state: Data<AppState>) -> HttpResponse {
    let service = state
        .chart_service
        .read()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let mut status = service.status();
    status.max_upload_bytes = eaip_upload_limit_bytes();
    HttpResponse::Ok().json(status)
}

#[get("/api/v1/eaip/airports/{airport_ident}/charts")]
pub async fn eaip_airport_charts(
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
pub async fn eaip_catalog(
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
pub async fn eaip_chart_content(
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
pub async fn configure_eaip(
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
pub async fn pick_eaip_package() -> Result<Json<PickEaipPackageResponse>, ApiError> {
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
pub async fn upload_eaip(
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
pub async fn unload_eaip(
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
