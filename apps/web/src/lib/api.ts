import type { AirportSummary, HealthResponse, VersionResponse } from "../types/api";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

async function requestJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`);

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

export function getSampleAirports() {
  return requestJson<AirportSummary[]>("/api/v1/map/sample-airports");
}

