use super::*;

pub(super) fn open_read_only(path: &Path) -> Result<Connection> {
    Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)
}

pub(super) fn load_metadata(connection: &Connection) -> Result<NavDbMetadata> {
    connection.query_row(
        "select airac_cycle, valid_through, data_source, has_sid_star from metadata limit 1",
        [],
        |row| {
            Ok(NavDbMetadata {
                airac_cycle: row.get::<_, Option<String>>(0)?.unwrap_or_default(),
                valid_through: row.get::<_, Option<String>>(1)?.unwrap_or_default(),
                data_source: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                has_sid_star: row.get::<_, i64>(3)? != 0,
            })
        },
    )
}

pub(super) fn distance_nm(a: LatLon, b: LatLon) -> f64 {
    let earth_radius_nm = 3440.065_f64;
    let lat1 = a.lat.to_radians();
    let lat2 = b.lat.to_radians();
    let dlat = (b.lat - a.lat).to_radians();
    let dlon = (b.lon - a.lon).to_radians();

    let haversine =
        (dlat / 2.0).sin().powi(2) + lat1.cos() * lat2.cos() * (dlon / 2.0).sin().powi(2);
    let central_angle = 2.0 * haversine.sqrt().atan2((1.0 - haversine).sqrt());

    earth_radius_nm * central_angle
}

pub(super) fn lat_lon_from_optional(lon: Option<f64>, lat: Option<f64>) -> Option<LatLon> {
    match (lon, lat) {
        (Some(lon), Some(lat)) => Some(LatLon { lon, lat }),
        _ => None,
    }
}

pub(super) fn normalized_optional_string(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|value| !value.is_empty())
}

pub(super) fn normalized_ident_key(value: &str) -> String {
    value.trim().to_ascii_uppercase()
}
