# Project Framework

This document proposes the initial repository structure, module boundaries, and delivery model for Phase 1.

## Primary Objective

Build a browser-runnable aviation planning system on Windows first. The Tauri desktop app should reuse the same frontend and Rust core instead of introducing a second implementation path.

## Kickoff Technical Baseline

The recommended initial baseline is:

- `apps/web`: React + TypeScript + Vite
- browser-mode backend: Rust + `actix-web`
- async runtime: `tokio`
- first map engine: Leaflet
- first local database: SQLite
- first transport contract: JSON DTOs over HTTP
- data delivery: OTA updates or manual upload for commercial datasets

This is intentionally conservative. The goal is to reduce startup risk, not to maximize architectural novelty.

## Proposed Repository Layout

```text
AIP-On-Hand/
+-- apps/
|   +-- web/                   # React + Vite application
|   `-- desktop/               # Tauri shell and desktop integration
+-- crates/
|   +-- api/                   # HTTP API for browser mode (actix-web)
|   +-- domain/                # Shared domain models and value objects
|   +-- navigation/            # Navdata graph, procedures, route rules
|   +-- charts/                # Encrypted package access and chart services
|   +-- weather/               # METAR/TAF/airport API clients
|   +-- search/                # Canonical search index and query services
|   +-- export/                # FMS/KML/UFMC exporters
|   `-- infra/                 # SQLite/filesystem/config/logging helpers
+-- packages/
|   +-- shared/                # TypeScript shared DTOs and helpers
|   `-- ui/                    # Reusable UI components if needed
+-- docs/
|   +-- adr/                   # Architecture Decision Records
|   +-- project-framework.md
|   +-- development-plan.md
|   `-- conduct-of-code.md
+-- scripts/                   # Build, import, conversion, and tooling scripts
+-- data/                      # Local dev sample data only, gitignored as needed
+-- tests/
|   +-- integration/
|   +-- benchmarks/            # Performance benchmarks
|   `-- fixtures/
`-- README.md
```

This is a target layout, not a requirement to create every directory immediately.

## Runtime Modes

The system should support two runtime modes from the same Rust core:

1. Browser mode
   - React app served in the browser.
   - Rust backend exposed as an HTTP API.
   - Suitable for development, integration testing, and early feature validation.
2. Desktop mode
   - Same React app bundled inside Tauri.
   - Same Rust services invoked through Tauri commands or an embedded local service boundary.
   - Suitable for packaged Windows delivery and later desktop expansion.

## Frontend-to-Core Boundary

The frontend should call an application service interface rather than talking directly to `fetch` or Tauri APIs in feature components.

Recommended shape:

```text
React feature
  -> frontend application service
  -> browser transport adapter OR Tauri transport adapter
  -> Rust service boundary
  -> domain services
```

This makes it possible to reuse feature flows in browser mode and desktop mode with minimal UI churn.

## High-Level Architecture

```text
React UI
  -> app state and feature modules
  -> API client / Tauri adapter
  -> Rust service boundary
  -> domain services
  -> storage, files, external APIs
```

The key rule is that the React app should not implement aviation legality logic. It may handle presentation logic, interaction state, and optimistic UI behavior only.

## Frontend Feature Slices

The frontend should be organized by features instead of one large component tree:

- `features/map`
- `features/search`
- `features/route-planning`
- `features/charts`
- `features/weather`
- `features/export`
- `features/settings`

Shared frontend concerns:

- `components`
- `lib/api`
- `lib/tauri`
- `lib/geo`
- `store`
- `styles`

## Rust Service Slices

### `domain`

Owns canonical entities, value objects, validation primitives, and shared enums.

### `navigation`

Owns:

- navdata ingestion
- route string parsing
- airway graph construction
- directionality checks
- altitude band checks
- SID/STAR matching
- route validation output

### `charts`

Owns:

- encrypted package adapters
- chart index loading
- airport/procedure/chart linking
- page/document retrieval

### `weather`

Owns:

- upstream weather API clients
- response normalization
- basic caching and retry rules

### `search`

Owns:

- cross-entity indexing
- exact, prefix, fuzzy, and scoped search
- ranking and result grouping

### `export`

Owns:

- normalized export input model
- FMS rendering
- KML rendering
- UFMC rendering
- future extensibility for more formats

### `api`

Owns:

- HTTP transport
- request validation
- response mapping
- auth and configuration hooks if later needed

Transport code must stay thin and delegate to service modules.

## Data Source Strategy

Phase 1 will combine multiple classes of data:

- OpenStreetMap or compatible tile source for basemap
- **Commercial aviation navigation data** (non-open-source) for waypoints, navaids, airways, procedures
  - Delivered via OTA updates or manual user upload
  - Stored in encrypted packages with custom format (specification TBD)
- Encrypted eAIP chart package
- Online weather and airport information APIs
- Future airport surface detail datasets

These sources should be normalized into internal models. Avoid leaking raw provider field names throughout the codebase.

### Data Update Mechanism

- Primary: OTA (Over-The-Air) updates for navigation data packages
- Fallback: Manual upload by users
- All packages must support version tracking and integrity verification
- Encryption format specification to be defined in Phase 0

## Map Rendering Model

The map subsystem should use a normalized feature pipeline:

1. Query current visible bounds and zoom.
2. Request relevant normalized features from backend or local caches.
3. Render by layer type.
4. Apply highlight state separately from base rendering.

Recommended layer families:

- `base`
- `airspace`
- `airways`
- `waypoints`
- `navaids`
- `airports`
- `procedures`
- `active-route`
- `search-highlight`
- `airport-surface`

Search highlight must not mutate source layer data. It should render from a distinct highlight state so:

- a waypoint search can emphasize one point
- an airway search can emphasize a segment chain
- a procedure search can emphasize the full procedure path

### Target Visual Behavior

Based on the current target references, Phase 1 map rendering should bias toward:

- high contrast aviation-style overlays
- clear airway and label readability on dark basemaps
- stronger selected-state emphasis than normal layer styling
- high-zoom support for airport surface detail later without replacing the core map architecture

## Search Model

Search should unify these entity types:

- airport
- runway
- waypoint
- navaid
- airway
- SID
- STAR
- approach
- chart document

Each search result should return:

- stable id
- display label
- type
- parent context such as airport
- geometry reference or feature id
- optional chart/procedure linkage

## Route Planning Model

The route planner should expose distinct stages:

1. Tokenization and candidate resolution
2. Graph construction and path interpretation
3. Rule evaluation
4. Procedure linking
5. User-facing diagnostics
6. Export-ready route serialization

Diagnostics should be structured:

- error
- warning
- info

Examples:

- unknown waypoint
- airway unavailable in direction flown
- altitude rule conflict
- procedure match ambiguous
- route gap requiring direct segment

## Chart Viewer Model

The chart subsystem should support:

- chart index listing by airport and category
- chart metadata retrieval
- document page rendering or file streaming
- linkage from procedures and airports to chart entries

The viewer should be able to function before full georeferencing support exists.

## Airport Surface Extension

Airport surface rendering is a later milestone. Phase 1 should still reserve compatible models for:

- stand
- taxiway segment
- holding point
- apron polygon
- service road
- painted marking or surface annotation

This lets later work plug into the same map layer system without redesigning the foundation.

## Product Stage 1 Breakdown

To avoid confusion, the user-defined first product stage should be implemented internally in three slices:

### Stage 1A: Web Platform Core

- app shell
- map
- layer toggles
- airport, waypoint, navaid search
- selection highlight
- route scratchpad
- weather panel

### Stage 1B: Chart and Procedure Integration

- chart package adapter abstraction
- chart index browsing
- chart viewer
- airport-to-chart linkage
- procedure entity model and geometry exposure

### Stage 1C: Route Rules and Export

- airway graph rules
- directionality and altitude checks
- SID/STAR awareness
- route diagnostics
- FMS/KML/UFMC export

This sequence still belongs to one overall product stage, but it avoids building all difficult systems at the same time.

## Product Stage 1 Non-Goals

The following should not block the first product stage:

- chart georeferencing
- global coverage perfection
- surface editing tools
- aircraft performance modeling
- cloud accounts and sync
- mobile packaging
- advanced terrain or 3D rendering

## Suggested Initial Milestone Cut

A practical first milestone is:

1. React app shell with map view and sidebar
2. Rust API service with health endpoint and base domain models
3. Search for airports, waypoints, and navaids
4. Toggleable map layers for airports, waypoints, and airways
5. Route line rendering for manually selected entities
6. Weather lookup panel
7. Export pipeline stub with one format implemented end-to-end

That milestone is enough to validate architecture before deeper chart and procedure work.
