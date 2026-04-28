# Phase 1 Scope

This document defines the exact meaning of the first product stage so feature discussions stay anchored to the same target.

## Stage 1 Objective

Deliver a Windows-first browser-runnable aviation planning system with clear front-end and back-end separation. The browser version must be genuinely usable on its own before any Tauri packaging work is treated as complete.

## In Scope

Product Stage 1 includes all of the following:

- map rendering using OpenStreetMap-compatible tiles and aviation overlays
- layer toggles for airports, waypoints, navaids, airways, procedures, and active route elements
- search across airports, waypoints, navaids, airways, and procedures
- map highlight behavior for both single entities and full procedures
- weather and airport information lookup
- eAIP chart browsing and viewing from an encrypted local package abstraction
- route planning baseline with directionality and altitude-rule awareness
- export of normalized routes to FMS, KML, and UFMC

## Out of Scope

Product Stage 1 does not require:

- mobile release builds
- user accounts or cloud sync
- collaborative planning
- aircraft performance and fuel calculations
- full chart georeferencing
- airport surface editing
- full global dataset parity from day one

## Stage 1 Visual and UX Expectations

The current target references imply these UX behaviors:

- the map should support a dark, aviation-oriented visual presentation
- airway, waypoint, and navigation labels must remain legible without overwhelming the basemap
- selected search results should be visually stronger than ordinary layer symbols
- selecting a procedure should highlight the full procedure path, not only a single point
- later airport surface detail should fit into the same map shell without requiring a second viewer

## Internal Delivery Slices

To make implementation manageable, Product Stage 1 should be executed in these internal slices:

1. Web map, search, and route scratchpad baseline
2. Weather and airport information
3. Chart package abstraction and viewer
4. Rule-aware route planning
5. Multi-format export
6. Windows desktop packaging with the same core logic

## Acceptance Criteria

Product Stage 1 is complete only when the browser mode on Windows can do all of the following:

1. render the map and toggle aviation layers
2. search for a supported entity and highlight it correctly
3. highlight a full procedure path when a procedure is selected
4. show METAR, TAF, and airport detail in a stable panel flow
5. open charts from an airport or procedure context using the encrypted-package abstraction
6. validate a route and return explainable diagnostics for at least common failure cases
7. export one normalized route into FMS, KML, and UFMC outputs

## Exit Rules

The following do not count as substitutes for completion:

- a Tauri app that works while the browser flow is still incomplete
- UI-only route drawing that does not use normalized route models
- direct use of raw chart files in the frontend without the package abstraction
- export code that reads transient UI state instead of a canonical route plan
