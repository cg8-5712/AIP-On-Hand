# AIP On Hand

`AIP On Hand` is a desktop-first aviation planning and charting project built around a Web frontend and a Rust core, with Tauri used later as the desktop host.

The first-stage goal is to complete a browser-accessible implementation on Windows with clear front-end/back-end separation, then package the same application into a Windows desktop app, and later expand to Linux, macOS, Android, and iOS.

## Phase 1 Scope

The initial scope covers:

1. Map display based on OpenStreetMap-compatible tiles with overlays for routes, waypoints, VOR, NDB, airports, procedures, and user-selectable layer visibility.
2. An eAIP chart viewer backed by an encrypted data package or database provided later.
3. API-backed aviation weather and airport information, including METAR, TAF, and airport detail lookups.
4. Route planning with aviation rules such as airway directionality, altitude band constraints, and SID/STAR awareness.
5. Search across waypoints, navaids, airports, airways, SIDs, STARs, and approaches.
6. Export of flight plans to formats such as FMS, KML, and UFMC.
7. A later extension for airport surface drawing and display.

## Delivery Strategy

The project is intentionally staged:

1. Web-first implementation that runs independently in a browser.
2. Windows desktop packaging with Tauri using the same frontend and Rust domain logic.
3. Cross-platform desktop stabilization for Windows, Linux, and macOS.
4. Mobile adaptation for Android and iOS after core interaction and data architecture are stable.

## Document Index

- [CODEX.md](./CODEX.md): repository-level implementation and collaboration rules.
- [docs/project-framework.md](./docs/project-framework.md): proposed project structure and module responsibilities.
- [docs/development-plan.md](./docs/development-plan.md): staged roadmap and milestone breakdown.
- [docs/conduct-of-code.md](./docs/conduct-of-code.md): coding standards, testing expectations, and workflow conventions.
- [docs/adr/](./docs/adr/): Architecture Decision Records for significant technical decisions.

## Technology Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Rust + actix-web
- **Map Engine**: Leaflet (with adapter for future alternatives)
- **Database**: SQLite
- **Desktop**: Tauri (Phase 2+)
- **Data Delivery**: OTA updates or manual upload for commercial datasets

## Working Principles

- The Web app must be usable and testable before Tauri packaging starts.
- Rust business logic should be implemented once and reused across Web service mode and Tauri mode.
- UI, domain rules, map rendering, and data access should remain modular and independently testable.
- Aviation data licensing, encryption details, and parsing rules are treated as first-class architecture concerns, not late implementation details.

## Kickoff Baseline

Unless a later decision overrides it, the recommended starting baseline is:

- React + TypeScript + Vite for the Web frontend.
- Leaflet as the first map engine.
- Rust + `actix-web` for browser-mode API services.
- SQLite as the first local structured store.
- Commercial navigation data via OTA or manual upload.
- Tauri v2 only after the browser workflow is stable.

## Current Phase 0 Scaffold

The repository now includes a browser-mode skeleton backed by the local Little Navmap Navigraph
SQLite database:

- `crates/api`: Rust `actix-web` HTTP transport with versioned endpoints and response mapping
- `crates/domain`: canonical map, navaid, airway, and procedure response models
- `crates/navigation`: navdata access and procedure geometry logic for the Little Navmap Navigraph SQLite source
- `apps/web`: React + TypeScript + Vite shell with Tailwind CSS, a Leaflet map, live layer toggles, and procedure highlight flow

## Local Run

### Prerequisites

- Rust toolchain
- Node.js
- Yarn Classic (`1.22.x`)
- local navdata file at `D:\little_navmap_navigraph.sqlite`, or set `AIP_NAVDB_PATH` to another path

### Start the API

```bash
cargo run -p aip-api
```

The API defaults to `http://127.0.0.1:8080`.
The navdata path defaults to `D:\little_navmap_navigraph.sqlite`.

To override it:

```bash
set AIP_NAVDB_PATH=D:\path\to\little_navmap_navigraph.sqlite
cargo run -p aip-api
```

### Start the Web App

```bash
cd apps/web
yarn install
yarn dev
```

The Vite app defaults to `http://127.0.0.1:5173` and proxies `/api` requests to the Rust service.

If you want the frontend to call a different API origin directly, copy `apps/web/.env.example` to
`apps/web/.env.local` and set `VITE_API_BASE_URL`.

## Tests

### Rust tests

```bash
cargo test -p aip-api
cargo test -p aip-navigation
```

### Web tests

```bash
cd apps/web
yarn install
yarn test
```

The web test suite uses Vitest with React Testing Library and currently covers:

- bootstrap rendering against mocked API responses
- viewport-driven layer loading
- airport filtering behavior
- procedure selection driving the highlighted geometry state
- layer toggle state flowing back into map-layer requests
