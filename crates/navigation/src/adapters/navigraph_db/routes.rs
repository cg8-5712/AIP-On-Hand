use super::*;

pub(super) fn build_route_procedure_points(
    connection: &Connection,
    rows: &[ProcedureRow],
    desired_kind: ProcedureKind,
) -> Result<Vec<PlannedProcedurePoint>> {
    let mut grouped: HashMap<i64, (ResolvedWaypoint, f64, Vec<RouteProcedureOption>)> =
        HashMap::new();

    for row in rows {
        let summary = procedures::procedure_summary_from_row(row);
        if summary.procedure_kind != desired_kind {
            continue;
        }

        let (path, _) = procedures::query_procedure_legs(connection, row.approach_id)?;
        let Some(endpoint) = extract_route_endpoint(&path, desired_kind) else {
            continue;
        };
        let Some(ident) = endpoint
            .ident
            .as_deref()
            .map(str::trim)
            .filter(|ident| !ident.is_empty())
        else {
            continue;
        };
        let Some(waypoint) = resolve_waypoint(connection, ident, endpoint.position)? else {
            continue;
        };

        let procedure_distance_nm = polyline_distance_nm(&path);
        let entry = grouped
            .entry(waypoint.waypoint_id)
            .or_insert_with(|| (waypoint.clone(), procedure_distance_nm, Vec::new()));
        entry.1 = entry.1.min(procedure_distance_nm);
        entry.2.push(route_procedure_option_from_summary(&summary));
    }

    let mut points = grouped
        .into_values()
        .map(
            |(waypoint, minimum_procedure_distance_nm, mut procedures)| {
                procedures.sort_by(|left, right| {
                    left.runway_name
                        .cmp(&right.runway_name)
                        .then_with(|| left.name.cmp(&right.name))
                        .then_with(|| left.arinc_name.cmp(&right.arinc_name))
                });
                procedures.dedup_by(|left, right| left.procedure_id == right.procedure_id);

                PlannedProcedurePoint {
                    waypoint_id: waypoint.waypoint_id,
                    point: RouteProcedurePoint {
                        ident: waypoint.ident,
                        location: waypoint.location,
                        minimum_procedure_distance_nm,
                        procedures,
                    },
                }
            },
        )
        .collect::<Vec<_>>();

    points.sort_by(|left, right| {
        left.point
            .minimum_procedure_distance_nm
            .total_cmp(&right.point.minimum_procedure_distance_nm)
            .then_with(|| left.point.ident.cmp(&right.point.ident))
    });

    Ok(points)
}

pub(super) fn build_route_approaches(rows: &[ProcedureRow]) -> Vec<RouteProcedureOption> {
    let mut approaches = rows
        .iter()
        .map(procedures::procedure_summary_from_row)
        .filter(|summary| summary.procedure_kind == ProcedureKind::Approach)
        .map(|summary| route_procedure_option_from_summary(&summary))
        .collect::<Vec<_>>();

    approaches.sort_by(|left, right| {
        left.runway_name
            .cmp(&right.runway_name)
            .then_with(|| left.procedure_type.cmp(&right.procedure_type))
            .then_with(|| left.name.cmp(&right.name))
    });
    approaches.dedup_by(|left, right| left.procedure_id == right.procedure_id);
    approaches
}

fn route_procedure_option_from_summary(summary: &ProcedureSummary) -> RouteProcedureOption {
    RouteProcedureOption {
        procedure_id: summary.id,
        name: summary.name.clone(),
        arinc_name: summary.arinc_name.clone(),
        procedure_type: summary.procedure_type.clone(),
        runway_name: summary.runway_name.clone(),
    }
}

pub(super) fn extract_route_endpoint(
    path: &[ProcedureLegPoint],
    procedure_kind: ProcedureKind,
) -> Option<ProcedureLegPoint> {
    let candidate = match procedure_kind {
        ProcedureKind::Sid => path.iter().rev().find(|point| {
            point
                .ident
                .as_deref()
                .map(str::trim)
                .is_some_and(|ident| !ident.is_empty())
        }),
        ProcedureKind::Star => path.iter().find(|point| {
            point
                .ident
                .as_deref()
                .map(str::trim)
                .is_some_and(|ident| !ident.is_empty())
        }),
        _ => None,
    }?;

    Some(candidate.clone())
}

fn resolve_waypoint(
    connection: &Connection,
    ident: &str,
    location: LatLon,
) -> Result<Option<ResolvedWaypoint>> {
    let ident_key = util::normalized_ident_key(ident);
    let mut statement = connection.prepare(
        "
        select
          waypoint_id,
          ident,
          lonx,
          laty
        from waypoint
        where ident = ?1
        order by
          abs(lonx - ?2) + abs(laty - ?3) asc
        limit 8
        ",
    )?;

    let rows = statement.query_map(params![ident_key, location.lon, location.lat], |row| {
        Ok(ResolvedWaypoint {
            waypoint_id: row.get(0)?,
            ident: row.get(1)?,
            location: LatLon {
                lon: row.get(2)?,
                lat: row.get(3)?,
            },
        })
    })?;

    let mut best_match: Option<(f64, ResolvedWaypoint)> = None;
    for item in rows {
        let waypoint = item?;
        let distance = util::distance_nm(location, waypoint.location);
        match &best_match {
            Some((current_distance, _)) if *current_distance <= distance => {}
            _ => best_match = Some((distance, waypoint)),
        }
    }

    Ok(best_match
        .filter(|(distance, _)| *distance <= 12.0)
        .map(|(_, waypoint)| waypoint))
}

pub(super) fn plan_route_candidates(
    connection: &Connection,
    departure_points: &[PlannedProcedurePoint],
    arrival_points: &[PlannedProcedurePoint],
    approaches: &[RouteProcedureOption],
    cruise_altitude_ft: i64,
    limit: usize,
) -> Result<Vec<RoutePlanCandidate>> {
    if departure_points.is_empty() || arrival_points.is_empty() {
        return Ok(Vec::new());
    }

    let arrival_lookup = arrival_points
        .iter()
        .map(|point| (point.waypoint_id, point))
        .collect::<HashMap<_, _>>();
    let target_ids = arrival_lookup.keys().copied().collect::<HashSet<_>>();
    let mut neighbor_cache: HashMap<i64, Vec<AirwayEdge>> = HashMap::new();
    let mut candidates = Vec::new();

    for departure in departure_points {
        let paths = shortest_paths_to_targets(
            connection,
            departure.waypoint_id,
            &target_ids,
            cruise_altitude_ft,
            &mut neighbor_cache,
        )?;

        for (arrival_waypoint_id, (airway_distance_nm, airways)) in paths {
            if airways.is_empty() {
                continue;
            }

            let Some(arrival) = arrival_lookup.get(&arrival_waypoint_id) else {
                continue;
            };
            let total_distance_nm = departure.point.minimum_procedure_distance_nm
                + airway_distance_nm
                + arrival.point.minimum_procedure_distance_nm;

            candidates.push(RoutePlanCandidate {
                total_distance_nm,
                airway_distance_nm,
                departure: departure.point.clone(),
                airways,
                arrival: arrival.point.clone(),
                approaches: approaches.to_vec(),
            });
        }
    }

    candidates.sort_by(|left, right| {
        left.total_distance_nm
            .total_cmp(&right.total_distance_nm)
            .then_with(|| left.airway_distance_nm.total_cmp(&right.airway_distance_nm))
            .then_with(|| left.departure.ident.cmp(&right.departure.ident))
            .then_with(|| left.arrival.ident.cmp(&right.arrival.ident))
    });
    candidates.truncate(limit);
    Ok(candidates)
}

fn shortest_paths_to_targets(
    connection: &Connection,
    source_waypoint_id: i64,
    target_ids: &HashSet<i64>,
    cruise_altitude_ft: i64,
    neighbor_cache: &mut HashMap<i64, Vec<AirwayEdge>>,
) -> Result<HashMap<i64, (f64, Vec<RouteAirwaySegment>)>> {
    let mut distances = HashMap::<i64, f64>::new();
    let mut previous = HashMap::<i64, PathPrev>::new();
    let mut queue = BinaryHeap::new();
    let mut remaining_targets = target_ids.clone();

    distances.insert(source_waypoint_id, 0.0);
    queue.push(HeapState {
        cost_nm: 0.0,
        waypoint_id: source_waypoint_id,
    });

    while let Some(state) = queue.pop() {
        let Some(&known_cost) = distances.get(&state.waypoint_id) else {
            continue;
        };
        if state.cost_nm > known_cost {
            continue;
        }

        remaining_targets.remove(&state.waypoint_id);
        if remaining_targets.is_empty() {
            break;
        }

        let neighbors = if let Some(cached) = neighbor_cache.get(&state.waypoint_id) {
            cached.clone()
        } else {
            let queried =
                airways::query_airway_neighbors(connection, state.waypoint_id, cruise_altitude_ft)?;
            neighbor_cache.insert(state.waypoint_id, queried.clone());
            queried
        };

        for edge in neighbors {
            let next_cost = state.cost_nm + edge.segment.distance_nm;
            let best_cost = distances
                .get(&edge.neighbor_waypoint_id)
                .copied()
                .unwrap_or(f64::INFINITY);

            if next_cost >= best_cost {
                continue;
            }

            distances.insert(edge.neighbor_waypoint_id, next_cost);
            previous.insert(
                edge.neighbor_waypoint_id,
                PathPrev {
                    previous_waypoint_id: state.waypoint_id,
                    segment: edge.segment.clone(),
                },
            );
            queue.push(HeapState {
                cost_nm: next_cost,
                waypoint_id: edge.neighbor_waypoint_id,
            });
        }
    }

    let mut paths = HashMap::new();
    for target_waypoint_id in target_ids {
        if *target_waypoint_id == source_waypoint_id {
            continue;
        }

        let Some(&distance) = distances.get(target_waypoint_id) else {
            continue;
        };
        let airways = reconstruct_airway_path(&previous, source_waypoint_id, *target_waypoint_id);
        if airways.is_empty() {
            continue;
        }
        paths.insert(*target_waypoint_id, (distance, airways));
    }

    Ok(paths)
}

fn reconstruct_airway_path(
    previous: &HashMap<i64, PathPrev>,
    source_waypoint_id: i64,
    target_waypoint_id: i64,
) -> Vec<RouteAirwaySegment> {
    let mut current_waypoint_id = target_waypoint_id;
    let mut reversed = Vec::new();

    while current_waypoint_id != source_waypoint_id {
        let Some(step) = previous.get(&current_waypoint_id) else {
            return Vec::new();
        };
        reversed.push(step.segment.clone());
        current_waypoint_id = step.previous_waypoint_id;
    }

    reversed.reverse();
    reversed
}

fn polyline_distance_nm(path: &[ProcedureLegPoint]) -> f64 {
    path.windows(2)
        .map(|segment| util::distance_nm(segment[0].position, segment[1].position))
        .sum()
}
