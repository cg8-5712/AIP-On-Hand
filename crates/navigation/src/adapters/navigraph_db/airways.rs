use super::*;

pub(super) fn query_airways(
    connection: &Connection,
    query: LayerQuery,
    limit: i64,
) -> Result<Vec<AirwayFeature>> {
    let where_lon = if query.west > query.east {
        "(right_lonx >= ?1 or left_lonx <= ?2)"
    } else {
        "right_lonx >= ?1 and left_lonx <= ?2"
    };
    let sql = format!(
        "
        select
          airway_id,
          airway_name,
          airway_type,
          nullif(trim(route_type), ''),
          nullif(trim(direction), ''),
          minimum_altitude,
          maximum_altitude,
          from_lonx,
          from_laty,
          to_lonx,
          to_laty
        from airway
        where
          {where_lon}
          and top_laty >= ?3
          and bottom_laty <= ?4
        order by airway_type asc, airway_name asc, sequence_no asc
        limit ?5
        "
    );
    let mut statement = connection.prepare(&sql)?;

    let rows = statement.query_map(
        params![query.west, query.east, query.south, query.north, limit],
        |row| {
            Ok(AirwayFeature {
                id: row.get(0)?,
                airway_name: row.get(1)?,
                airway_type: row.get(2)?,
                route_type: row.get(3)?,
                direction: row.get(4)?,
                minimum_altitude: row.get(5)?,
                maximum_altitude: row.get(6)?,
                from: LatLon {
                    lon: row.get(7)?,
                    lat: row.get(8)?,
                },
                to: LatLon {
                    lon: row.get(9)?,
                    lat: row.get(10)?,
                },
            })
        },
    )?;

    rows.collect()
}

pub(super) fn query_airway_segments(
    connection: &Connection,
    airway_name: &str,
) -> Result<Vec<AirwayFeature>> {
    let mut statement = connection.prepare(
        "
        select
          airway_id,
          airway_name,
          airway_type,
          route_type,
          direction,
          minimum_altitude,
          maximum_altitude,
          from_lonx,
          from_laty,
          to_lonx,
          to_laty
        from airway
        where upper(airway_name) = upper(?1)
        order by airway_id asc
        ",
    )?;

    let rows = statement.query_map(params![airway_name], |row| {
        Ok(AirwayFeature {
            id: row.get(0)?,
            airway_name: row.get(1)?,
            airway_type: row.get(2)?,
            route_type: row.get(3)?,
            direction: row.get(4)?,
            minimum_altitude: row.get(5)?,
            maximum_altitude: row.get(6)?,
            from: LatLon {
                lon: row.get(7)?,
                lat: row.get(8)?,
            },
            to: LatLon {
                lon: row.get(9)?,
                lat: row.get(10)?,
            },
        })
    })?;

    rows.collect()
}

pub(super) fn query_airway_neighbors(
    connection: &Connection,
    waypoint_id: i64,
    cruise_altitude_ft: i64,
) -> Result<Vec<AirwayEdge>> {
    let mut statement = connection.prepare(
        "
        select
          a.from_waypoint_id,
          a.to_waypoint_id,
          wf.ident,
          wt.ident,
          a.airway_name,
          a.airway_type,
          nullif(trim(a.route_type), ''),
          nullif(trim(a.direction), ''),
          a.minimum_altitude,
          a.maximum_altitude,
          a.from_lonx,
          a.from_laty,
          a.to_lonx,
          a.to_laty
        from airway a
        join waypoint wf on wf.waypoint_id = a.from_waypoint_id
        join waypoint wt on wt.waypoint_id = a.to_waypoint_id
        where a.from_waypoint_id = ?1 or a.to_waypoint_id = ?1
        ",
    )?;

    let rows = statement.query_map(params![waypoint_id], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, i64>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, String>(5)?,
            row.get::<_, Option<String>>(6)?,
            row.get::<_, Option<String>>(7)?,
            row.get::<_, Option<i64>>(8)?,
            row.get::<_, Option<i64>>(9)?,
            LatLon {
                lon: row.get(10)?,
                lat: row.get(11)?,
            },
            LatLon {
                lon: row.get(12)?,
                lat: row.get(13)?,
            },
        ))
    })?;

    let mut edges = Vec::new();
    for item in rows {
        let (
            from_waypoint_id,
            to_waypoint_id,
            from_ident,
            to_ident,
            airway_name,
            airway_type,
            route_type,
            direction,
            minimum_altitude,
            maximum_altitude,
            from,
            to,
        ) = item?;

        if minimum_altitude.is_some_and(|minimum| cruise_altitude_ft < minimum)
            || maximum_altitude.is_some_and(|maximum| cruise_altitude_ft > maximum)
        {
            continue;
        }

        if airway_allows_departure(
            direction.as_deref(),
            waypoint_id,
            from_waypoint_id,
            to_waypoint_id,
        ) {
            let (neighbor_waypoint_id, from_ident_value, to_ident_value, from_value, to_value) =
                if waypoint_id == from_waypoint_id {
                    (
                        to_waypoint_id,
                        from_ident.clone(),
                        to_ident.clone(),
                        from,
                        to,
                    )
                } else {
                    (
                        from_waypoint_id,
                        to_ident.clone(),
                        from_ident.clone(),
                        to,
                        from,
                    )
                };

            edges.push(AirwayEdge {
                neighbor_waypoint_id,
                segment: RouteAirwaySegment {
                    airway_name: airway_name.clone(),
                    airway_type: airway_type.clone(),
                    route_type: route_type.clone(),
                    direction: direction.clone(),
                    minimum_altitude,
                    maximum_altitude,
                    from_ident: from_ident_value,
                    to_ident: to_ident_value,
                    from: from_value,
                    to: to_value,
                    distance_nm: util::distance_nm(from_value, to_value),
                },
            });
        }
    }

    Ok(edges)
}

pub(super) fn airway_allows_departure(
    direction: Option<&str>,
    current_waypoint_id: i64,
    from_waypoint_id: i64,
    to_waypoint_id: i64,
) -> bool {
    let normalized = direction.unwrap_or("N").trim().to_ascii_uppercase();
    match normalized.as_str() {
        "F" => current_waypoint_id == from_waypoint_id,
        "B" => current_waypoint_id == to_waypoint_id,
        _ => current_waypoint_id == from_waypoint_id || current_waypoint_id == to_waypoint_id,
    }
}

fn reverse_airway_segment(segment: &AirwaySegment) -> AirwaySegment {
    AirwaySegment {
        id: segment.id,
        name: segment.name.clone(),
        airway_type: segment.airway_type.clone(),
        from: segment.to,
        to: segment.from,
    }
}

pub(super) fn airway_path_points(path: &[AirwaySegment]) -> Vec<LatLon> {
    if path.is_empty() {
        return Vec::new();
    }

    let mut points = vec![path[0].from, path[0].to];

    for segment in path.iter().skip(1) {
        if let Some(last_point) = points.last() {
            if points_close(last_point, &segment.from) {
                points.push(segment.to);
                continue;
            }

            if points_close(last_point, &segment.to) {
                points.push(segment.from);
                continue;
            }
        }

        points.push(segment.from);
        points.push(segment.to);
    }

    points
}

pub(super) fn merge_airway_segments(segments: &mut [AirwaySegment]) -> Vec<Vec<AirwaySegment>> {
    if segments.is_empty() {
        return Vec::new();
    }

    let mut paths: Vec<Vec<AirwaySegment>> = Vec::new();
    let mut used = vec![false; segments.len()];

    for start_idx in 0..segments.len() {
        if used[start_idx] {
            continue;
        }

        let mut current_path = vec![start_idx];
        used[start_idx] = true;

        loop {
            let last_idx = *current_path.last().unwrap();
            let last_to = segments[last_idx].to;

            let next = segments.iter().enumerate().find_map(|(idx, seg)| {
                if used[idx] {
                    return None;
                }

                if points_close(&seg.from, &last_to) {
                    Some((idx, false))
                } else if points_close(&seg.to, &last_to) {
                    Some((idx, true))
                } else {
                    None
                }
            });

            if let Some((next_idx, should_reverse)) = next {
                if should_reverse {
                    segments[next_idx] = reverse_airway_segment(&segments[next_idx]);
                }
                current_path.push(next_idx);
                used[next_idx] = true;
            } else {
                break;
            }
        }

        loop {
            let first_idx = current_path[0];
            let first_from = segments[first_idx].from;

            let prev = segments.iter().enumerate().find_map(|(idx, seg)| {
                if used[idx] {
                    return None;
                }

                if points_close(&seg.to, &first_from) {
                    Some((idx, false))
                } else if points_close(&seg.from, &first_from) {
                    Some((idx, true))
                } else {
                    None
                }
            });

            if let Some((prev_idx, should_reverse)) = prev {
                if should_reverse {
                    segments[prev_idx] = reverse_airway_segment(&segments[prev_idx]);
                }
                current_path.insert(0, prev_idx);
                used[prev_idx] = true;
            } else {
                break;
            }
        }

        let path_segments: Vec<AirwaySegment> = current_path
            .into_iter()
            .map(|idx| segments[idx].clone())
            .collect();

        paths.push(path_segments);
    }

    paths
}

pub(super) fn points_close(a: &LatLon, b: &LatLon) -> bool {
    const EPSILON: f64 = 0.0001;
    (a.lat - b.lat).abs() < EPSILON && (a.lon - b.lon).abs() < EPSILON
}
