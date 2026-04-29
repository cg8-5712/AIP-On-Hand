export type HealthResponse = {
  service: string;
  status: string;
};

export type VersionResponse = {
  service: string;
  version: string;
};

export type LatLon = {
  lat: number;
  lon: number;
};

export type NavDbMetadata = {
  airacCycle: string;
  validThrough: string;
  dataSource: string;
  hasSidStar: boolean;
};

export type AirportFeature = {
  id: number;
  ident: string;
  icao?: string | null;
  name: string;
  country?: string | null;
  numApproaches: number;
  longestRunwayLength: number;
  location: LatLon;
};

export type WaypointFeature = {
  id: number;
  ident: string;
  name?: string | null;
  waypointType?: string | null;
  arincType?: string | null;
  airportIdent?: string | null;
  location: LatLon;
};

export type NavaidFeature = {
  id: number;
  ident: string;
  name?: string | null;
  navaidType: "vor" | "ndb";
  facilityType?: string | null;
  airportIdent?: string | null;
  location: LatLon;
};

export type AirwayFeature = {
  id: number;
  airwayName: string;
  airwayType: string;
  routeType?: string | null;
  direction?: string | null;
  minimumAltitude?: number | null;
  maximumAltitude?: number | null;
  from: LatLon;
  to: LatLon;
};

export type LayerTruncation = {
  airports: boolean;
  waypoints: boolean;
  vors: boolean;
  ndbs: boolean;
  airways: boolean;
};

export type MapLayersResponse = {
  metadata: NavDbMetadata;
  airports: AirportFeature[];
  waypoints: WaypointFeature[];
  vors: NavaidFeature[];
  ndbs: NavaidFeature[];
  airways: AirwayFeature[];
  truncation: LayerTruncation;
};

export type ProcedureKind = "sid" | "star" | "approach" | "procedure";

export type SearchEntityType =
  | "airport"
  | "waypoint"
  | "vor"
  | "ndb"
  | "airway"
  | "sid"
  | "star"
  | "approach"
  | "procedure";

export type ProcedureSummary = {
  id: number;
  airportIdent: string;
  airportName: string;
  name: string;
  arincName: string;
  procedureType: string;
  procedureKind: ProcedureKind;
  runwayName?: string | null;
  legs: number;
};

export type ProcedureAirport = {
  id: number;
  ident: string;
  icao?: string | null;
  name: string;
  location: LatLon;
};

export type AirportProceduresResponse = {
  airport: ProcedureAirport;
  procedures: ProcedureSummary[];
};

export type ProcedureLegPoint = {
  ident?: string | null;
  legType?: string | null;
  position: LatLon;
};

export type ProcedureGeometryResponse = {
  summary: ProcedureSummary;
  airport: ProcedureAirport;
  path: ProcedureLegPoint[];
  missedPath: ProcedureLegPoint[];
};

export type SearchResultItem = {
  id: string;
  entityType: SearchEntityType;
  ident: string;
  name?: string | null;
  airportIdent?: string | null;
  airportName?: string | null;
  procedureId?: number | null;
  procedureKind?: ProcedureKind | null;
  procedureType?: string | null;
  runwayName?: string | null;
  airwayType?: string | null;
  location?: LatLon | null;
  from?: LatLon | null;
  to?: LatLon | null;
};

export type SearchResponse = {
  query: string;
  results: SearchResultItem[];
};

export type Bounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};
