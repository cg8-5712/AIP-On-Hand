# Performance Benchmarks

This directory contains performance benchmarks for critical paths in the AIP On Hand application.

## Purpose

Benchmarks help us:
- Detect performance regressions early
- Validate optimization efforts
- Set performance baselines for critical operations
- Guide architectural decisions

## Benchmark Categories

### 1. Map Rendering (`map_rendering.rs`)
- Feature loading for visible bounds
- Layer rendering performance
- Highlight overlay updates
- Viewport change responsiveness

**Target**: < 16ms for 60fps rendering

### 2. Route Validation (`route_validation.rs`)
- Route string parsing
- Airway graph traversal
- Directionality checks
- Procedure matching
- Diagnostic generation

**Target**: < 500ms for typical route (10-20 waypoints)

### 3. Search Queries (`search.rs`)
- Prefix search across entity types
- Exact match lookups
- Fuzzy search ranking
- Result grouping and sorting

**Target**: < 100ms for typical query

### 4. Chart Operations (`charts.rs`)
- Package decryption and index loading
- Chart metadata lookup
- Document retrieval
- Category browsing

**Target**: < 200ms for chart lookup, < 1s for document load

### 5. Export Generation (`export.rs`)
- FMS format generation
- KML format generation
- UFMC format generation

**Target**: < 100ms per format

## Running Benchmarks

```bash
# Run all benchmarks
cargo bench

# Run specific benchmark suite
cargo bench --bench route_validation

# Compare with baseline
cargo bench --bench search -- --save-baseline main
cargo bench --bench search -- --baseline main
```

## Benchmark Framework

We use [criterion.rs](https://github.com/bheisler/criterion.rs) for benchmarking:

- Statistical analysis of results
- HTML report generation
- Baseline comparison
- Regression detection

## Adding New Benchmarks

1. Create benchmark file in `tests/benchmarks/`
2. Use realistic test data from `tests/fixtures/`
3. Document expected performance targets
4. Add to CI pipeline for regression detection

## Performance Targets Summary

| Operation | Target | Critical |
|-----------|--------|----------|
| Map render frame | < 16ms | Yes |
| Route validation | < 500ms | Yes |
| Search query | < 100ms | Yes |
| Chart lookup | < 200ms | No |
| Export generation | < 100ms | No |

## CI Integration

Benchmarks run on:
- Every PR to detect regressions
- Weekly scheduled runs for trend analysis
- Before releases for validation

Regression threshold: **10% slowdown** triggers review.
