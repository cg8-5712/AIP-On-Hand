use super::*;

pub(super) fn search_airports(
    connection: &Connection,
    pattern: &str,
    limit: i64,
) -> Result<Vec<SearchResultItem>> {
    let mut statement = connection.prepare(
        "
        select
          airport_id,
          ident,
          nullif(trim(icao), ''),
          name,
          lonx,
          laty
        from airport
        where
          is_closed = 0
          and (
            upper(ident) like ?1
            or upper(coalesce(icao, '')) like ?1
            or upper(name) like ?1
          )
        order by
          case
            when upper(ident) = ?2 then 0
            when upper(coalesce(icao, '')) = ?2 then 1
            when upper(ident) like ?3 then 2
            else 3
          end,
          num_approach desc,
          ident asc
        limit ?4
        ",
    )?;

    let starts_with = format!("{}%", pattern.trim_matches('%'));
    let exact = pattern.trim_matches('%').to_string();
    let rows = statement.query_map(params![pattern, exact, starts_with, limit], |row| {
        let ident = row.get::<_, String>(1)?;
        let icao = row.get::<_, Option<String>>(2)?;
        Ok(SearchResultItem {
            id: format!("airport:{}", row.get::<_, i64>(0)?),
            entity_type: SearchEntityType::Airport,
            ident,
            name: row.get(3)?,
            airport_ident: icao,
            airport_name: None,
            procedure_id: None,
            procedure_kind: None,
            procedure_type: None,
            runway_name: None,
            airway_type: None,
            location: Some(LatLon {
                lon: row.get(4)?,
                lat: row.get(5)?,
            }),
            from: None,
            to: None,
            path: None,
        })
    })?;

    rows.collect()
}

pub(super) fn search_nav_entities(
    connection: &Connection,
    pattern: &str,
    limit: i64,
) -> Result<Vec<SearchResultItem>> {
    let mut statement = connection.prepare(
        "
        select
          nav_search_id,
          airport_id,
          nullif(trim(airport_ident), ''),
          ident,
          nullif(trim(name), ''),
          nav_type,
          lonx,
          laty
        from nav_search
        where
          (
            upper(ident) like ?1
            or upper(coalesce(name, '')) like ?1
            or upper(coalesce(airport_ident, '')) like ?1
          )
          and nav_type in ('W', 'V', 'VD', 'VT', 'N', 'D')
        order by
          case
            when upper(ident) = ?2 then 0
            when upper(ident) like ?3 then 1
            else 2
          end,
          ident asc
        limit ?4
        ",
    )?;

    let starts_with = format!("{}%", pattern.trim_matches('%'));
    let exact = pattern.trim_matches('%').to_string();
    let rows = statement.query_map(params![pattern, exact, starts_with, limit], |row| {
        let nav_type = row.get::<_, Option<String>>(5)?.unwrap_or_default();
        let entity_type = match nav_type.as_str() {
            "W" => SearchEntityType::Waypoint,
            "V" | "VD" | "VT" | "D" => SearchEntityType::Vor,
            "N" => SearchEntityType::Ndb,
            _ => SearchEntityType::Waypoint,
        };

        Ok(SearchResultItem {
            id: format!("nav:{}", row.get::<_, i64>(0)?),
            entity_type,
            ident: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
            name: row.get(4)?,
            airport_ident: row.get(2)?,
            airport_name: None,
            procedure_id: None,
            procedure_kind: None,
            procedure_type: None,
            runway_name: None,
            airway_type: None,
            location: Some(LatLon {
                lon: row.get(6)?,
                lat: row.get(7)?,
            }),
            from: None,
            to: None,
            path: None,
        })
    })?;

    rows.collect()
}

pub(super) fn search_airways(
    connection: &Connection,
    pattern: &str,
    limit: i64,
) -> Result<Vec<SearchResultItem>> {
    let mut statement = connection.prepare(
        "
        select
          airway_id,
          airway_name,
          airway_type,
          from_lonx,
          from_laty,
          to_lonx,
          to_laty
        from airway
        where upper(airway_name) like ?1
        order by
          case
            when upper(airway_name) = ?2 then 0
            when upper(airway_name) like ?3 then 1
            else 2
          end,
          airway_name asc,
          airway_id asc
        ",
    )?;

    let starts_with = format!("{}%", pattern.trim_matches('%'));
    let exact = pattern.trim_matches('%').to_string();

    let segments: Vec<AirwaySegment> = statement
        .query_map(params![pattern, exact, starts_with], |row| {
            Ok(AirwaySegment {
                id: row.get(0)?,
                name: row.get(1)?,
                airway_type: row.get(2)?,
                from: LatLon {
                    lon: row.get(3)?,
                    lat: row.get(4)?,
                },
                to: LatLon {
                    lon: row.get(5)?,
                    lat: row.get(6)?,
                },
            })
        })?
        .collect::<Result<Vec<_>>>()?;

    let mut airway_groups: HashMap<String, Vec<AirwaySegment>> = HashMap::new();
    for segment in segments {
        airway_groups
            .entry(segment.name.clone())
            .or_insert_with(Vec::new)
            .push(segment);
    }

    let mut results = Vec::new();
    for (airway_name, mut segments) in airway_groups {
        if segments.is_empty() {
            continue;
        }

        let merged_paths = airways::merge_airway_segments(&mut segments);

        for path in merged_paths {
            if path.is_empty() {
                continue;
            }

            let first = &path[0];
            let last = &path[path.len() - 1];

            results.push(SearchResultItem {
                id: format!("airway:{}:{}", airway_name, first.id),
                entity_type: SearchEntityType::Airway,
                ident: airway_name.clone(),
                name: Some(format!("{} segments", path.len())),
                airport_ident: None,
                airport_name: None,
                procedure_id: None,
                procedure_kind: None,
                procedure_type: None,
                runway_name: None,
                airway_type: first.airway_type.clone(),
                location: None,
                from: Some(first.from.clone()),
                to: Some(last.to.clone()),
                path: Some(airways::airway_path_points(&path)),
            });
        }

        if results.len() >= limit as usize {
            break;
        }
    }

    results.truncate(limit as usize);
    Ok(results)
}

pub(super) fn search_procedures(
    connection: &Connection,
    pattern: &str,
    limit: i64,
) -> Result<Vec<SearchResultItem>> {
    let mut statement = connection.prepare(
        "
        select
          ap.airport_id,
          ap.ident,
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
              and al.is_missed = 1
              and al.fix_lonx is not null
              and al.fix_laty is not null
          ) as has_missed,
          (
            select al.fix_lonx
            from approach_leg al
            where
              al.approach_id = a.approach_id
              and al.fix_lonx is not null
              and al.fix_laty is not null
            order by al.approach_leg_id asc
            limit 1
          ) as first_lonx,
          (
            select al.fix_laty
            from approach_leg al
            where
              al.approach_id = a.approach_id
              and al.fix_lonx is not null
              and al.fix_laty is not null
            order by al.approach_leg_id asc
            limit 1
          ) as first_laty,
          (
            select al.fix_lonx
            from approach_leg al
            where
              al.approach_id = a.approach_id
              and al.fix_lonx is not null
              and al.fix_laty is not null
              and al.is_missed = 0
            order by al.approach_leg_id desc
            limit 1
          ) as last_lonx,
          (
            select al.fix_laty
            from approach_leg al
            where
              al.approach_id = a.approach_id
              and al.fix_lonx is not null
              and al.fix_laty is not null
              and al.is_missed = 0
            order by al.approach_leg_id desc
            limit 1
          ) as last_laty
        from approach a
        join airport ap on ap.airport_id = a.airport_id
        where
          upper(coalesce(a.fix_ident, '')) like ?1
          or upper(coalesce(a.arinc_name, '')) like ?1
          or upper(ap.ident) like ?1
          or upper(ap.name) like ?1
        order by
          case
            when upper(coalesce(a.fix_ident, '')) = ?2 then 0
            when upper(coalesce(a.fix_ident, '')) like ?3 then 1
            when upper(coalesce(a.arinc_name, '')) = ?2 then 2
            else 3
          end,
          ap.ident asc,
          coalesce(a.fix_ident, a.arinc_name) asc
        limit ?4
        ",
    )?;

    let starts_with = format!("{}%", pattern.trim_matches('%'));
    let exact = pattern.trim_matches('%').to_string();
    let rows = statement.query_map(params![pattern, exact, starts_with, limit], |row| {
        let airport_location = LatLon {
            lon: row.get(3)?,
            lat: row.get(4)?,
        };
        let procedure_type = row.get::<_, Option<String>>(7)?.unwrap_or_default();
        let procedure_kind = procedures::classify_procedure_kind(
            &procedure_type,
            row.get::<_, Option<String>>(8)?.as_deref(),
            util::lat_lon_from_optional(row.get(12)?, row.get(13)?),
            util::lat_lon_from_optional(row.get(14)?, row.get(15)?),
            airport_location,
            row.get::<_, i64>(11)? != 0,
        );
        let fix_ident = row.get::<_, Option<String>>(10)?;
        let arinc_name = row.get::<_, Option<String>>(6)?.unwrap_or_default();
        let ident = procedures::procedure_display_name(
            &procedure_type,
            &procedure_kind,
            &arinc_name,
            fix_ident.as_deref(),
        );

        Ok(SearchResultItem {
            id: format!("procedure:{}", row.get::<_, i64>(5)?),
            entity_type: match procedure_kind {
                ProcedureKind::Sid => SearchEntityType::Sid,
                ProcedureKind::Star => SearchEntityType::Star,
                ProcedureKind::Approach => SearchEntityType::Approach,
                ProcedureKind::Procedure => SearchEntityType::Procedure,
            },
            ident,
            name: Some(arinc_name),
            airport_ident: Some(row.get::<_, String>(1)?),
            airport_name: row.get(2)?,
            procedure_id: Some(row.get(5)?),
            procedure_kind: Some(procedure_kind),
            procedure_type: Some(procedure_type),
            runway_name: row.get(9)?,
            airway_type: None,
            location: Some(airport_location),
            from: None,
            to: None,
            path: None,
        })
    })?;

    rows.collect()
}

pub(super) fn search_rank(item: &SearchResultItem, query: &str) -> (u8, u8, String) {
    let upper_query = query.to_uppercase();
    let upper_ident = item.ident.to_uppercase();
    let upper_name = item.name.as_deref().unwrap_or_default().to_uppercase();

    let ident_rank = if upper_ident == upper_query {
        0
    } else if upper_ident.starts_with(&upper_query) {
        1
    } else if upper_name == upper_query {
        2
    } else if upper_name.starts_with(&upper_query) {
        3
    } else {
        4
    };

    let type_rank = match item.entity_type {
        SearchEntityType::Airport => 0,
        SearchEntityType::Waypoint => 1,
        SearchEntityType::Vor | SearchEntityType::Ndb => 2,
        SearchEntityType::Sid | SearchEntityType::Star | SearchEntityType::Approach => 3,
        SearchEntityType::Procedure => 4,
        SearchEntityType::Airway => 5,
    };

    (ident_rank, type_rank, upper_ident)
}
