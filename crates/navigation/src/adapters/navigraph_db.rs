use aip_domain::{
    AirportFeature, AirportProceduresResponse, AirwayFeature, LatLon, LayerTruncation,
    MapLayersResponse, NavDbMetadata, NavaidFeature, ProcedureAirport, ProcedureGeometryResponse,
    ProcedureKind, ProcedureLegPoint, ProcedureSummary, SearchEntityType, SearchResponse,
    SearchResultItem, WaypointFeature,
};
use rusqlite::{params, Connection, OpenFlags, OptionalExtension, Result};
use std::path::{Path, PathBuf};

const AIRPORT_LIMIT: i64 = 400;
const WAYPOINT_LIMIT: i64 = 1200;
const VOR_LIMIT: i64 = 500;
const NDB_LIMIT: i64 = 400;
const AIRWAY_LIMIT: i64 = 1500;
const SEARCH_LIMIT: i64 = 60;

const MIN_AIRWAY_ZOOM: i64 = 4;
const MIN_NAVAID_ZOOM: i64 = 5;
const MIN_WAYPOINT_ZOOM: i64 = 7;

#[derive(Debug, Clone, Copy)]
pub struct LayerQuery {
    pub west: f64,
    pub south: f64,
    pub east: f64,
    pub north: f64,
    pub zoom: i64,
    pub include_airports: bool,
    pub include_waypoints: bool,
    pub include_vors: bool,
    pub include_ndbs: bool,
    pub include_airways: bool,
}

#[derive(Debug, Clone)]
pub struct NavDb {
    path: PathBuf,
    metadata: NavDbMetadata,
}

impl NavDb {
    pub fn new(path: impl Into<PathBuf>) -> Result<Self> {
        let path = path.into();
        let connection = open_read_only(&path)?;
        let metadata = load_metadata(&connection)?;

        Ok(Self { path, metadata })
    }

    pub fn metadata(&self) -> NavDbMetadata {
        self.metadata.clone()
    }

    pub fn load_layers(&self, query: LayerQuery) -> Result<MapLayersResponse> {
        let connection = self.connect()?;

        let airports = if query.include_airports {
            query_airports(&connection, query, AIRPORT_LIMIT)?
        } else {
            Vec::new()
        };

        let waypoints = if query.include_waypoints && query.zoom >= MIN_WAYPOINT_ZOOM {
            query_waypoints(&connection, query, WAYPOINT_LIMIT)?
        } else {
            Vec::new()
        };

        let vors = if query.include_vors && query.zoom >= MIN_NAVAID_ZOOM {
            query_vors(&connection, query, VOR_LIMIT)?
        } else {
            Vec::new()
        };

        let ndbs = if query.include_ndbs && query.zoom >= MIN_NAVAID_ZOOM {
            query_ndbs(&connection, query, NDB_LIMIT)?
        } else {
            Vec::new()
        };

        let airways = if query.include_airways && query.zoom >= MIN_AIRWAY_ZOOM {
            query_airways(&connection, query, AIRWAY_LIMIT)?
        } else {
            Vec::new()
        };

        Ok(MapLayersResponse {
            metadata: self.metadata(),
            truncation: LayerTruncation {
                airports: query.include_airports && airports.len() as i64 >= AIRPORT_LIMIT,
                waypoints: query.include_waypoints
                    && query.zoom >= MIN_WAYPOINT_ZOOM
                    && waypoints.len() as i64 >= WAYPOINT_LIMIT,
                vors: query.include_vors
                    && query.zoom >= MIN_NAVAID_ZOOM
                    && vors.len() as i64 >= VOR_LIMIT,
                ndbs: query.include_ndbs
                    && query.zoom >= MIN_NAVAID_ZOOM
                    && ndbs.len() as i64 >= NDB_LIMIT,
                airways: query.include_airways
                    && query.zoom >= MIN_AIRWAY_ZOOM
                    && airways.len() as i64 >= AIRWAY_LIMIT,
            },
            airports,
            waypoints,
            vors,
            ndbs,
            airways,
        })
    }

    pub fn procedures_for_airport(
        &self,
        airport_ident: &str,
    ) -> Result<Option<AirportProceduresResponse>> {
        let connection = self.connect()?;
        let Some(airport) = query_airport(&connection, airport_ident)? else {
            return Ok(None);
        };

        let rows = query_procedure_rows_for_airport(&connection, &airport.ident)?;
        let procedures = rows
            .iter()
            .map(procedure_summary_from_row)
            .collect::<Vec<_>>();

        Ok(Some(AirportProceduresResponse {
            airport,
            procedures,
        }))
    }

    pub fn procedure_geometry(
        &self,
        procedure_id: i64,
    ) -> Result<Option<ProcedureGeometryResponse>> {
        let connection = self.connect()?;
        let Some(row) = query_procedure_row_by_id(&connection, procedure_id)? else {
            return Ok(None);
        };

        let summary = procedure_summary_from_row(&row);
        let airport = ProcedureAirport {
            id: row.airport_id,
            ident: row.airport_ident.clone(),
            icao: row.airport_icao.clone(),
            name: row.airport_name.clone(),
            location: row.airport_location,
        };

        let (path, missed_path) = query_procedure_legs(&connection, procedure_id)?;

        Ok(Some(ProcedureGeometryResponse {
            summary,
            airport,
            path,
            missed_path,
        }))
    }

    pub fn search(&self, raw_query: &str) -> Result<SearchResponse> {
        let query = raw_query.trim();
        if query.is_empty() {
            return Ok(SearchResponse {
                query: String::new(),
                results: Vec::new(),
            });
        }

        let connection = self.connect()?;
        let pattern = format!("%{}%", query.to_uppercase());

        let mut results = Vec::new();
        results.extend(search_airports(&connection, &pattern, SEARCH_LIMIT / 3)?);
        results.extend(search_nav_entities(&connection, &pattern, SEARCH_LIMIT / 2)?);
        results.extend(search_airways(&connection, &pattern, SEARCH_LIMIT / 4)?);
        results.extend(search_procedures(&connection, &pattern, SEARCH_LIMIT)?);

        results.sort_by(|left, right| {
            let left_rank = search_rank(left, query);
            let right_rank = search_rank(right, query);
            left_rank
                .cmp(&right_rank)
                .then_with(|| left.ident.cmp(&right.ident))
                .then_with(|| left.name.cmp(&right.name))
        });
        results.dedup_by(|left, right| left.id == right.id);
        results.truncate(SEARCH_LIMIT as usize);

        Ok(SearchResponse {
            query: query.to_string(),
            results,
        })
    }

    fn connect(&self) -> Result<Connection> {
        open_read_only(&self.path)
    }
}

#[derive(Debug, Clone)]
struct ProcedureRow {
    airport_id: i64,
    airport_ident: String,
    airport_icao: Option<String>,
    airport_name: String,
    airport_location: LatLon,
    approach_id: i64,
    arinc_name: String,
    procedure_type: String,
    suffix: Option<String>,
    runway_name: Option<String>,
    fix_ident: Option<String>,
    legs: usize,
    has_missed: bool,
    first_position: Option<LatLon>,
    last_position: Option<LatLon>,
}

fn open_read_only(path: &Path) -> Result<Connection> {
    Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)
}

fn load_metadata(connection: &Connection) -> Result<NavDbMetadata> {
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

fn query_airports(
    connection: &Connection,
    query: LayerQuery,
    limit: i64,
) -> Result<Vec<AirportFeature>> {
    let mut statement = connection.prepare(
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
          and right_lonx >= ?1
          and left_lonx <= ?2
          and top_laty >= ?3
          and bottom_laty <= ?4
        order by num_approach desc, longest_runway_length desc, ident asc
        limit ?5
        ",
    )?;

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

fn query_waypoints(
    connection: &Connection,
    query: LayerQuery,
    limit: i64,
) -> Result<Vec<WaypointFeature>> {
    let mut statement = connection.prepare(
        "
        select
          waypoint_id,
          ident,
          nullif(trim(name), ''),
          nullif(trim(type), ''),
          nullif(trim(arinc_type), ''),
          nullif(trim(airport_ident), ''),
          lonx,
          laty
        from waypoint
        where
          lonx between ?1 and ?2
          and laty between ?3 and ?4
        order by (num_victor_airway + num_jet_airway) desc, ident asc
        limit ?5
        ",
    )?;

    let rows = statement.query_map(
        params![query.west, query.east, query.south, query.north, limit],
        |row| {
            Ok(WaypointFeature {
                id: row.get(0)?,
                ident: row.get(1)?,
                name: row.get(2)?,
                waypoint_type: row.get(3)?,
                arinc_type: row.get(4)?,
                airport_ident: row.get(5)?,
                location: LatLon {
                    lon: row.get(6)?,
                    lat: row.get(7)?,
                },
            })
        },
    )?;

    rows.collect()
}

fn query_vors(
    connection: &Connection,
    query: LayerQuery,
    limit: i64,
) -> Result<Vec<NavaidFeature>> {
    let mut statement = connection.prepare(
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
          lonx between ?1 and ?2
          and laty between ?3 and ?4
        order by ident asc
        limit ?5
        ",
    )?;

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

fn query_ndbs(
    connection: &Connection,
    query: LayerQuery,
    limit: i64,
) -> Result<Vec<NavaidFeature>> {
    let mut statement = connection.prepare(
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
          lonx between ?1 and ?2
          and laty between ?3 and ?4
        order by ident asc
        limit ?5
        ",
    )?;

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

fn query_airways(
    connection: &Connection,
    query: LayerQuery,
    limit: i64,
) -> Result<Vec<AirwayFeature>> {
    let mut statement = connection.prepare(
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
          right_lonx >= ?1
          and left_lonx <= ?2
          and top_laty >= ?3
          and bottom_laty <= ?4
        order by airway_type asc, airway_name asc, sequence_no asc
        limit ?5
        ",
    )?;

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

fn query_airport(connection: &Connection, airport_ident: &str) -> Result<Option<ProcedureAirport>> {
    connection
        .query_row(
            "
            select
              airport_id,
              ident,
              nullif(trim(icao), ''),
              name,
              lonx,
              laty
            from airport
            where ident = ?1 or coalesce(icao, '') = ?1
            limit 1
            ",
            params![airport_ident],
            |row| {
                Ok(ProcedureAirport {
                    id: row.get(0)?,
                    ident: row.get(1)?,
                    icao: row.get(2)?,
                    name: row
                        .get::<_, Option<String>>(3)?
                        .unwrap_or_else(|| "Unnamed Airport".to_string()),
                    location: LatLon {
                        lon: row.get(4)?,
                        lat: row.get(5)?,
                    },
                })
            },
        )
        .optional()
}

fn query_procedure_rows_for_airport(
    connection: &Connection,
    airport_ident: &str,
) -> Result<Vec<ProcedureRow>> {
    let mut statement = connection.prepare(PROCEDURE_BASE_QUERY)?;
    let rows = statement.query_map(params![airport_ident], map_procedure_row)?;
    rows.collect()
}

fn query_procedure_row_by_id(
    connection: &Connection,
    procedure_id: i64,
) -> Result<Option<ProcedureRow>> {
    let mut statement = connection.prepare(PROCEDURE_BY_ID_QUERY)?;
    statement
        .query_row(params![procedure_id], map_procedure_row)
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
        first_position: lat_lon_from_optional(row.get(14)?, row.get(15)?),
        last_position: lat_lon_from_optional(row.get(16)?, row.get(17)?),
    })
}

fn query_procedure_legs(
    connection: &Connection,
    procedure_id: i64,
) -> Result<(Vec<ProcedureLegPoint>, Vec<ProcedureLegPoint>)> {
    let mut statement = connection.prepare(
        "
        select
          is_missed,
          nullif(trim(type), ''),
          nullif(trim(fix_ident), ''),
          fix_lonx,
          fix_laty
        from approach_leg
        where
          approach_id = ?1
          and fix_lonx is not null
          and fix_laty is not null
        order by approach_leg_id asc
        ",
    )?;

    let mut path = Vec::new();
    let mut missed_path = Vec::new();
    let rows = statement.query_map(params![procedure_id], |row| {
        Ok((
            row.get::<_, i64>(0)? != 0,
            ProcedureLegPoint {
                leg_type: row.get(1)?,
                ident: row.get(2)?,
                position: LatLon {
                    lon: row.get(3)?,
                    lat: row.get(4)?,
                },
            },
        ))
    })?;

    for item in rows {
        let (is_missed, point) = item?;
        if is_missed {
            missed_path.push(point);
        } else {
            path.push(point);
        }
    }

    Ok((path, missed_path))
}

fn procedure_summary_from_row(row: &ProcedureRow) -> ProcedureSummary {
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

fn procedure_display_name(
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

fn classify_procedure_kind(
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
            let start_distance = distance_nm(airport_location, first);
            let end_distance = distance_nm(airport_location, last);

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

fn search_airports(connection: &Connection, pattern: &str, limit: i64) -> Result<Vec<SearchResultItem>> {
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
        })
    })?;

    rows.collect()
}

fn search_nav_entities(
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
        })
    })?;

    rows.collect()
}

fn search_airways(connection: &Connection, pattern: &str, limit: i64) -> Result<Vec<SearchResultItem>> {
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
        group by airway_name, airway_type, from_lonx, from_laty, to_lonx, to_laty
        order by
          case
            when upper(airway_name) = ?2 then 0
            when upper(airway_name) like ?3 then 1
            else 2
          end,
          airway_name asc
        limit ?4
        ",
    )?;

    let starts_with = format!("{}%", pattern.trim_matches('%'));
    let exact = pattern.trim_matches('%').to_string();
    let rows = statement.query_map(params![pattern, exact, starts_with, limit], |row| {
        Ok(SearchResultItem {
            id: format!("airway:{}", row.get::<_, i64>(0)?),
            entity_type: SearchEntityType::Airway,
            ident: row.get(1)?,
            name: None,
            airport_ident: None,
            airport_name: None,
            procedure_id: None,
            procedure_kind: None,
            procedure_type: None,
            runway_name: None,
            airway_type: row.get(2)?,
            location: None,
            from: Some(LatLon {
                lon: row.get(3)?,
                lat: row.get(4)?,
            }),
            to: Some(LatLon {
                lon: row.get(5)?,
                lat: row.get(6)?,
            }),
        })
    })?;

    rows.collect()
}

fn search_procedures(connection: &Connection, pattern: &str, limit: i64) -> Result<Vec<SearchResultItem>> {
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
        let procedure_kind = classify_procedure_kind(
            &procedure_type,
            row.get::<_, Option<String>>(8)?.as_deref(),
            lat_lon_from_optional(row.get(12)?, row.get(13)?),
            lat_lon_from_optional(row.get(14)?, row.get(15)?),
            airport_location,
            row.get::<_, i64>(11)? != 0,
        );
        let fix_ident = row.get::<_, Option<String>>(10)?;
        let arinc_name = row.get::<_, Option<String>>(6)?.unwrap_or_default();
        let ident = procedure_display_name(
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
        })
    })?;

    rows.collect()
}

fn search_rank(item: &SearchResultItem, query: &str) -> (u8, u8, String) {
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

fn distance_nm(a: LatLon, b: LatLon) -> f64 {
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

fn lat_lon_from_optional(lon: Option<f64>, lat: Option<f64>) -> Option<LatLon> {
    match (lon, lat) {
        (Some(lon), Some(lat)) => Some(LatLon { lon, lat }),
        _ => None,
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
      and al.fix_lonx is not null
      and al.fix_laty is not null
  ) as legs,
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
      and al.fix_lonx is not null
      and al.fix_laty is not null
  ) as legs,
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
where a.approach_id = ?1
limit 1
";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_departure_when_route_starts_at_airport_and_moves_out() {
        let airport = LatLon {
            lat: 40.0,
            lon: 116.0,
        };
        let first = LatLon {
            lat: 40.01,
            lon: 116.01,
        };
        let last = LatLon {
            lat: 41.0,
            lon: 117.0,
        };

        let kind = classify_procedure_kind("GPS", Some("D"), Some(first), Some(last), airport, false);
        assert!(matches!(kind, ProcedureKind::Sid));
    }

    #[test]
    fn classifies_arrival_when_route_ends_at_airport() {
        let airport = LatLon {
            lat: 40.0,
            lon: 116.0,
        };
        let first = LatLon {
            lat: 41.0,
            lon: 117.0,
        };
        let last = LatLon {
            lat: 40.01,
            lon: 116.01,
        };

        let kind = classify_procedure_kind("GPS", Some("A"), Some(first), Some(last), airport, false);
        assert!(matches!(kind, ProcedureKind::Star));
    }

    #[test]
    fn keeps_missed_procedure_as_approach() {
        let airport = LatLon {
            lat: 40.0,
            lon: 116.0,
        };
        let first = LatLon {
            lat: 41.0,
            lon: 117.0,
        };
        let last = LatLon {
            lat: 40.01,
            lon: 116.01,
        };

        let kind = classify_procedure_kind("GPS", None, Some(first), Some(last), airport, true);
        assert!(matches!(kind, ProcedureKind::Approach));
    }

    #[test]
    fn classifies_suffix_d_as_sid_without_geometry_guessing() {
        let airport = LatLon { lat: 0.0, lon: 0.0 };
        let kind = classify_procedure_kind("GPS", Some("D"), None, None, airport, false);
        assert!(matches!(kind, ProcedureKind::Sid));
    }

    #[test]
    fn classifies_suffix_a_as_star_without_geometry_guessing() {
        let airport = LatLon { lat: 0.0, lon: 0.0 };
        let kind = classify_procedure_kind("GPS", Some("A"), None, None, airport, false);
        assert!(matches!(kind, ProcedureKind::Star));
    }

    #[test]
    fn keeps_vor_a_as_approach() {
        let airport = LatLon { lat: 0.0, lon: 0.0 };
        let kind = classify_procedure_kind("VOR", Some("A"), None, None, airport, false);
        assert!(matches!(kind, ProcedureKind::Approach));
    }
}
