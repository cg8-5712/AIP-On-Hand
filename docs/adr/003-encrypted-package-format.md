# ADR-003: Encrypted Package Format

## Status

Proposed - Specification TBD

## Date

2026-04-28

## Context

Commercial aviation navigation data and eAIP charts require protection through encryption to:

- Comply with licensing agreements
- Prevent unauthorized redistribution
- Protect commercial data provider interests
- Enable version tracking and integrity verification

The format must support:
- Efficient random access to specific data (airports, procedures, charts)
- Metadata for version tracking and validation
- Multiple data types (navdata, charts, procedures)
- Incremental updates without full re-download
- Cross-platform compatibility (Windows, Linux, macOS, mobile)

## Decision

**Specification to be defined in Phase 0.**

The format will be designed with these principles:

1. **Abstraction**: All access through adapter interfaces
2. **Extensibility**: Format can evolve without breaking existing code
3. **Performance**: Support indexed lookups, not full decryption
4. **Security**: Industry-standard encryption algorithms
5. **Metadata**: Embedded version, checksum, coverage info

## Proposed Approach

### Container Structure
```
Package File (.aipdata)
├── Header (unencrypted)
│   ├── Magic bytes
│   ├── Format version
│   ├── Metadata (JSON)
│   │   ├── Package version
│   │   ├── Coverage region
│   │   ├── Effective dates
│   │   └── Checksum
│   └── Index (encrypted)
│       └── Entity offsets
└── Data Blocks (encrypted)
    ├── Airports
    ├── Waypoints
    ├── Navaids
    ├── Airways
    ├── Procedures
    └── Charts
```

### Encryption Considerations

- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Key derivation**: PBKDF2 or Argon2
- **Block-level encryption**: Each data block independently encrypted
- **Index encryption**: Separate key for index to enable fast lookups

### Adapter Interface

```rust
trait PackageReader {
    fn metadata(&self) -> Result<PackageMetadata>;
    fn read_airports(&self, region: Option<&str>) -> Result<Vec<Airport>>;
    fn read_waypoints(&self, bounds: Bounds) -> Result<Vec<Waypoint>>;
    fn read_chart(&self, chart_id: &str) -> Result<ChartDocument>;
    // ... other entity types
}
```

## Open Questions

1. **Key management**: How are decryption keys distributed?
   - Embedded in app (less secure, simpler)
   - User-provided license key
   - Server-side key exchange

2. **Compression**: Should data be compressed before encryption?
   - Pros: Smaller package size
   - Cons: Can't compress encrypted data, adds complexity

3. **Incremental updates**: Delta updates or full replacement?
   - Delta: More efficient, more complex
   - Full: Simpler, larger downloads

4. **Index format**: Binary or structured (protobuf, flatbuffers)?

## Consequences

### Positive

- **Protection**: Commercial data properly protected
- **Flexibility**: Format can evolve behind adapter interface
- **Performance**: Indexed access avoids full decryption
- **Compliance**: Meets licensing requirements

### Negative

- **Complexity**: Custom format requires careful design and testing
- **Maintenance**: Format evolution requires migration paths
- **Debugging**: Encrypted data harder to inspect during development

### Next Steps

1. Define detailed format specification
2. Implement reference encoder/decoder
3. Create test fixtures with sample data
4. Document key management strategy
5. Implement adapter interface in `crates/charts`
