import type {
  AirportWeatherOverviewResponse,
  AirportProceduresResponse,
  Bounds,
  EaipAirportChartsResponse,
  EaipCatalogResponse,
  EaipStatusResponse,
  HealthResponse,
  MapLayersResponse,
  ProcedureGeometryResponse,
  RoutePlanResponse,
  SearchResponse,
  VersionResponse,
} from "../types/api";

function resolveApiBaseUrl() {
  const explicitBaseUrl = import.meta.env.VITE_API_BASE_URL;
  if (typeof explicitBaseUrl === "string" && explicitBaseUrl.trim().length > 0) {
    return explicitBaseUrl.trim().replace(/\/$/, "");
  }

  if (typeof window !== "undefined" && window.location.port === "5173") {
    return "http://127.0.0.1:8080";
  }

  return "";
}

const apiBaseUrl = resolveApiBaseUrl();

type RequestOptions = {
  signal?: AbortSignal;
  cache?: RequestCache;
};

type JsonRequestOptions = RequestOptions & {
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
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
    cache: options?.cache,
    signal: options?.signal,
  });

  if (!response.ok) {
    const payload = await response
      .json()
      .catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ?? `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

async function sendJson<TResponse, TBody>(
  path: string,
  body: TBody,
  options?: JsonRequestOptions,
): Promise<TResponse> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options?.method ?? "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: options?.cache,
    signal: options?.signal,
  });

  if (!response.ok) {
    const payload = await response
      .json()
      .catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ?? `Request failed with status ${response.status}`);
  }

  return (await response.json()) as TResponse;
}

async function requestBlob(path: string, options?: RequestOptions): Promise<Blob> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    cache: options?.cache,
    signal: options?.signal,
  });

  if (!response.ok) {
    const payload = await response
      .json()
      .catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ?? `Request failed with status ${response.status}`);
  }

  return response.blob();
}

async function sendFormData<TResponse>(
  path: string,
  formData: FormData,
  options?: JsonRequestOptions,
): Promise<TResponse> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options?.method ?? "POST",
    body: formData,
    cache: options?.cache,
    signal: options?.signal,
  });

  if (!response.ok) {
    const payload = await response
      .json()
      .catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ?? `Request failed with status ${response.status}`);
  }

  return (await response.json()) as TResponse;
}

export function getHealth() {
  return requestJson<HealthResponse>("/api/v1/health");
}

export function getVersion() {
  return requestJson<VersionResponse>("/api/v1/version");
}

export function getEaipStatus(options?: RequestOptions) {
  return requestJson<EaipStatusResponse>("/api/v1/eaip/status", {
    ...options,
    cache: "no-store",
  });
}

export function configureEaip(packagePath: string, password: string, options?: JsonRequestOptions) {
  return sendJson<EaipStatusResponse, { packagePath: string; password: string }>(
    "/api/v1/eaip/configure",
    {
      packagePath,
      password,
    },
    {
      ...options,
      cache: "no-store",
    },
  );
}

export function unloadEaip(options?: JsonRequestOptions) {
  return sendJson<EaipStatusResponse, Record<string, never>>(
    "/api/v1/eaip/unload",
    {},
    {
      ...options,
      cache: "no-store",
    },
  );
}

export function uploadEaip(packageFile: File, password: string, options?: JsonRequestOptions) {
  const formData = new FormData();
  formData.append("package", packageFile);
  formData.append("password", password);

  return sendFormData<EaipStatusResponse>("/api/v1/eaip/upload", formData, {
    ...options,
    cache: "no-store",
  });
}

export function getEaipCatalog(options?: RequestOptions) {
  return requestJson<EaipCatalogResponse>("/api/v1/eaip/catalog", {
    ...options,
    cache: "no-store",
  });
}

export function getEaipAirportCharts(airportIdent: string, options?: RequestOptions) {
  return requestJson<EaipAirportChartsResponse>(
    `/api/v1/eaip/airports/${encodeURIComponent(airportIdent)}/charts`,
    {
      ...options,
      cache: "no-store",
    },
  );
}

export function getEaipChartContent(chartId: string, options?: RequestOptions) {
  return requestBlob(`/api/v1/eaip/charts/${encodeURIComponent(chartId)}/content`, {
    ...options,
    cache: "no-store",
  });
}

export function getEaipChartContentUrl(chartId: string) {
  return `${apiBaseUrl}/api/v1/eaip/charts/${encodeURIComponent(chartId)}/content`;
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

export function searchNavdata(query: string, options?: RequestOptions) {
  const params = new URLSearchParams({
    q: query,
  });

  return requestJson<SearchResponse>(`/api/v1/search?${params.toString()}`, options);
}

type RoutePlanOptions = RequestOptions & {
  departure: string;
  arrival: string;
  cruiseAltitudeFt: number;
  limit?: number;
};

export function planRoute(options: RoutePlanOptions) {
  const params = new URLSearchParams({
    departure: options.departure,
    arrival: options.arrival,
    cruiseAltitudeFt: String(options.cruiseAltitudeFt),
  });

  if (typeof options.limit === "number" && options.limit > 0) {
    params.set("limit", String(options.limit));
  }

  return requestJson<RoutePlanResponse>(`/api/v1/routes/plan?${params.toString()}`, options);
}

type AirportOverviewOptions = RequestOptions & {
  historyHours?: number;
};

export function getAirportOverview(stationId: string, options?: AirportOverviewOptions) {
  const params = new URLSearchParams();
  if (typeof options?.historyHours === "number" && options.historyHours > 0) {
    params.set("historyHours", String(options.historyHours));
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : "";

  return requestJson<AirportWeatherOverviewResponse>(
    `/api/v1/airports/${encodeURIComponent(stationId)}/overview${suffix}`,
    options,
  );
}
