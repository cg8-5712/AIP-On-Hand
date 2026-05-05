use std::{env, path::PathBuf};

use tracing_subscriber::EnvFilter;

pub const DEFAULT_EAIP_UPLOAD_LIMIT_BYTES: usize = 512 * 1024 * 1024;

pub fn sanitize_content_disposition_filename(value: &str) -> String {
    value
        .chars()
        .filter(|character| *character != '"' && *character != '\r' && *character != '\n')
        .collect()
}

pub fn sanitize_upload_file_name(value: &str) -> String {
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

pub fn eaip_upload_limit_bytes() -> usize {
    env::var("AIP_EAIP_MAX_UPLOAD_BYTES")
        .ok()
        .and_then(|value| value.trim().parse::<usize>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(DEFAULT_EAIP_UPLOAD_LIMIT_BYTES)
}

pub fn configure_logging() {
    let filter =
        EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info,actix_web=info"));

    tracing_subscriber::fmt().with_env_filter(filter).init();
}

pub fn host() -> String {
    env::var("AIP_API_HOST").unwrap_or_else(|_| "127.0.0.1".to_string())
}

pub fn port() -> u16 {
    env::var("AIP_API_PORT")
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(8080)
}

pub fn nav_db_path() -> PathBuf {
    env::var("AIP_NAVDB_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            // PathBuf::from(r"F:\bian\jsproject\Open-Navigraph\data\little_navmap_navigraph.sqlite")
            PathBuf::from(r"E:\msg\little_navmap_xp12.sqlite")
        })
}
