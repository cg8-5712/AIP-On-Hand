use serde::Serialize;

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LatLon {
    pub lat: f64,
    pub lon: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AirportSummary {
    pub id: String,
    pub icao: String,
    pub name: String,
    pub location: LatLon,
}

impl AirportSummary {
    pub fn new(id: &str, icao: &str, name: &str, lat: f64, lon: f64) -> Self {
        Self {
            id: id.to_string(),
            icao: icao.to_string(),
            name: name.to_string(),
            location: LatLon { lat, lon },
        }
    }
}
