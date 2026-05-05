use super::*;

pub(super) fn query_procedure_rows_for_airport(
    connection: &Connection,
    airport_ident: &str,
) -> Result<Vec<ProcedureRow>> {
    let mut statement = connection.prepare(PROCEDURE_BASE_QUERY)?;
    let rows = statement.query_map(params![airport_ident], map_procedure_row)?;
    rows.collect()
}

pub(super) fn query_procedure_row_by_id(
    connection: &Connection,
    procedure_id: i64,
) -> Result<Option<ProcedureRow>> {
    let mut statement = connection.prepare(PROCEDURE_BY_ID_QUERY)?;
    statement
        .query_row(params![procedure_id], map_procedure_row)
        .optional()
}

pub(super) fn query_transition_rows_for_airport(
    connection: &Connection,
    airport_ident: &str,
) -> Result<Vec<TransitionRow>> {
    let mut statement = connection.prepare(TRANSITION_BASE_QUERY)?;
    let rows = statement.query_map(params![airport_ident], map_transition_row)?;
    rows.collect()
}

pub(super) fn query_transition_row_by_id(
    connection: &Connection,
    transition_id: i64,
) -> Result<Option<TransitionRow>> {
    let mut statement = connection.prepare(TRANSITION_BY_ID_QUERY)?;
    statement
        .query_row(params![transition_id], map_transition_row)
        .optional()
}

fn map_procedure_row(row: &rusqlite::Row<'_>) -> Result<ProcedureRow> {
    Ok(ProcedureRow {
        airport_id: row.get(0)?,
        airport_ident: row.get(1)?,
        airport_icao: row.get(2)?,
        airport_name: row
            .get::<_, Option<String>>(3)?
            .unwrap_or_else(|| "Unnamed Airport".to_string()),
        airport_location: LatLon {
            lon: row.get(4)?,
            lat: row.get(5)?,
        },
        approach_id: row.get(6)?,
        arinc_name: row.get::<_, Option<String>>(7)?.unwrap_or_default(),
        procedure_type: row
            .get::<_, Option<String>>(8)?
            .unwrap_or_else(|| "UNKNOWN".to_string()),
        suffix: row.get(9)?,
        runway_name: row.get(10)?,
        fix_ident: row.get(11)?,
        legs: row.get::<_, i64>(12)? as usize,
        has_missed: row.get::<_, i64>(13)? != 0,
        first_position: util::lat_lon_from_optional(row.get(14)?, row.get(15)?),
        last_position: util::lat_lon_from_optional(row.get(16)?, row.get(17)?),
    })
}

fn map_transition_row(row: &rusqlite::Row<'_>) -> Result<TransitionRow> {
    Ok(TransitionRow {
        airport_id: row.get(0)?,
        airport_ident: row.get(1)?,
        airport_icao: row.get(2)?,
        airport_name: row
            .get::<_, Option<String>>(3)?
            .unwrap_or_else(|| "Unnamed Airport".to_string()),
        airport_location: LatLon {
            lon: row.get(4)?,
            lat: row.get(5)?,
        },
        transition_id: row.get(6)?,
        approach_id: row.get(7)?,
        approach_name: row.get::<_, Option<String>>(8)?.unwrap_or_default(),
        runway_name: row.get(9)?,
        transition_type: row
            .get::<_, Option<String>>(10)?
            .unwrap_or_else(|| "UNKNOWN".to_string()),
        fix_ident: row.get(11)?,
        legs: row.get::<_, i64>(12)? as usize,
    })
}

pub(super) fn query_procedure_legs(
    connection: &Connection,
    procedure_id: i64,
) -> Result<(Vec<ProcedureLegPoint>, Vec<ProcedureLegPoint>)> {
    let mut statement = connection.prepare(
        "
        select
          is_missed,
          nullif(trim(type), ''),
          nullif(trim(fix_ident), ''),
          nullif(trim(fix_region), ''),
          nullif(trim(fix_airport_ident), ''),
          fix_lonx,
          fix_laty,
          nullif(trim(recommended_fix_ident), ''),
          nullif(trim(recommended_fix_region), ''),
          recommended_fix_lonx,
          recommended_fix_laty
        from approach_leg
        where
          approach_id = ?1
          and (
            (coalesce(fix_lonx, recommended_fix_lonx) is not null
             and coalesce(fix_laty, recommended_fix_laty) is not null)
            or trim(coalesce(fix_ident, '')) <> ''
            or trim(coalesce(recommended_fix_ident, '')) <> ''
          )
        order by approach_leg_id asc
        ",
    )?;

    let mut path = Vec::new();
    let mut missed_path = Vec::new();
    let rows = statement.query_map(params![procedure_id], |row| {
        Ok((
            row.get::<_, i64>(0)? != 0,
            row.get::<_, Option<String>>(1)?,
            row.get::<_, Option<String>>(2)?,
            row.get::<_, Option<String>>(3)?,
            row.get::<_, Option<String>>(4)?,
            util::lat_lon_from_optional(
                row.get::<_, Option<f64>>(5)?,
                row.get::<_, Option<f64>>(6)?,
            ),
            row.get::<_, Option<String>>(7)?,
            row.get::<_, Option<String>>(8)?,
            util::lat_lon_from_optional(
                row.get::<_, Option<f64>>(9)?,
                row.get::<_, Option<f64>>(10)?,
            ),
        ))
    })?;

    for item in rows {
        let (
            is_missed,
            leg_type,
            fix_ident,
            fix_region,
            fix_airport_ident,
            fix_position,
            recommended_fix_ident,
            recommended_fix_region,
            recommended_position,
        ) = item?;
        let Some(point) = resolve_procedure_leg_point(
            connection,
            leg_type,
            fix_ident,
            fix_region,
            fix_airport_ident,
            fix_position,
            recommended_fix_ident,
            recommended_fix_region,
            recommended_position,
        )?
        else {
            continue;
        };

        if is_missed {
            missed_path.push(point);
        } else {
            path.push(point);
        }
    }

    Ok((path, missed_path))
}

pub(super) fn query_transition_legs(
    connection: &Connection,
    transition_id: i64,
) -> Result<Vec<ProcedureLegPoint>> {
    let mut statement = connection.prepare(
        "
        select
          nullif(trim(type), ''),
          nullif(trim(fix_ident), ''),
          nullif(trim(fix_region), ''),
          nullif(trim(fix_airport_ident), ''),
          fix_lonx,
          fix_laty,
          nullif(trim(recommended_fix_ident), ''),
          nullif(trim(recommended_fix_region), ''),
          recommended_fix_lonx,
          recommended_fix_laty
        from transition_leg
        where
          transition_id = ?1
          and (
            (coalesce(fix_lonx, recommended_fix_lonx) is not null
             and coalesce(fix_laty, recommended_fix_laty) is not null)
            or trim(coalesce(fix_ident, '')) <> ''
            or trim(coalesce(recommended_fix_ident, '')) <> ''
          )
        order by transition_leg_id asc
        ",
    )?;

    let rows = statement.query_map(params![transition_id], |row| {
        Ok((
            row.get::<_, Option<String>>(0)?,
            row.get::<_, Option<String>>(1)?,
            row.get::<_, Option<String>>(2)?,
            row.get::<_, Option<String>>(3)?,
            util::lat_lon_from_optional(
                row.get::<_, Option<f64>>(4)?,
                row.get::<_, Option<f64>>(5)?,
            ),
            row.get::<_, Option<String>>(6)?,
            row.get::<_, Option<String>>(7)?,
            util::lat_lon_from_optional(
                row.get::<_, Option<f64>>(8)?,
                row.get::<_, Option<f64>>(9)?,
            ),
        ))
    })?;

    let mut path = Vec::new();
    for item in rows {
        let (
            leg_type,
            fix_ident,
            fix_region,
            fix_airport_ident,
            fix_position,
            recommended_fix_ident,
            recommended_fix_region,
            recommended_position,
        ) = item?;
        let Some(point) = resolve_procedure_leg_point(
            connection,
            leg_type,
            fix_ident,
            fix_region,
            fix_airport_ident,
            fix_position,
            recommended_fix_ident,
            recommended_fix_region,
            recommended_position,
        )?
        else {
            continue;
        };
        path.push(point);
    }

    Ok(path)
}

fn resolve_procedure_leg_point(
    connection: &Connection,
    leg_type: Option<String>,
    fix_ident: Option<String>,
    fix_region: Option<String>,
    fix_airport_ident: Option<String>,
    fix_position: Option<LatLon>,
    recommended_fix_ident: Option<String>,
    recommended_fix_region: Option<String>,
    recommended_position: Option<LatLon>,
) -> Result<Option<ProcedureLegPoint>> {
    let ident = util::normalized_optional_string(fix_ident.as_deref())
        .map(str::to_string)
        .or_else(|| {
            util::normalized_optional_string(recommended_fix_ident.as_deref()).map(str::to_string)
        });

    if let Some(position) = fix_position.or(recommended_position) {
        return Ok(Some(ProcedureLegPoint {
            leg_type,
            ident,
            position,
        }));
    }

    let resolved_primary = resolve_nav_ident_position(
        connection,
        fix_ident.as_deref(),
        fix_region.as_deref(),
        fix_airport_ident.as_deref(),
    )?;
    let resolved_fallback = if resolved_primary.is_none() {
        resolve_nav_ident_position(
            connection,
            recommended_fix_ident.as_deref(),
            recommended_fix_region.as_deref(),
            None,
        )?
    } else {
        None
    };

    let Some((resolved_ident, position)) = resolved_primary.or(resolved_fallback) else {
        return Ok(None);
    };

    Ok(Some(ProcedureLegPoint {
        leg_type,
        ident: Some(resolved_ident),
        position,
    }))
}

fn resolve_nav_ident_position(
    connection: &Connection,
    ident: Option<&str>,
    region: Option<&str>,
    airport_ident: Option<&str>,
) -> Result<Option<(String, LatLon)>> {
    let Some(ident) = util::normalized_optional_string(ident) else {
        return Ok(None);
    };
    let ident_key = util::normalized_ident_key(ident);

    for table in ["waypoint", "vor", "ndb"] {
        let candidates = query_nav_ident_candidates(connection, table, &ident_key)?;
        if let Some(candidate) = select_nav_ident_candidate(candidates, region, airport_ident) {
            return Ok(Some((candidate.ident, candidate.location)));
        }
    }

    Ok(None)
}

fn query_nav_ident_candidates(
    connection: &Connection,
    table: &str,
    ident: &str,
) -> Result<Vec<NavIdentCandidate>> {
    let sql = format!(
        "
        select
          ident,
          nullif(trim(region), ''),
          nullif(trim(airport_ident), ''),
          lonx,
          laty
        from {table}
        where ident = ?1
        limit 16
        "
    );
    let mut statement = connection.prepare(&sql)?;
    let rows = statement.query_map(params![ident], |row| {
        Ok(NavIdentCandidate {
            ident: row.get(0)?,
            region: row.get(1)?,
            airport_ident: row.get(2)?,
            location: LatLon {
                lon: row.get(3)?,
                lat: row.get(4)?,
            },
        })
    })?;

    rows.collect()
}

fn select_nav_ident_candidate(
    candidates: Vec<NavIdentCandidate>,
    region: Option<&str>,
    airport_ident: Option<&str>,
) -> Option<NavIdentCandidate> {
    let mut filtered = candidates;

    if let Some(airport_ident) = util::normalized_optional_string(airport_ident) {
        let exact_airport_matches = filtered
            .iter()
            .filter(|candidate| {
                candidate
                    .airport_ident
                    .as_deref()
                    .is_some_and(|value| value.eq_ignore_ascii_case(airport_ident))
            })
            .cloned()
            .collect::<Vec<_>>();
        if !exact_airport_matches.is_empty() {
            filtered = exact_airport_matches;
        }
    }

    if let Some(region) = util::normalized_optional_string(region) {
        let exact_region_matches = filtered
            .iter()
            .filter(|candidate| {
                candidate
                    .region
                    .as_deref()
                    .is_some_and(|value| value.eq_ignore_ascii_case(region))
            })
            .cloned()
            .collect::<Vec<_>>();
        if !exact_region_matches.is_empty() {
            filtered = exact_region_matches;
        }
    }

    if filtered.len() == 1 {
        filtered.into_iter().next()
    } else {
        None
    }
}

pub(super) fn procedure_summary_from_row(row: &ProcedureRow) -> ProcedureSummary {
    let procedure_kind = classify_procedure_kind(
        &row.procedure_type,
        row.suffix.as_deref(),
        row.first_position,
        row.last_position,
        row.airport_location,
        row.has_missed,
    );

    ProcedureSummary {
        id: row.approach_id,
        airport_ident: row.airport_ident.clone(),
        airport_name: row.airport_name.clone(),
        name: procedure_display_name(
            &row.procedure_type,
            &procedure_kind,
            &row.arinc_name,
            row.fix_ident.as_deref(),
        ),
        arinc_name: row.arinc_name.clone(),
        procedure_type: row.procedure_type.clone(),
        procedure_kind,
        runway_name: row.runway_name.clone(),
        legs: row.legs,
    }
}

pub(super) fn transition_summary_from_row(row: &TransitionRow) -> TransitionSummary {
    TransitionSummary {
        id: row.transition_id,
        airport_ident: row.airport_ident.clone(),
        airport_name: row.airport_name.clone(),
        approach_id: row.approach_id,
        approach_name: row.approach_name.clone(),
        runway_name: row.runway_name.clone(),
        name: transition_display_name(row.fix_ident.as_deref(), &row.transition_type),
        transition_type: row.transition_type.clone(),
        legs: row.legs,
    }
}

pub(super) fn procedure_display_name(
    procedure_type: &str,
    procedure_kind: &ProcedureKind,
    arinc_name: &str,
    fix_ident: Option<&str>,
) -> String {
    let arinc_name = arinc_name.trim();
    let fix_ident = fix_ident.unwrap_or_default().trim();

    if matches!(
        procedure_kind,
        ProcedureKind::Sid | ProcedureKind::Star | ProcedureKind::Procedure
    ) && !fix_ident.is_empty()
    {
        return fix_ident.to_string();
    }

    if !arinc_name.is_empty() {
        return arinc_name.to_string();
    }

    if !fix_ident.is_empty() {
        return fix_ident.to_string();
    }

    procedure_type.to_string()
}

fn transition_display_name(fix_ident: Option<&str>, transition_type: &str) -> String {
    let fix_ident = fix_ident.unwrap_or_default().trim();
    if !fix_ident.is_empty() {
        return fix_ident.to_string();
    }

    let transition_type = transition_type.trim();
    if !transition_type.is_empty() {
        return transition_type.to_string();
    }

    "TRANSITION".to_string()
}

pub(super) fn classify_procedure_kind(
    procedure_type: &str,
    suffix: Option<&str>,
    first_position: Option<LatLon>,
    last_position: Option<LatLon>,
    airport_location: LatLon,
    has_missed: bool,
) -> ProcedureKind {
    if procedure_type.eq_ignore_ascii_case("GPS") {
        if let Some(suffix) = suffix.map(str::trim).filter(|suffix| !suffix.is_empty()) {
            if suffix.eq_ignore_ascii_case("D") {
                return ProcedureKind::Sid;
            }

            if suffix.eq_ignore_ascii_case("A") {
                return ProcedureKind::Star;
            }
        }
    }

    if has_missed || !procedure_type.eq_ignore_ascii_case("GPS") {
        return ProcedureKind::Approach;
    }

    match (first_position, last_position) {
        (Some(first), Some(last)) => {
            let start_distance = util::distance_nm(airport_location, first);
            let end_distance = util::distance_nm(airport_location, last);

            if start_distance <= 15.0 && end_distance >= 20.0 {
                ProcedureKind::Sid
            } else if start_distance >= 20.0 && end_distance <= 15.0 {
                ProcedureKind::Star
            } else {
                ProcedureKind::Procedure
            }
        }
        _ => ProcedureKind::Procedure,
    }
}

const PROCEDURE_BASE_QUERY: &str = "
select
  ap.airport_id,
  ap.ident,
  nullif(trim(ap.icao), ''),
  ap.name,
  ap.lonx,
  ap.laty,
  a.approach_id,
  coalesce(a.arinc_name, ''),
  coalesce(a.type, ''),
  nullif(trim(a.suffix), ''),
  nullif(trim(a.runway_name), ''),
  nullif(trim(a.fix_ident), ''),
  (
    select count(*)
    from approach_leg al
    where
      al.approach_id = a.approach_id
      and (
        (coalesce(al.fix_lonx, al.recommended_fix_lonx) is not null
         and coalesce(al.fix_laty, al.recommended_fix_laty) is not null)
        or trim(coalesce(al.fix_ident, '')) <> ''
        or trim(coalesce(al.recommended_fix_ident, '')) <> ''
      )
  ) as legs,
  (
    select count(*)
    from approach_leg al
    where
      al.approach_id = a.approach_id
      and al.is_missed = 1
      and (
        (coalesce(al.fix_lonx, al.recommended_fix_lonx) is not null
         and coalesce(al.fix_laty, al.recommended_fix_laty) is not null)
        or trim(coalesce(al.fix_ident, '')) <> ''
        or trim(coalesce(al.recommended_fix_ident, '')) <> ''
      )
  ) as has_missed,
  (
    select coalesce(al.fix_lonx, al.recommended_fix_lonx)
    from approach_leg al
    where
      al.approach_id = a.approach_id
      and coalesce(al.fix_lonx, al.recommended_fix_lonx) is not null
      and coalesce(al.fix_laty, al.recommended_fix_laty) is not null
    order by al.approach_leg_id asc
    limit 1
  ) as first_lonx,
  (
    select coalesce(al.fix_laty, al.recommended_fix_laty)
    from approach_leg al
    where
      al.approach_id = a.approach_id
      and coalesce(al.fix_lonx, al.recommended_fix_lonx) is not null
      and coalesce(al.fix_laty, al.recommended_fix_laty) is not null
    order by al.approach_leg_id asc
    limit 1
  ) as first_laty,
  (
    select coalesce(al.fix_lonx, al.recommended_fix_lonx)
    from approach_leg al
    where
      al.approach_id = a.approach_id
      and coalesce(al.fix_lonx, al.recommended_fix_lonx) is not null
      and coalesce(al.fix_laty, al.recommended_fix_laty) is not null
      and al.is_missed = 0
    order by al.approach_leg_id desc
    limit 1
  ) as last_lonx,
  (
    select coalesce(al.fix_laty, al.recommended_fix_laty)
    from approach_leg al
    where
      al.approach_id = a.approach_id
      and coalesce(al.fix_lonx, al.recommended_fix_lonx) is not null
      and coalesce(al.fix_laty, al.recommended_fix_laty) is not null
      and al.is_missed = 0
    order by al.approach_leg_id desc
    limit 1
  ) as last_laty
from approach a
join airport ap on ap.airport_id = a.airport_id
where ap.ident = ?1 or coalesce(ap.icao, '') = ?1
order by a.type asc, coalesce(a.fix_ident, a.arinc_name) asc, a.runway_name asc
";

const PROCEDURE_BY_ID_QUERY: &str = "
select
  ap.airport_id,
  ap.ident,
  nullif(trim(ap.icao), ''),
  ap.name,
  ap.lonx,
  ap.laty,
  a.approach_id,
  coalesce(a.arinc_name, ''),
  coalesce(a.type, ''),
  nullif(trim(a.suffix), ''),
  nullif(trim(a.runway_name), ''),
  nullif(trim(a.fix_ident), ''),
  (
    select count(*)
    from approach_leg al
    where
      al.approach_id = a.approach_id
      and (
        (coalesce(al.fix_lonx, al.recommended_fix_lonx) is not null
         and coalesce(al.fix_laty, al.recommended_fix_laty) is not null)
        or trim(coalesce(al.fix_ident, '')) <> ''
        or trim(coalesce(al.recommended_fix_ident, '')) <> ''
      )
  ) as legs,
  (
    select count(*)
    from approach_leg al
    where
      al.approach_id = a.approach_id
      and al.is_missed = 1
      and (
        (coalesce(al.fix_lonx, al.recommended_fix_lonx) is not null
         and coalesce(al.fix_laty, al.recommended_fix_laty) is not null)
        or trim(coalesce(al.fix_ident, '')) <> ''
        or trim(coalesce(al.recommended_fix_ident, '')) <> ''
      )
  ) as has_missed,
  (
    select coalesce(al.fix_lonx, al.recommended_fix_lonx)
    from approach_leg al
    where
      al.approach_id = a.approach_id
      and coalesce(al.fix_lonx, al.recommended_fix_lonx) is not null
      and coalesce(al.fix_laty, al.recommended_fix_laty) is not null
    order by al.approach_leg_id asc
    limit 1
  ) as first_lonx,
  (
    select coalesce(al.fix_laty, al.recommended_fix_laty)
    from approach_leg al
    where
      al.approach_id = a.approach_id
      and coalesce(al.fix_lonx, al.recommended_fix_lonx) is not null
      and coalesce(al.fix_laty, al.recommended_fix_laty) is not null
    order by al.approach_leg_id asc
    limit 1
  ) as first_laty,
  (
    select coalesce(al.fix_lonx, al.recommended_fix_lonx)
    from approach_leg al
    where
      al.approach_id = a.approach_id
      and coalesce(al.fix_lonx, al.recommended_fix_lonx) is not null
      and coalesce(al.fix_laty, al.recommended_fix_laty) is not null
      and al.is_missed = 0
    order by al.approach_leg_id desc
    limit 1
  ) as last_lonx,
  (
    select coalesce(al.fix_laty, al.recommended_fix_laty)
    from approach_leg al
    where
      al.approach_id = a.approach_id
      and coalesce(al.fix_lonx, al.recommended_fix_lonx) is not null
      and coalesce(al.fix_laty, al.recommended_fix_laty) is not null
      and al.is_missed = 0
    order by al.approach_leg_id desc
    limit 1
  ) as last_laty
from approach a
join airport ap on ap.airport_id = a.airport_id
where a.approach_id = ?1
limit 1
";

const TRANSITION_BASE_QUERY: &str = "
select
  ap.airport_id,
  ap.ident,
  nullif(trim(ap.icao), ''),
  ap.name,
  ap.lonx,
  ap.laty,
  t.transition_id,
  a.approach_id,
  coalesce(nullif(trim(a.fix_ident), ''), coalesce(a.arinc_name, '')),
  nullif(trim(a.runway_name), ''),
  coalesce(t.type, ''),
  nullif(trim(t.fix_ident), ''),
  (
    select count(*)
    from transition_leg tl
    where
      tl.transition_id = t.transition_id
      and (
        (coalesce(tl.fix_lonx, tl.recommended_fix_lonx) is not null
         and coalesce(tl.fix_laty, tl.recommended_fix_laty) is not null)
        or trim(coalesce(tl.fix_ident, '')) <> ''
        or trim(coalesce(tl.recommended_fix_ident, '')) <> ''
      )
  ) as legs
from transition t
join approach a on a.approach_id = t.approach_id
join airport ap on ap.airport_id = a.airport_id
where ap.ident = ?1 or coalesce(ap.icao, '') = ?1
order by a.runway_name asc, coalesce(t.fix_ident, '') asc, a.arinc_name asc
";

const TRANSITION_BY_ID_QUERY: &str = "
select
  ap.airport_id,
  ap.ident,
  nullif(trim(ap.icao), ''),
  ap.name,
  ap.lonx,
  ap.laty,
  t.transition_id,
  a.approach_id,
  coalesce(nullif(trim(a.fix_ident), ''), coalesce(a.arinc_name, '')),
  nullif(trim(a.runway_name), ''),
  coalesce(t.type, ''),
  nullif(trim(t.fix_ident), ''),
  (
    select count(*)
    from transition_leg tl
    where
      tl.transition_id = t.transition_id
      and (
        (coalesce(tl.fix_lonx, tl.recommended_fix_lonx) is not null
         and coalesce(tl.fix_laty, tl.recommended_fix_laty) is not null)
        or trim(coalesce(tl.fix_ident, '')) <> ''
        or trim(coalesce(tl.recommended_fix_ident, '')) <> ''
      )
  ) as legs
from transition t
join approach a on a.approach_id = t.approach_id
join airport ap on ap.airport_id = a.airport_id
where t.transition_id = ?1
limit 1
";
