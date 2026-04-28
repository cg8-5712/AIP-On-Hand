# Conduct of Code

This document defines coding and collaboration rules for the project.

## General Principles

- Prefer simple, explicit designs over abstract frameworks.
- Keep aviation rules centralized in Rust services.
- Make data transformations traceable and testable.
- Optimize for maintainability before cleverness.
- Favor deterministic behavior for parsing, routing, and exporting.

## Repository Conventions

- Use a monorepo layout with clearly separated apps, crates, packages, and docs.
- Keep feature code close to its tests when practical.
- Avoid generic `utils` modules when a domain-specific module name is possible.
- Keep third-party provider details behind adapters.

## Frontend Conventions

- Use TypeScript everywhere in the React app.
- Organize by feature, not by file type alone.
- Keep map layer components thin; push data shaping into selectors or service clients.
- UI state may track selection, visibility, loading, and viewport state, but not domain legality rules.
- Use explicit loading, empty, error, and stale states for remote-backed panels.

## Rust Conventions

- Prefer small crates with clear responsibilities.
- Model aviation concepts with typed structs and enums instead of loosely typed maps.
- Return structured errors and diagnostics.
- Isolate IO, parsing, and domain decision logic into separate layers where practical.
- Avoid leaking transport types deep into domain modules.

## Domain Modeling Conventions

- Store canonical coordinates in WGS84 latitude/longitude unless a specific module documents otherwise.
- Keep unit semantics explicit for feet, flight levels, nautical miles, knots, and magnetic or true bearings.
- Distinguish clearly between raw source identifiers and canonical internal identifiers.
- Model procedure legs as ordered domain data, not as UI-only polylines.

## API Conventions

- Use stable DTOs between frontend and backend.
- Keep request and response shapes explicit and versionable.
- Prefer coarse feature endpoints over chatty low-value endpoints when map interaction can batch work.
- Every endpoint should define error behavior clearly.
- Prefer a versioned prefix such as `/api/v1` once feature endpoints start expanding.

## Search Conventions

- Search must return typed entities, not only strings.
- Ranking logic should be explainable and adjustable.
- Prefix and exact matches should be favored over opaque fuzzy scoring for aviation identifiers.
- Search result payloads should include enough metadata for direct map highlighting and detail panel navigation.

## Mapping Conventions

- All map-rendered features should have stable ids.
- Layer visibility must be controlled centrally.
- Highlight overlays must be rendered separately from source data layers.
- Procedure highlighting should render complete path geometry where available.
- Geometry conversion and simplification should be deterministic.

## Chart Conventions

- Encrypted chart storage access must be abstracted behind an interface.
- Chart metadata and document retrieval must be separable.
- Avoid assuming one chart file equals one screen or one page until the actual source format is known.

## Export Conventions

- Exporters consume normalized route plans only.
- Each export format lives in its own module.
- Export output should be reproducible from the same input.
- Add golden tests for each exporter.

## Testing Policy

- Write unit tests for route parsing, search ranking, export serialization, and rule evaluation.
- Write integration tests for API endpoints and core end-to-end workflows.
- Prefer fixture-driven tests for navdata, procedures, and chart metadata.
- Add regression tests for every bug in route legality or export formatting.
- Maintain benchmark tests for performance-critical paths (map rendering, route validation, search queries).
- Track benchmark results across commits to detect performance regressions early.

## Naming Rules

- Use aviation terminology consistently.
- Prefer `procedure`, `airway`, `navaid`, `waypoint`, `route_plan`, `chart_document`, `surface_segment` over vague names.
- Avoid abbreviations unless they are established aviation terms.

## Logging and Diagnostics

- Log boundary failures with context, but do not leak secrets or encryption material.
- Diagnostics returned to the UI should distinguish between user-fixable and system-level failures.
- Route validation diagnostics should carry machine-readable codes.
- Diagnostic codes should be namespaced, for example `route.airway.direction_invalid`.

## Performance Rules

- Do not optimize prematurely, but design map and search flows for scale.
- Avoid reloading full datasets on every viewport change.
- Cache normalized lookups where that does not compromise correctness.
- Keep heavy parsing and route validation off the main UI thread.

## Security Rules

- Treat encrypted chart packages as sensitive local assets.
- Never log decrypted payload contents by default.
- Keep secrets and API keys out of source control.
- Assume future licensing constraints may require auditing of data access paths.

## Fixture and Sample Data Policy

- Do not commit licensed or sensitive raw aviation datasets unless their redistribution is confirmed.
- Prefer synthetic or redacted fixtures for tests.
- Sample encrypted chart packages used for development should be minimal and purpose-built.

## Documentation Conventions

- Document significant architectural decisions in `docs/adr/` using ADR format.
- Keep `CODEX.md` updated with repository-level rules and expectations.
- Update framework and plan docs when module structure or milestones change.

## Git and Review Workflow

- Keep changes scoped and reviewable.
- Do not mix formatting noise with architecture changes unless necessary.
- Update docs when boundaries or expectations change.
- Review for correctness first, style second.

## Definition of Done

A task is not done unless:

- code builds for the affected area
- tests for the affected behavior exist or the gap is stated
- interfaces are documented when they introduce new contracts
- user-visible behavior is manually verifiable
- follow-up risk is called out if work is intentionally partial
