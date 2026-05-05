use super::*;

fn query_crosses_antimeridian(query: LayerQuery) -> bool {
    query.west > query.east
}

pub(super) fn query_airports(
    connection: &Connection,
    query: LayerQuery,
    limit: i64,
) -> Result<Vec<AirportFeature>> {
    let where_lon = if query_crosses_antimeridian(query) {
        "(right_lonx >= ?1 or left_lonx <= ?2)"
    } else {
        "right_lonx >= ?1 and left_lonx <= ?2"
    };
    let sql = format!(
        "
        select
          airport_id,
          ident,
          nullif(trim(icao), ''),
          name,
          nullif(trim(country), ''),
          num_approach,
          longest_runway_length,
          lonx,
          laty
        from airport
        where
          is_closed = 0
          and {where_lon}
          and top_laty >= ?3
          and bottom_laty <= ?4
        order by num_approach desc, longest_runway_length desc, ident asc
        limit ?5
        "
    );
    let mut statement = connection.prepare(&sql)?;

    let rows = statement.query_map(
        params![query.west, query.east, query.south, query.north, limit],
        |row| {
            Ok(AirportFeature {
                id: row.get(0)?,
                ident: row.get(1)?,
                icao: row.get(2)?,
                name: row
                    .get::<_, Option<String>>(3)?
                    .unwrap_or_else(|| "Unnamed Airport".to_string()),
                country: row.get(4)?,
                num_approaches: row.get(5)?,
                longest_runway_length: row.get(6)?,
                location: LatLon {
                    lon: row.get(7)?,
                    lat: row.get(8)?,
                },
            })
        },
    )?;

    rows.collect()
}

pub(super) fn query_waypoints(
    connection: &Connection,
    query: LayerQuery,
    limit: i64,
) -> Result<Vec<WaypointFeature>> {
    let where_lon = if query_crosses_antimeridian(query) {
        "(lonx >= ?1 or lonx <= ?2)"
    } else {
        "lonx between ?1 and ?2"
    };
    let sql = format!(
        "
        select
          waypoint_id,
          ident,
          nullif(trim(name), ''),
          nullif(trim(type), ''),
          nullif(trim(arinc_type), ''),
          airport_id,
          nullif(trim(airport_ident), ''),
          lonx,
          laty
        from waypoint
        where
          {where_lon}
          and laty between ?3 and ?4
        order by (num_victor_airway + num_jet_airway) desc, ident asc
        limit ?5
        "
    );
    let mut statement = connection.prepare(&sql)?;

    let rows = statement.query_map(
        params![query.west, query.east, query.south, query.north, limit],
        |row| {
            let airport_id = row.get::<_, Option<i64>>(5)?;

            Ok(WaypointFeature {
                id: row.get(0)?,
                ident: row.get(1)?,
                name: row.get(2)?,
                waypoint_type: row.get(3)?,
                arinc_type: row.get(4)?,
                airport_id,
                is_airport_waypoint: airport_id.is_some(),
                airport_ident: row.get(6)?,
                location: LatLon {
                    lon: row.get(7)?,
                    lat: row.get(8)?,
                },
            })
        },
    )?;

    rows.collect()
}

pub(super) fn query_vors(
    connection: &Connection,
    query: LayerQuery,
    limit: i64,
) -> Result<Vec<NavaidFeature>> {
    let where_lon = if query_crosses_antimeridian(query) {
        "(lonx >= ?1 or lonx <= ?2)"
    } else {
        "lonx between ?1 and ?2"
    };
    let sql = format!(
        "
        select
          vor_id,
          ident,
          nullif(trim(name), ''),
          nullif(trim(type), ''),
          nullif(trim(airport_ident), ''),
          lonx,
          laty
        from vor
        where
          {where_lon}
          and laty between ?3 and ?4
        order by ident asc
        limit ?5
        "
    );
    let mut statement = connection.prepare(&sql)?;

    let rows = statement.query_map(
        params![query.west, query.east, query.south, query.north, limit],
        |row| {
            Ok(NavaidFeature {
                id: row.get(0)?,
                ident: row
                    .get::<_, Option<String>>(1)?
                    .unwrap_or_else(|| "VOR".to_string()),
                name: row.get(2)?,
                navaid_type: "vor".to_string(),
                facility_type: row.get(3)?,
                airport_ident: row.get(4)?,
                location: LatLon {
                    lon: row.get(5)?,
                    lat: row.get(6)?,
                },
            })
        },
    )?;

    rows.collect()
}

pub(super) fn query_ndbs(
    connection: &Connection,
    query: LayerQuery,
    limit: i64,
) -> Result<Vec<NavaidFeature>> {
    let where_lon = if query_crosses_antimeridian(query) {
        "(lonx >= ?1 or lonx <= ?2)"
    } else {
        "lonx between ?1 and ?2"
    };
    let sql = format!(
        "
        select
          ndb_id,
          ident,
          nullif(trim(name), ''),
          nullif(trim(type), ''),
          nullif(trim(airport_ident), ''),
          lonx,
          laty
        from ndb
        where
          {where_lon}
          and laty between ?3 and ?4
        order by ident asc
        limit ?5
        "
    );
    let mut statement = connection.prepare(&sql)?;

    let rows = statement.query_map(
        params![query.west, query.east, query.south, query.north, limit],
        |row| {
            Ok(NavaidFeature {
                id: row.get(0)?,
                ident: row
                    .get::<_, Option<String>>(1)?
                    .unwrap_or_else(|| "NDB".to_string()),
                name: row.get(2)?,
                navaid_type: "ndb".to_string(),
                facility_type: row.get(3)?,
                airport_ident: row.get(4)?,
                location: LatLon {
                    lon: row.get(5)?,
                    lat: row.get(6)?,
                },
            })
        },
    )?;

    rows.collect()
}
