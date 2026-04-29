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

export type AirportInfoSummary = {
  icaoId?: string | null;
  iataId?: string | null;
  faaId?: string | null;
  name: string;
  state?: string | null;
  country?: string | null;
  source?: string | null;
  airportType?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  elevationFt?: number | null;
  magneticDeclination?: string | null;
  owner?: string | null;
  runwayCount: number;
};

export type StationInfoSummary = {
  icaoId?: string | null;
  iataId?: string | null;
  faaId?: string | null;
  site: string;
  state?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  elevationM?: number | null;
  priority?: number | null;
  siteTypes: string[];
};

export type WeatherCloudLayer = {
  cover: string;
  baseFt?: number | null;
  topFt?: number | null;
};

export type MetarObservation = {
  icaoId: string;
  stationName?: string | null;
  observedAtUnix?: number | null;
  receivedAt?: string | null;
  reportedAt?: string | null;
  rawText: string;
  flightCategory?: string | null;
  metarType?: string | null;
  temperatureC?: number | null;
  dewpointC?: number | null;
  windDirection?: string | null;
  windSpeedKt?: number | null;
  windGustKt?: number | null;
  visibilitySm?: string | null;
  altimeterHpa?: number | null;
  seaLevelPressureHpa?: number | null;
  weather?: string | null;
  verticalVisibilityFt?: number | null;
  precipitationLastHourIn?: number | null;
  precipitationLast3hIn?: number | null;
  precipitationLast6hIn?: number | null;
  precipitationLast24hIn?: number | null;
  clouds: WeatherCloudLayer[];
};

export type TafForecastSegment = {
  validFromUnix?: number | null;
  validToUnix?: number | null;
  transitionEndUnix?: number | null;
  changeType?: string | null;
  probability?: number | null;
  windDirection?: string | null;
  windSpeedKt?: number | null;
  windGustKt?: number | null;
  visibilitySm?: string | null;
  altimeterHpa?: number | null;
  weather?: string | null;
  verticalVisibilityFt?: number | null;
  notDecoded?: string | null;
  clouds: WeatherCloudLayer[];
};

export type TafReport = {
  icaoId: string;
  stationName?: string | null;
  issuedAt?: string | null;
  bulletinTime?: string | null;
  validFromUnix?: number | null;
  validToUnix?: number | null;
  rawText: string;
  remarks?: string | null;
  forecastSegments: TafForecastSegment[];
};

export type WeatherTextBulletin = {
  issuedAt?: string | null;
  text: string;
};

export type NoaaCycleMetar = {
  cycleLabel: string;
  rawText: string;
};

export type NoaaWeatherSupplement = {
  currentRaw?: WeatherTextBulletin | null;
  currentDecoded?: WeatherTextBulletin | null;
  recentCycles: NoaaCycleMetar[];
};

export type AirportWeatherOverviewResponse = {
  requestedId: string;
  resolvedId: string;
  airport?: AirportInfoSummary | null;
  station?: StationInfoSummary | null;
  metar?: MetarObservation | null;
  taf?: TafReport | null;
  noaa: NoaaWeatherSupplement;
  warnings: string[];
};
