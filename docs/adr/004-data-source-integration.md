# ADR-004: Data Source Integration Strategy

## Status

Accepted

## Date

2026-04-28

## Context

The project requires integration of two primary data sources:

1. **Navigraph-compatible SQLite database** (`little_navmap_navigraph.sqlite`)
   - 254,530 waypoints
   - 90,924 airway segments
   - 17,112 airports
   - Complete procedure data (SID/STAR/Approach)
   - Navigation aids (VOR, NDB, ILS)

2. **eAIP Chart Package** (directory-based, 2025-07.V1.4)
   - Organized by airport ICAO code
   - PDF charts with JSON index metadata
   - Categories: ADC, AOC, APDC, GMC, SID, STAR, IAC, etc.
   - Chart-to-procedure linkage via naming conventions

### Key Observations

**Database Schema:**
- Uses Little Navmap schema conventions
- Foreign key relationships between entities
- Bounding box data for spatial queries
- ARINC type codes for waypoint classification
- Airway directionality and altitude constraints

**Chart Organization:**
- Flat directory structure per airport
- `index.json` provides chart metadata
- Chart codes follow pattern: `{ICAO}-{CODE}-{TYPE}.pdf`
- Merged PDFs available for bulk viewing
- No embedded georeferencing data

**Integration Challenges:**
1. Database is read-only commercial data (cannot modify schema)
2. Chart package format may evolve (need abstraction)
3. Procedure names in database vs. chart filenames may differ
4. No direct foreign key from procedures to charts
5. Chart effective dates vs. navdata cycle alignment

## Decision

### Canonical Data Model

Define our own canonical domain models in `crates/domain` that are **independent** of both source formats:

```rust
// Canonical models (simplified)
pub struct Airport {
    pub id: AirportId,           // Our internal ID
    pub icao: String,
    pub iata: Option<String>,
    pub name: String,
    pub location: LatLon,
    pub elevation: i32,
    pub runways: Vec<Runway>,
    // ... other fields
}

pub struct Waypoint {
    pub id: WaypointId,
    pub ident: String,
    pub region: Option<String>,
    pub location: LatLon,
    pub waypoint_type: WaypointType,
    // ... other fields
}

pub struct AirwaySegment {
    pub id: AirwaySegmentId,
    pub airway_name: String,
    pub airway_type: AirwayType,  // Victor, Jet, RNAV
    pub from_waypoint: WaypointId,
    pub to_waypoint: WaypointId,
    pub direction: Direction,     // Forward, Backward, Both
    pub min_altitude: Option<i32>,
    pub max_altitude: Option<i32>,
}

pub struct Procedure {
    pub id: ProcedureId,
    pub airport_id: AirportId,
    pub procedure_type: ProcedureType,  // SID, STAR, Approach
    pub name: String,
    pub runway: Option<String>,
    pub legs: Vec<ProcedureLeg>,
}

pub struct Chart {
    pub id: ChartId,
    pub airport_icao: String,
    pub category: ChartCategory,
    pub code: Option<String>,
    pub name: String,
    pub file_path: String,
    pub procedure_link: Option<ProcedureId>,
}
```

### Adapter Pattern

Implement adapters for each data source:

**1. Navigraph Database Adapter** (`crates/navigation/src/adapters/navigraph_db.rs`)

```rust
pub trait NavDataSource {
    fn get_airports(&self, bounds: Option<Bounds>) -> Result<Vec<Airport>>;
    fn get_waypoints(&self, bounds: Bounds) -> Result<Vec<Waypoint>>;
    fn get_airways(&self, name: Option<&str>) -> Result<Vec<AirwaySegment>>;
    fn get_procedures(&self, airport_id: &AirportId) -> Result<Vec<Procedure>>;
    fn search(&self, query: &str, entity_types: &[EntityType]) -> Result<Vec<SearchResult>>;
}

pub struct NavigraphDbAdapter {
    conn: rusqlite::Connection,
}

impl NavDataSource for NavigraphDbAdapter {
    // Map from Little Navmap schema to canonical models
}
```

**2. eAIP Chart Adapter** (`crates/charts/src/adapters/eaip_directory.rs`)

```rust
pub trait ChartSource {
    fn get_airport_charts(&self, icao: &str) -> Result<Vec<Chart>>;
    fn get_chart_by_id(&self, chart_id: &ChartId) -> Result<ChartDocument>;
    fn get_charts_by_category(&self, icao: &str, category: ChartCategory) -> Result<Vec<Chart>>;
    fn link_procedure_to_charts(&self, procedure: &Procedure) -> Result<Vec<ChartId>>;
}

pub struct EAipDirectoryAdapter {
    base_path: PathBuf,
}

impl ChartSource for EAipDirectoryAdapter {
    fn get_airport_charts(&self, icao: &str) -> Result<Vec<Chart>> {
        // Read {icao}/index.json
        // Parse chart metadata
        // Return canonical Chart models
    }

    fn link_procedure_to_charts(&self, procedure: &Procedure) -> Result<Vec<ChartId>> {
        // Match procedure name to chart filenames
        // E.g., "IDKEX1A" SID -> "ZBAA-7A01-SID RNAV RWY01-36L-36R(IDKEX).pdf"
    }
}
```

### Data Loading Strategy

**Phase 0-1: Direct File Access**
- Read SQLite database directly (read-only)
- Read eAIP directory structure directly
- No data copying or transformation

**Phase 2+: Optional Local Cache**
- SQLite cache for frequently accessed data
- Indexed search tables
- Chart metadata cache
- Only if performance requires it

### ID Strategy

**Canonical IDs:**
- `AirportId`: Hash of ICAO code
- `WaypointId`: Hash of (ident + region + type)
- `AirwaySegmentId`: Hash of (airway_name + from + to + sequence)
- `ProcedureId`: Hash of (airport + type + name + runway)
- `ChartId`: Hash of (airport + category + code + name)

**Rationale:**
- Deterministic IDs enable caching
- No need for ID mapping tables
- Collision-resistant with aviation data cardinality

### Procedure-to-Chart Linking

**Heuristic Matching:**
1. Extract procedure name from database (e.g., "IDKEX1A")
2. Search chart filenames for pattern match
3. Match by:
   - Procedure type (SID/STAR/Approach)
   - Procedure name substring
   - Runway designation
4. Return multiple charts if ambiguous

**Example:**
```
Procedure: SID "IDKEX1A" RWY 01/36L/36R
Matches:
- ZBAA-7A01-SID RNAV RWY01-36L-36R(IDKEX).pdf
```

### Data Update Strategy

**Navdata Updates:**
- User downloads new SQLite file via OTA or manual upload
- Place in `data/navdata/` directory
- App detects new file and switches to it
- Old file retained for rollback

**Chart Updates:**
- User downloads new eAIP package
- Extract to `data/charts/EAIP{version}/`
- App detects new version and switches
- Old version retained for rollback

**Version Compatibility:**
- Store navdata cycle and chart effective dates
- Warn user if navdata and charts are misaligned
- Allow mixed versions (user responsibility)

## Alternatives Considered

### Alternative 1: Import All Data to Internal Database
**Rejected** because:
- Duplicates 500MB+ of data
- Requires complex ETL pipeline
- Commercial data license may prohibit copying
- Update process becomes more complex

### Alternative 2: Direct Schema Coupling
**Rejected** because:
- Locks us to Little Navmap schema
- Cannot switch to other navdata providers
- Chart format changes break the app
- Violates clean architecture principles

### Alternative 3: Encrypted Package from Day 1
**Deferred** because:
- Adds complexity before validating core workflows
- Can migrate later behind adapter interface
- Phase 1 focus is browser-mode functionality

## Consequences

### Positive

- **Flexibility**: Can swap data sources without changing domain logic
- **Testability**: Can mock adapters for unit tests
- **Performance**: Read-only access to source files (no ETL overhead)
- **Simplicity**: No data duplication or sync issues
- **Extensibility**: Easy to add new data sources (e.g., FAA CIFP)

### Negative

- **Adapter Maintenance**: Must update adapters if source formats change
- **Linking Complexity**: Procedure-to-chart matching is heuristic
- **Query Performance**: No indexes on source data (mitigated by caching)

### Risks

1. **Schema Changes**: If Navigraph changes schema, adapter breaks
   - Mitigation: Version detection, graceful degradation

2. **Chart Naming Inconsistency**: Procedure names don't match filenames
   - Mitigation: Fuzzy matching, manual override table

3. **Data Misalignment**: Navdata cycle 2501 with charts from 2507
   - Mitigation: Version warnings, allow user override

### Implementation Plan

**Phase 0:**
1. Define canonical models in `crates/domain`
2. Implement `NavigraphDbAdapter` with basic queries
3. Implement `EAipDirectoryAdapter` with index parsing
4. Add integration tests with sample data

**Phase 1:**
5. Implement search across both sources
6. Add procedure-to-chart linking heuristics
7. Performance benchmark and optimize if needed

**Phase 3:**
8. Add chart metadata caching if performance requires
9. Implement version detection and warnings

## References

- Little Navmap Database Schema: https://www.littlenavmap.org/lnmdb.html
- ARINC 424 Specification (procedure encoding)
- eAIP Chart Index Format (internal documentation TBD)
