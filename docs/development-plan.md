# Development Plan

This plan focuses on staged delivery with a strong bias toward early validation of architecture and core workflows.

## Guiding Strategy

- Build Web-first.
- Keep Rust domain logic host-agnostic.
- Validate data models before optimizing UI detail.
- Add complexity in vertical slices instead of unfinished horizontal scaffolding.

## Relationship to Product Stage 1

The user-defined first product stage includes maps, charts, weather, rule-aware routing, search, and export. In this document, that single product stage is split into several engineering phases so the implementation can progress without mixing every hard problem at once.

In practice:

- Product Stage 1 spans Phase 0 through Phase 6 below.
- The first browser-usable MVP appears around Phase 1 and Phase 2.
- The full target described by the user is only reached after charts, routing, and export phases are complete.

## Phase 0: Foundation

Objective: establish repo structure, tooling, and minimal running skeleton.

Deliverables:

- Monorepo layout initialized.
- React + Vite app bootstrapped.
- Rust workspace bootstrapped with actix-web.
- Browser mode HTTP API bootstrapped.
- Shared DTO strategy decided.
- Logging, configuration, and error conventions documented.
- Benchmark framework setup with initial test cases.
- Encrypted package format specification defined (ADR-003).
- ADR process established.

Exit criteria:

- `apps/web` can run locally.
- Rust backend can run locally.
- Frontend can call backend health/version endpoints.
- Benchmark framework runs successfully.
- Encrypted package format specification documented.

## Phase 1: Core Map and Search MVP

Objective: make the product visually and functionally resemble the first usable planning surface.

Deliverables:

- Base map rendering.
- Toggleable overlays for airports, waypoints, navaids, and airways.
- Search for airport, waypoint, and navaid entities.
- Result selection and highlight on map.
- Manual route construction from selected entities.
- Basic route list panel and route polyline rendering.

Exit criteria:

- Browser mode works on Windows in a normal browser.
- User can search, select, toggle layers, and see route graphics update correctly.
- Highlight behavior is separate from base layer rendering.
- The architecture remains compatible with later procedure-path highlighting.

## Phase 2: Weather and Airport Information

Objective: enrich the planning surface with operational context.

Deliverables:

- METAR retrieval.
- TAF retrieval.
- Airport information panel.
- Basic request caching and failure handling.
- Source attribution and timestamp display.

Exit criteria:

- Weather lookups are stable and displayed with normalized formatting.
- Airport panel can be opened from both search and map selection.

## Phase 3: Chart Viewer MVP

Objective: make local chart browsing available through a stable abstraction.

Deliverables:

- Encrypted package reader abstraction.
- Chart index browsing by airport and category.
- Chart list UI.
- Document viewer integration.
- Link from airport/procedure context to available charts.

Exit criteria:

- Viewer works against a sample encrypted package adapter.
- UI does not depend on raw storage layout details.
- Chart browsing is linked to airport context even if full georeferencing is deferred.

## Phase 4: Rule-Aware Route Planning

Objective: move from visual route drawing to explainable aviation route validation.

Deliverables:

- Canonical route model.
- Airway graph and segment resolution.
- Directionality handling.
- High/low altitude airway restrictions.
- SID/STAR recognition workflow.
- Diagnostic output for invalid or ambiguous route states.

Exit criteria:

- Planner can identify and explain common invalid route cases.
- Search-selected procedures can highlight complete procedure paths on the map.
- Route diagnostics can be consumed by export logic without UI-specific transformation.

## Phase 5: Export Pipeline

Objective: generate usable downstream flight-plan files from normalized route plans.

Deliverables:

- Export service boundary.
- FMS export.
- KML export.
- UFMC export.
- Download or save flow in browser mode and desktop mode.

Exit criteria:

- The same normalized route plan can be exported to at least three formats.
- Export outputs are covered by golden tests.

## Phase 6: Windows Desktop Packaging

Objective: ship the Web workflow as a native-feeling Windows app without forking core logic.

Deliverables:

- Tauri integration.
- Local file access and packaging setup.
- Desktop settings and app storage path conventions.
- Installer and update strategy draft.

Exit criteria:

- Windows desktop app runs the same major workflows as browser mode.
- No duplicate business logic exists between browser and desktop modes.

## Phase 7: Cross-Platform Desktop

Objective: stabilize desktop support across Windows, Linux, and macOS.

Deliverables:

- Platform-specific packaging fixes.
- Filesystem and path abstraction cleanup.
- Desktop regression testing.

Exit criteria:

- Core workflows behave consistently across supported desktop platforms.

## Phase 8: Airport Surface Rendering

Objective: add high-detail airport surface layers in the same map system.

Deliverables:

- Airport surface data model.
- Rendering pipeline for taxiways, stands, hold points, and markings.
- Layer control integration.
- Selection and highlight behavior for surface elements.

Exit criteria:

- Airport ground geometry can be rendered and inspected at high zoom.
- Surface layer design does not break existing map architecture.

## Phase 9: Mobile Adaptation

Objective: bring the validated core workflows to Android and iOS.

Deliverables:

- Responsive interaction redesign where needed.
- Mobile packaging strategy.
- Reduced-complexity panels and overlays.
- Touch-optimized map and selection flows.

Exit criteria:

- Core browse/search/route workflows remain usable on mobile form factors.

## Recommended Milestones for Immediate Work

### Milestone A

- Initialize monorepo.
- Start browser app and Rust API.
- Render a map.
- Add one sample aviation overlay.

### Milestone B

- Add canonical airport/waypoint/navaid models.
- Add search endpoint and UI.
- Add selection highlight and route scratchpad.

### Milestone C

- Add weather panel.
- Add initial exporter.
- Lock the service boundary before charts and procedures expand complexity.

### Milestone D

- Add chart package adapter interface.
- Add chart index and viewer.
- Add airport and procedure linkage.

### Milestone E

- Add airway graph validation.
- Add procedure-aware route diagnostics.
- Complete FMS/KML/UFMC exporters.

## Main Risks

- Over-coupling route logic to UI state early.
- Starting with too many aviation entity types before the canonical model is stable.
- Tauri-specific shortcuts that later block browser mode or mobile reuse.
- Hard-wiring chart decryption to one unpublished format.
- Underestimating procedure modeling complexity.

## Recommended Decisions to Make Early

- ✅ Choose the Rust web framework for browser mode API: **actix-web**
- ✅ Decide data delivery mechanism: **OTA or manual upload**
- ✅ Data source: **Commercial non-open-source datasets**
- Define canonical IDs for airports, waypoints, navaids, procedures, and charts.
- Choose the initial weather and airport information API providers.
- Define the boundary between local data packages and remote API data.
- Define encrypted package format specification.

## Recommended Defaults

If there is no stronger constraint yet, use these defaults to start implementation:

- Rust browser API: `actix-web`
- frontend dev/build: Vite
- map engine: Leaflet
- local store: SQLite
- shared DTOs: manual first, generation later only if contract churn becomes costly
- data delivery: OTA with manual upload fallback

The intent is to preserve startup speed while keeping migration options open.
