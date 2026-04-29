import type {
  AirportProceduresResponse,
  Bounds,
  HealthResponse,
  MapLayersResponse,
  ProcedureGeometryResponse,
  VersionResponse,
} from "../types/api";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

type RequestOptions = {
  signal?: AbortSignal;
};

type LayerRequestOptions = RequestOptions & {
  zoom: number;
  airports: boolean;
  waypoints: boolean;
  vors: boolean;
  ndbs: boolean;
  airways: boolean;
};

async function requestJson<T>(path: string, options?: RequestOptions): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    signal: options?.signal,
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export function getHealth() {
  return requestJson<HealthResponse>("/api/v1/health");
}

export function getVersion() {
  return requestJson<VersionResponse>("/api/v1/version");
}

export function getMapLayers(bounds: Bounds, options: LayerRequestOptions) {
  const query = new URLSearchParams({
    west: bounds.west.toString(),
    south: bounds.south.toString(),
    east: bounds.east.toString(),
    north: bounds.north.toString(),
    zoom: options.zoom.toString(),
    airports: String(options.airports),
    waypoints: String(options.waypoints),
    vors: String(options.vors),
    ndbs: String(options.ndbs),
    airways: String(options.airways),
  });

  return requestJson<MapLayersResponse>(`/api/v1/map/layers?${query.toString()}`, options);
}

export function getAirportProcedures(airportIdent: string, options?: RequestOptions) {
  return requestJson<AirportProceduresResponse>(
    `/api/v1/airports/${encodeURIComponent(airportIdent)}/procedures`,
    options,
  );
}

export function getProcedureGeometry(procedureId: number, options?: RequestOptions) {
  return requestJson<ProcedureGeometryResponse>(
    `/api/v1/procedures/${procedureId}`,
    options,
  );
}
