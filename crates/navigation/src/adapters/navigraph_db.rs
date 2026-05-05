mod airports;
mod airways;
mod layers;
mod procedures;
mod routes;
mod search;
#[cfg(test)]
mod tests;
mod util;

use aip_domain::{
    AirportCommunication, AirportFeature, AirportProceduresResponse, AirportRunwayEnd,
    AirportTransitionsResponse, AirwayFeature, LatLon, LayerTruncation, MapLayersResponse,
    NavDbMetadata, NavaidFeature, ProcedureAirport, ProcedureGeometryResponse, ProcedureKind,
    ProcedureLegPoint, ProcedureSummary, RouteAirwaySegment, RoutePlanCandidate, RoutePlanResponse,
    RouteProcedureOption, RouteProcedurePoint, SearchEntityType, SearchResponse, SearchResultItem,
    TransitionGeometryResponse, TransitionSummary, WaypointFeature,
};
use rusqlite::{params, Connection, OpenFlags, OptionalExtension, Result};
use std::{
    cmp::Ordering,
    collections::{BinaryHeap, HashMap, HashSet},
    path::{Path, PathBuf},
};

use self::{
    airports::{query_airport, query_airport_communications, query_airport_runway_ends},
    airways::{query_airway_segments, query_airways},
    layers::{query_airports, query_ndbs, query_vors, query_waypoints},
    procedures::{
        procedure_summary_from_row, query_procedure_legs, query_procedure_row_by_id,
        query_procedure_rows_for_airport, query_transition_legs, query_transition_row_by_id,
        query_transition_rows_for_airport, transition_summary_from_row,
    },
    routes::{build_route_approaches, build_route_procedure_points, plan_route_candidates},
    search::{
        search_airports, search_airways, search_nav_entities, search_procedures, search_rank,
    },
    util::{load_metadata, open_read_only},
};

#[cfg(test)]
use self::{
    airways::{airway_allows_departure, airway_path_points, merge_airway_segments, points_close},
    procedures::classify_procedure_kind,
    routes::extract_route_endpoint,
};

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
struct AirwaySegment {
    id: i64,
    name: String,
    airway_type: Option<String>,
    from: LatLon,
    to: LatLon,
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

    pub fn transitions_for_airport(
        &self,
        airport_ident: &str,
    ) -> Result<Option<AirportTransitionsResponse>> {
        let connection = self.connect()?;
        let Some(airport) = query_airport(&connection, airport_ident)? else {
            return Ok(None);
        };

        let rows = query_transition_rows_for_airport(&connection, &airport.ident)?;
        let transitions = rows
            .iter()
            .map(transition_summary_from_row)
            .collect::<Vec<_>>();

        Ok(Some(AirportTransitionsResponse {
            airport,
            transitions,
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

    pub fn transition_geometry(
        &self,
        transition_id: i64,
    ) -> Result<Option<TransitionGeometryResponse>> {
        let connection = self.connect()?;
        let Some(row) = query_transition_row_by_id(&connection, transition_id)? else {
            return Ok(None);
        };

        let summary = transition_summary_from_row(&row);
        let airport = ProcedureAirport {
            id: row.airport_id,
            ident: row.airport_ident.clone(),
            icao: row.airport_icao.clone(),
            name: row.airport_name.clone(),
            location: row.airport_location,
        };
        let path = query_transition_legs(&connection, transition_id)?;

        Ok(Some(TransitionGeometryResponse {
            summary,
            airport,
            path,
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
        results.extend(search_nav_entities(
            &connection,
            &pattern,
            SEARCH_LIMIT / 2,
        )?);
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

    pub fn airport_communications(&self, airport_ident: &str) -> Result<Vec<AirportCommunication>> {
        let normalized_ident = airport_ident.trim();
        if normalized_ident.is_empty() {
            return Ok(Vec::new());
        }

        let connection = self.connect()?;
        query_airport_communications(&connection, normalized_ident)
    }

    pub fn airport_runway_ends(&self, airport_ident: &str) -> Result<Vec<AirportRunwayEnd>> {
        let normalized_ident = airport_ident.trim();
        if normalized_ident.is_empty() {
            return Ok(Vec::new());
        }

        let connection = self.connect()?;
        query_airport_runway_ends(&connection, normalized_ident)
    }

    pub fn airway_segments(&self, airway_name: &str) -> Result<Vec<AirwayFeature>> {
        let normalized_name = airway_name.trim();
        if normalized_name.is_empty() {
            return Ok(Vec::new());
        }

        let connection = self.connect()?;
        query_airway_segments(&connection, normalized_name)
    }

    pub fn plan_routes(
        &self,
        departure_airport_ident: &str,
        arrival_airport_ident: &str,
        cruise_altitude_ft: i64,
        limit: usize,
    ) -> Result<Option<RoutePlanResponse>> {
        let connection = self.connect()?;
        let Some(departure_airport) = query_airport(&connection, departure_airport_ident)? else {
            return Ok(None);
        };
        let Some(arrival_airport) = query_airport(&connection, arrival_airport_ident)? else {
            return Ok(None);
        };

        let departure_rows =
            query_procedure_rows_for_airport(&connection, &departure_airport.ident)?;
        let arrival_rows = query_procedure_rows_for_airport(&connection, &arrival_airport.ident)?;

        let departure_points =
            build_route_procedure_points(&connection, &departure_rows, ProcedureKind::Sid)?;
        let arrival_points =
            build_route_procedure_points(&connection, &arrival_rows, ProcedureKind::Star)?;
        let approaches = build_route_approaches(&arrival_rows);

        let mut notes = vec![
            "候选按离场/进场程序点分组，具体跑道与程序请结合风向和运行条件选择。".to_string(),
            "航路仅保留满足当前巡航高度以及单向/双向限制的 airway 段。".to_string(),
            "进近程序只列出目的场候选，本次规划不会自动锁定最终跑道。".to_string(),
        ];

        if departure_points.is_empty() {
            notes.push("离场机场没有解析出可用于接入航路网的 SID 程序点。".to_string());
        }

        if arrival_points.is_empty() {
            notes.push("到达机场没有解析出可用于接出航路网的 STAR 程序点。".to_string());
        }

        let candidates = plan_route_candidates(
            &connection,
            &departure_points,
            &arrival_points,
            &approaches,
            cruise_altitude_ft,
            limit.max(1),
        )?;

        Ok(Some(RoutePlanResponse {
            departure_airport,
            arrival_airport,
            cruise_altitude_ft,
            candidates,
            notes,
        }))
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

#[derive(Debug, Clone)]
struct TransitionRow {
    airport_id: i64,
    airport_ident: String,
    airport_icao: Option<String>,
    airport_name: String,
    airport_location: LatLon,
    transition_id: i64,
    approach_id: i64,
    approach_name: String,
    runway_name: Option<String>,
    transition_type: String,
    fix_ident: Option<String>,
    legs: usize,
}

#[derive(Debug, Clone)]
struct ResolvedWaypoint {
    waypoint_id: i64,
    ident: String,
    location: LatLon,
}

#[derive(Debug, Clone)]
struct NavIdentCandidate {
    ident: String,
    region: Option<String>,
    airport_ident: Option<String>,
    location: LatLon,
}

#[derive(Debug, Clone)]
struct PlannedProcedurePoint {
    waypoint_id: i64,
    point: RouteProcedurePoint,
}

#[derive(Debug, Clone)]
struct AirwayEdge {
    neighbor_waypoint_id: i64,
    segment: RouteAirwaySegment,
}

#[derive(Debug, Clone)]
struct PathPrev {
    previous_waypoint_id: i64,
    segment: RouteAirwaySegment,
}

#[derive(Debug, Clone, Copy)]
struct HeapState {
    cost_nm: f64,
    waypoint_id: i64,
}

impl PartialEq for HeapState {
    fn eq(&self, other: &Self) -> bool {
        self.waypoint_id == other.waypoint_id && self.cost_nm.to_bits() == other.cost_nm.to_bits()
    }
}

impl Eq for HeapState {}

impl PartialOrd for HeapState {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for HeapState {
    fn cmp(&self, other: &Self) -> Ordering {
        other
            .cost_nm
            .total_cmp(&self.cost_nm)
            .then_with(|| self.waypoint_id.cmp(&other.waypoint_id))
    }
}
