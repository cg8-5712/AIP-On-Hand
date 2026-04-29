# Open Questions

These are the main decisions that should be confirmed before scaffolding grows too far.

## High Priority

### 1. Navigation Data Source

Need to confirm:

- where airports, waypoints, navaids, airways, and procedures will come from in development
- whether Phase 1 is China-first, region-first, or broader from the beginning

Why it matters:

- canonical ids
- parser design
- fixture strategy
- route-planning complexity

### 2. eAIP Package Shape

Need to confirm:

- whether the encrypted source wraps PDFs, images, custom tiles, metadata records, or a mix
- whether chart files are page-based, document-based, or airport-bundle-based

Why it matters:

- viewer design
- indexing model
- decryption adapter boundary

### 3. Weather and Airport Information Providers

Need to confirm:

- which APIs will provide METAR, TAF, and airport details
- what rate limits, attribution, and offline expectations apply

Why it matters:

- caching
- fallback behavior
- provider adapter design

### 4. Route Planning Depth for Stage 1

Need to confirm:

- whether Stage 1 requires only route validation plus diagnostics
- or also requires assisted route building across airways and procedures

Why it matters:

- graph algorithm complexity
- UI expectations
- test scope

### 5. Canonical Identifier Strategy

Need to confirm:

- how airports, waypoints, navaids, procedures, charts, and route segments are identified internally
- whether source-specific keys need to be preserved alongside canonical ids

Why it matters:

- search
- linking
- export
- future data-source swaps

## Medium Priority

### 6. Search Language and Matching Rules

Need to confirm:

- whether search should support ICAO, IATA, Chinese names, English names, aliases, and partial identifiers from day one

Why it matters:

- index structure
- ranking
- UI result grouping

### 7. Tile Source and Visual Style

Need to confirm:

- which basemap provider and style will be used for development and production
- whether the product should default to dark aviation styling immediately

Why it matters:

- licensing
- performance
- visual consistency

### 8. Export File Fidelity

Need to confirm:

- the exact FMS variants to support
- UFMC format expectations
- whether export should include procedures, raw legs, or only the resolved route core

Why it matters:

- exporter interface design
- golden test fixtures

### 9. Airport Surface Data Source

Need to confirm:

- whether airport ground detail will come from OSM, hand-drawn geometry, proprietary datasets, or mixed sources

Why it matters:

- model design
- editability assumptions
- rendering strategy

## Current Recommended Defaults

If you want me to proceed before all answers are finalized, the safest defaults are:

- Web API: `actix-web`
- frontend build: Vite
- map engine: Leaflet
- local store: SQLite
- shared DTOs: manual first
- Stage 1 routing: validation and diagnostics first, assisted routing later if time allows
