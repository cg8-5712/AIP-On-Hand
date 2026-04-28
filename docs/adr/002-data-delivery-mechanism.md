# ADR-002: Data Delivery Mechanism

## Status

Accepted

## Date

2026-04-28

## Context

The application requires commercial aviation navigation data (waypoints, navaids, airways, procedures) that cannot be bundled with the application due to:

- Licensing restrictions on redistribution
- Large dataset sizes
- Frequent updates required for aviation safety
- Regional coverage variations

Users need a reliable way to obtain and update this data while maintaining:
- Data integrity and authenticity
- Version tracking
- Offline capability after initial download

## Decision

We will implement a **dual-mode data delivery system**:

1. **Primary: OTA (Over-The-Air) Updates**
   - Automated download of encrypted data packages
   - Version checking and incremental updates
   - Integrity verification via checksums/signatures

2. **Fallback: Manual Upload**
   - Users can manually upload data packages
   - Useful for air-gapped environments
   - Supports custom/regional datasets

## Technical Requirements

- All data packages must be encrypted with custom format (see ADR-003)
- Version metadata embedded in packages
- Integrity verification before installation
- Rollback capability if update fails
- Clear UI indication of data version and freshness

## Consequences

### Positive

- **Flexibility**: Users can choose update method based on their environment
- **Compliance**: Respects commercial data licensing restrictions
- **Offline-first**: Application remains functional after initial data load
- **Security**: Encrypted packages protect commercial data
- **Updates**: Easy to push critical navdata updates

### Negative

- **Complexity**: Two code paths to maintain (OTA + manual)
- **First-run UX**: Users must obtain data before first use
- **Storage**: Need to manage multiple data versions
- **Network dependency**: OTA requires internet connectivity

### Mitigation

- Implement OTA first, manual upload as Phase 1 fallback
- Clear onboarding flow explaining data requirements
- Automatic cleanup of old data versions
- Graceful degradation if data is stale
