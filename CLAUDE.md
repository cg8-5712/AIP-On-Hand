# CODEX.md

This file defines repository-level expectations for contributors and coding agents working on `AIP On Hand`.

## Product Intent

The project aims to provide a Navigraph-like planning and charting workflow with:

- Interactive aviation map layers.
- eAIP chart viewing from encrypted local data.
- Aviation weather and airport information lookup.
- Rule-aware route planning.
- Search across aviation entities.
- Flight plan export in multiple formats.
- Later airport surface visualization and editing support.

## Development Priorities

Development order is fixed unless explicitly changed:

1. Browser-accessible Web implementation on Windows.
2. Windows desktop app using Tauri.
3. Linux and macOS desktop support.
4. Android and iOS support.

Do not introduce Tauri-specific coupling into core business logic during Phase 1.

## Product Stage 1 Contract

The user-defined first product stage is broader than a single engineering milestone. In this repository, "Product Stage 1" means the combined delivery of:

- Browser-runnable map workflow on Windows
- Search and map highlighting
- Weather and airport information lookup
- eAIP chart viewer MVP
- Rule-aware route planning baseline
- Multi-format export baseline

Product Stage 1 is not considered complete until those capabilities are working in browser mode first. Tauri packaging is a later packaging phase, not a substitute for unfinished Web behavior.

## Technology Direction

The default stack is:

- Frontend: React + TypeScript + Vite.
- Map rendering: Leaflet first, with a strict adapter boundary in case a later switch to MapLibre GL or another renderer is needed.
- Backend/core: Rust workspace.
- Desktop shell: Tauri after the Web application is stable.
- Storage: local files and/or SQLite, with encrypted package support for chart and navigation data.

## Default Technical Decisions

Unless the repository explicitly records a different choice later, start with:

- React + TypeScript + Vite in `apps/web`
- Rust `actix-web` service for browser mode
- `tokio` async runtime
- JSON over HTTP for the browser transport
- SQLite as the first local database
- WGS84 latitude/longitude as the canonical geometry storage format
- UTC as the canonical internal time basis for aviation weather and validity windows
- Commercial navigation data delivered via OTA or manual upload
- Custom encrypted package format (specification TBD)

Do not overfit early docs to exact package versions. Version pinning belongs in code and lockfiles, not architecture prose.

## Required Architectural Boundaries

Keep the codebase split into these concerns:

- `apps/web`: browser UI only.
- `apps/desktop`: Tauri host and desktop-specific glue only.
- `crates/domain`: aviation domain types and rules.
- `crates/navigation`: navdata lookup, airway graph, procedure modeling, route validation.
- `crates/charts`: eAIP package access, decryption adapters, chart indexing, metadata lookup.
- `crates/weather`: external API clients and normalization.
- `crates/export`: exporters for FMS, KML, UFMC, and later formats.
- `crates/search`: unified search indexing and query services.
- `crates/api`: HTTP service layer for browser mode.
- `packages/shared`: TypeScript shared contracts generated or manually mirrored from Rust-facing DTOs.

If implementation starts with fewer modules, preserve these boundaries conceptually. Avoid placing domain rules directly in the React app.

## Non-Negotiable Rules

- Business rules about route legality, airway constraints, procedure recognition, and export semantics belong in Rust, not duplicated in TypeScript.
- Tauri commands must remain thin wrappers around Rust services.
- Encryption and chart package handling must be abstracted behind interfaces so the packaging format can evolve later.
- Map layer rendering must consume normalized feature data rather than raw vendor-specific records.
- Search must operate on a canonical entity model shared across airports, waypoints, navaids, procedures, and routes.
- Do not hard-code China-only assumptions if the long-term goal is broader coverage, but Phase 1 may prioritize Chinese AIP and airport workflows.
- No frontend feature may depend directly on raw upstream navigation, chart, or weather provider schemas beyond adapter boundaries.
- UI components must not parse route legality from label strings or infer business state from presentation text.

## Data Model Direction

At minimum, the system should define canonical models for:

- Airport
- Runway
- Taxiway segment
- Waypoint
- Navaid
- Airway
- Airway segment
- Procedure
- Procedure leg
- Route plan
- Route validation issue
- Chart document
- Weather report
- Search result

These canonical models should be stable even if raw upstream formats differ.

## Map Strategy

Leaflet is the preferred starting point because it is mature and adequate for the first-stage 2D workflow.

Use layered rendering:

- Base tile layer
- FIR/UIR and optional administrative overlays
- Airways
- Waypoints and navaids
- Airports
- Procedure overlays
- Active route overlay
- Search highlight overlay
- Airport surface overlay

Each layer must be toggleable and independently testable. Search highlight behavior must support:

- Single feature emphasis for waypoint, navaid, or airport results
- Full-path emphasis for procedures such as SID, STAR, and approach selections

## Chart Viewer Direction

The chart viewer should be designed as a document browser plus geospatial metadata layer:

- Local encrypted package reader
- Chart index and metadata lookup
- Chart category browsing
- Document rendering
- Optional chart-to-airport/procedure linking

Do not bind the viewer to a specific encrypted file layout yet. Build against an adapter trait or interface.

## Route Planning Direction

Route planning must be treated as a dedicated subsystem, not a UI helper.

Phase 1 routing expectations:

- Parse user route strings and direct picks from search/map interactions.
- Resolve entities against canonical navdata.
- Build an airway graph with directionality and altitude constraints.
- Identify invalid transitions and ambiguous procedure matches.
- Return explainable diagnostics, not only pass/fail.

Do not attempt full dispatch-grade optimization in the first milestone. Prioritize correctness, explainability, and extensibility.

## Phase 1 Non-Goals

The following are explicitly out of scope for Product Stage 1 unless re-approved:

- User accounts, sync, and collaboration
- Performance calculation, fuel planning, and payload logic
- 3D globe or terrain rendering
- Full chart georeferencing and chart-to-map fusion
- Automatic "best route" optimization across all constraints
- Airport surface editing tools
- Mobile-specific UI optimization
- Real-time ATC, ADS-B, or multiplayer features

## Export Strategy

Exporters must consume a normalized route plan rather than reading UI state directly. Each format exporter should be isolated so new formats can be added without touching route planning logic.

## Testing Expectations

- Rust crates: unit tests for parsers, validators, graph rules, exporters.
- Web app: component and interaction tests for map controls, search, and viewer flows.
- Contract tests: verify API responses and TypeScript client assumptions against Rust DTOs.
- Golden tests: preferred for route export outputs and selected chart parsing/indexing behaviors.

## Documentation Expectations

Any meaningful architectural change should update:

- `README.md` if the project entry point or scope changes.
- `docs/project-framework.md` if module structure changes.
- `docs/development-plan.md` if milestone scope changes.
- `docs/conduct-of-code.md` if coding workflow or standards change.
- `docs/adr/` with a new ADR document for significant technical decisions.

## ADR (Architecture Decision Record) Policy

Significant technical decisions must be documented as ADRs in `docs/adr/`:

- Web framework, database, or major library choices
- Data format specifications
- Security or encryption approaches
- API contract changes affecting multiple modules
- Performance optimization strategies with trade-offs

ADRs should include: Status, Date, Context, Decision, Alternatives Considered, and Consequences.

## Explicitly Deferred

Do not spend Phase 1 effort on:

- Mobile-specific UI polish
- 3D map rendering
- Online collaborative planning
- Full aircraft performance computation
- Real-time multiplayer state
- Complex airport ground editor tooling

Airport surface drawing support should first focus on data structures and rendering readiness, not a full editor.
