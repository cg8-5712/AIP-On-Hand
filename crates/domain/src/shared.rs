use serde::Serialize;

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LatLon {
    pub lat: f64,
    pub lon: f64,
}
