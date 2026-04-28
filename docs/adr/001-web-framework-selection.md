# ADR-001: Web Framework Selection

## Status

Accepted

## Date

2026-04-28

## Context

The project requires a Rust web framework for the browser-mode HTTP API. The API will serve:

- Aviation navigation data queries
- Search endpoints for airports, waypoints, navaids
- Route planning and validation services
- Chart metadata and document retrieval
- Weather information proxying
- Export format generation

Key requirements:
- Mature ecosystem with good documentation
- Strong async support (tokio-based)
- JSON serialization/deserialization
- Middleware support for logging, error handling
- WebSocket support for potential future real-time features
- Active maintenance and community

## Decision

We will use **actix-web** as the web framework for the browser-mode HTTP API.

## Alternatives Considered

### axum
- Pros: Modern, type-safe, excellent ergonomics, growing ecosystem
- Cons: Younger ecosystem, fewer examples for complex scenarios

### Rocket
- Pros: Excellent developer experience, strong type safety
- Cons: Historically slower async adoption, smaller ecosystem

### warp
- Pros: Functional composition style, good performance
- Cons: Steeper learning curve, less intuitive error handling

## Consequences

### Positive

- **Mature ecosystem**: actix-web has been battle-tested in production environments
- **Performance**: Known for excellent performance characteristics
- **Rich middleware**: Extensive middleware ecosystem for common tasks
- **Documentation**: Comprehensive documentation and examples
- **Tokio integration**: Native tokio support aligns with our async runtime choice
- **WebSocket support**: Built-in WebSocket support for future features

### Negative

- **Boilerplate**: Slightly more boilerplate compared to axum
- **Learning curve**: Actor-based patterns may be unfamiliar to some developers
- **Migration path**: If we need to switch later, significant refactoring required

### Mitigation

- Keep API layer thin and delegate to service modules
- Abstract transport concerns behind service interfaces
- This makes potential future migration less painful
