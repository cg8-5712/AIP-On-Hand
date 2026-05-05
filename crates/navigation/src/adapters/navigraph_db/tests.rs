use super::*;

fn create_leg_resolution_schema(connection: &Connection) {
    connection
        .execute_batch(
            "
            create table waypoint (
              waypoint_id integer primary key,
              ident text not null,
              region text,
              airport_ident text,
              lonx real not null,
              laty real not null
            );
            create table vor (
              vor_id integer primary key,
              ident text not null,
              region text,
              airport_ident text,
              lonx real not null,
              laty real not null
            );
            create table ndb (
              ndb_id integer primary key,
              ident text not null,
              region text,
              airport_ident text,
              lonx real not null,
              laty real not null
            );
            create table approach_leg (
              approach_leg_id integer primary key,
              approach_id integer not null,
              is_missed integer not null,
              type text,
              fix_ident text,
              fix_region text,
              fix_airport_ident text,
              fix_lonx real,
              fix_laty real,
              recommended_fix_ident text,
              recommended_fix_region text,
              recommended_fix_lonx real,
              recommended_fix_laty real
            );
            create table transition_leg (
              transition_leg_id integer primary key,
              transition_id integer not null,
              type text not null,
              fix_ident text,
              fix_region text,
              fix_airport_ident text,
              fix_lonx real,
              fix_laty real,
              recommended_fix_ident text,
              recommended_fix_region text,
              recommended_fix_lonx real,
              recommended_fix_laty real
            );
            ",
        )
        .expect("schema");
}

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

#[test]
fn extracts_sid_endpoint_from_last_named_fix() {
    let path = vec![
        ProcedureLegPoint {
            ident: Some("DER01".to_string()),
            leg_type: Some("DF".to_string()),
            position: LatLon {
                lat: 40.09,
                lon: 116.61,
            },
        },
        ProcedureLegPoint {
            ident: Some("BOTPU".to_string()),
            leg_type: Some("TF".to_string()),
            position: LatLon {
                lat: 39.98,
                lon: 115.47,
            },
        },
    ];

    let endpoint = extract_route_endpoint(&path, ProcedureKind::Sid).expect("sid endpoint");
    assert_eq!(endpoint.ident.as_deref(), Some("BOTPU"));
}

#[test]
fn extracts_star_endpoint_from_first_named_fix() {
    let path = vec![
        ProcedureLegPoint {
            ident: Some("AND".to_string()),
            leg_type: Some("TF".to_string()),
            position: LatLon {
                lat: 31.58,
                lon: 121.91,
            },
        },
        ProcedureLegPoint {
            ident: Some("IA340".to_string()),
            leg_type: Some("TF".to_string()),
            position: LatLon {
                lat: 31.24,
                lon: 121.83,
            },
        },
    ];

    let endpoint = extract_route_endpoint(&path, ProcedureKind::Star).expect("star endpoint");
    assert_eq!(endpoint.ident.as_deref(), Some("AND"));
}

#[test]
fn procedure_legs_fall_back_to_region_scoped_waypoint_positions() {
    let connection = Connection::open_in_memory().expect("memory db");
    create_leg_resolution_schema(&connection);

    connection
        .execute(
            "insert into waypoint (waypoint_id, ident, region, airport_ident, lonx, laty)
             values (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                1_i64,
                "BOTPU",
                "ZB",
                Option::<String>::None,
                116.41_f64,
                40.12_f64
            ],
        )
        .expect("waypoint");
    connection
        .execute(
            "insert into waypoint (waypoint_id, ident, region, airport_ident, lonx, laty)
             values (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                2_i64,
                "BOTPU",
                "XX",
                Option::<String>::None,
                -10.0_f64,
                -10.0_f64
            ],
        )
        .expect("waypoint duplicate");
    connection
        .execute(
            "insert into waypoint (waypoint_id, ident, region, airport_ident, lonx, laty)
             values (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                3_i64,
                "MISSE",
                "ZB",
                Option::<String>::None,
                116.52_f64,
                40.28_f64
            ],
        )
        .expect("missed waypoint");
    connection
        .execute(
            "insert into approach_leg (
               approach_leg_id,
               approach_id,
               is_missed,
               type,
               fix_ident,
               fix_region,
               fix_airport_ident,
               fix_lonx,
               fix_laty,
               recommended_fix_ident,
               recommended_fix_region,
               recommended_fix_lonx,
               recommended_fix_laty
             ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                1_i64,
                42_i64,
                0_i64,
                "DF",
                "DE18R",
                "ZB",
                Option::<String>::None,
                Option::<f64>::None,
                Option::<f64>::None,
                Option::<String>::None,
                Option::<String>::None,
                Option::<f64>::None,
                Option::<f64>::None,
            ],
        )
        .expect("departure leg");
    connection
        .execute(
            "insert into approach_leg (
               approach_leg_id,
               approach_id,
               is_missed,
               type,
               fix_ident,
               fix_region,
               fix_airport_ident,
               fix_lonx,
               fix_laty,
               recommended_fix_ident,
               recommended_fix_region,
               recommended_fix_lonx,
               recommended_fix_laty
             ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                2_i64,
                42_i64,
                0_i64,
                "TF",
                "BOTPU",
                "ZB",
                Option::<String>::None,
                Option::<f64>::None,
                Option::<f64>::None,
                Option::<String>::None,
                Option::<String>::None,
                Option::<f64>::None,
                Option::<f64>::None,
            ],
        )
        .expect("enroute leg");
    connection
        .execute(
            "insert into approach_leg (
               approach_leg_id,
               approach_id,
               is_missed,
               type,
               fix_ident,
               fix_region,
               fix_airport_ident,
               fix_lonx,
               fix_laty,
               recommended_fix_ident,
               recommended_fix_region,
               recommended_fix_lonx,
               recommended_fix_laty
             ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                3_i64,
                42_i64,
                1_i64,
                "TF",
                "MISSE",
                "ZB",
                Option::<String>::None,
                Option::<f64>::None,
                Option::<f64>::None,
                Option::<String>::None,
                Option::<String>::None,
                Option::<f64>::None,
                Option::<f64>::None,
            ],
        )
        .expect("missed leg");

    let (path, missed_path) = query_procedure_legs(&connection, 42).expect("procedure legs");
    assert_eq!(path.len(), 1);
    assert_eq!(path[0].ident.as_deref(), Some("BOTPU"));
    assert_eq!(path[0].position.lon, 116.41);
    assert_eq!(path[0].position.lat, 40.12);

    assert_eq!(missed_path.len(), 1);
    assert_eq!(missed_path[0].ident.as_deref(), Some("MISSE"));
    assert_eq!(missed_path[0].position.lon, 116.52);
    assert_eq!(missed_path[0].position.lat, 40.28);
}

#[test]
fn transition_legs_fall_back_to_region_scoped_waypoint_positions() {
    let connection = Connection::open_in_memory().expect("memory db");
    create_leg_resolution_schema(&connection);

    connection
        .execute(
            "insert into waypoint (waypoint_id, ident, region, airport_ident, lonx, laty)
             values (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                1_i64,
                "AND",
                "ZS",
                Option::<String>::None,
                121.22_f64,
                30.26_f64
            ],
        )
        .expect("zs waypoint");
    connection
        .execute(
            "insert into waypoint (waypoint_id, ident, region, airport_ident, lonx, laty)
             values (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                2_i64,
                "AND",
                "SP",
                Option::<String>::None,
                -73.37_f64,
                -13.71_f64
            ],
        )
        .expect("sp waypoint");
    connection
        .execute(
            "insert into transition_leg (
               transition_leg_id,
               transition_id,
               type,
               fix_ident,
               fix_region,
               fix_airport_ident,
               fix_lonx,
               fix_laty,
               recommended_fix_ident,
               recommended_fix_region,
               recommended_fix_lonx,
               recommended_fix_laty
             ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                1_i64,
                9_i64,
                "TF",
                "AND",
                "ZS",
                Option::<String>::None,
                Option::<f64>::None,
                Option::<f64>::None,
                Option::<String>::None,
                Option::<String>::None,
                Option::<f64>::None,
                Option::<f64>::None,
            ],
        )
        .expect("transition leg");

    let path = query_transition_legs(&connection, 9).expect("transition legs");
    assert_eq!(path.len(), 1);
    assert_eq!(path[0].ident.as_deref(), Some("AND"));
    assert_eq!(path[0].position.lon, 121.22);
    assert_eq!(path[0].position.lat, 30.26);
}

#[test]
fn obeys_airway_directionality_rules() {
    assert!(airway_allows_departure(Some("N"), 10, 10, 20));
    assert!(airway_allows_departure(Some("N"), 20, 10, 20));
    assert!(airway_allows_departure(Some("F"), 10, 10, 20));
    assert!(!airway_allows_departure(Some("F"), 20, 10, 20));
    assert!(airway_allows_departure(Some("B"), 20, 10, 20));
    assert!(!airway_allows_departure(Some("B"), 10, 10, 20));
}

#[test]
fn merges_connected_airway_segments_even_when_one_segment_is_reversed() {
    let mut segments = vec![
        AirwaySegment {
            id: 10,
            name: "W123".to_string(),
            airway_type: Some("V".to_string()),
            from: LatLon {
                lat: 40.0,
                lon: 116.0,
            },
            to: LatLon {
                lat: 40.5,
                lon: 116.5,
            },
        },
        AirwaySegment {
            id: 11,
            name: "W123".to_string(),
            airway_type: Some("V".to_string()),
            from: LatLon {
                lat: 41.0,
                lon: 117.0,
            },
            to: LatLon {
                lat: 40.5,
                lon: 116.5,
            },
        },
        AirwaySegment {
            id: 12,
            name: "W123".to_string(),
            airway_type: Some("V".to_string()),
            from: LatLon {
                lat: 41.0,
                lon: 117.0,
            },
            to: LatLon {
                lat: 41.5,
                lon: 117.5,
            },
        },
    ];

    let merged = merge_airway_segments(&mut segments);

    assert_eq!(merged.len(), 1);
    assert_eq!(merged[0].len(), 3);

    let points = airway_path_points(&merged[0]);
    assert_eq!(points.len(), 4);
    assert!(points_close(
        &points[0],
        &LatLon {
            lat: 40.0,
            lon: 116.0,
        }
    ));
    assert!(points_close(
        &points[1],
        &LatLon {
            lat: 40.5,
            lon: 116.5,
        }
    ));
    assert!(points_close(
        &points[2],
        &LatLon {
            lat: 41.0,
            lon: 117.0,
        }
    ));
    assert!(points_close(
        &points[3],
        &LatLon {
            lat: 41.5,
            lon: 117.5,
        }
    ));
}
