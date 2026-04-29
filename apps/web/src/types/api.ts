export type HealthResponse = {
  service: string;
  status: string;
};

export type VersionResponse = {
  service: string;
  version: string;
};

export type AirportSummary = {
  id: string;
  icao: string;
  name: string;
  location: {
    lat: number;
    lon: number;
  };
};

