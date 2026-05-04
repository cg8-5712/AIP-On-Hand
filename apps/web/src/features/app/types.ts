import type {
  AirportRunwayEnd,
  Bounds,
  LatLon,
  ProcedureGeometryResponse,
  ProcedureKind,
  ProcedureSummary,
  RoutePlanCandidate,
  TransitionGeometryResponse,
  TransitionSummary,
} from "../../types/api";

export type LayerVisibility = {
  airports: boolean;
  waypointsEnroute: boolean;
  waypointsTerminal: boolean;
  vors: boolean;
  ndbs: boolean;
  airways: boolean;
};

export type BasemapTone = "classic" | "dark" | "light";

export type ViewportState = {
  bounds: Bounds;
  zoom: number;
};

export type ProcedureFilter = "all" | ProcedureKind;
export type AppPage = "map" | "airport" | "eaip" | "weather" | "route" | "fuel" | "settings";
export type MapFocusRequestPayload =
  | {
      kind: "location";
      location: LatLon;
      zoom?: number;
      preserveZoom?: boolean;
    }
  | {
      kind: "bounds";
      points: LatLon[];
    }
  | {
      kind: "procedure";
      procedureId: number;
    };

export type MapFocusRequest = MapFocusRequestPayload & {
  requestId: number;
};

export type RoutePreviewSelection = {
  candidate: RoutePlanCandidate;
  departureProcedureId: number | null;
  arrivalProcedureId: number | null;
  arrivalTransitionId: number | null;
  approachProcedureId: number | null;
};

export type RoutePlanningSelection = {
  kind: "procedure" | "transition";
  id: number;
};

export type RouteProcedureSelectionStage =
  | "departure"
  | "arrival-star"
  | "arrival-transition"
  | "arrival-approach";

export type RoutePlanningProcedureGroup = {
  airportIdent: string;
  runwayName: string | null;
  procedures: ProcedureSummary[];
  displayedProcedureIds: number[];
  selectedProcedureId: number | null;
  displayedProcedures: ProcedureGeometryResponse[];
};

export type RoutePlanningTransitionGroup = {
  airportIdent: string;
  runwayName: string | null;
  transitions: TransitionSummary[];
  displayedTransitionIds: number[];
  selectedTransitionId: number | null;
  displayedTransitions: TransitionGeometryResponse[];
};

export type RoutePlanningOverlay = {
  departureAirportIdent: string;
  arrivalAirportIdent: string;
  departureRunways: AirportRunwayEnd[];
  arrivalRunways: AirportRunwayEnd[];
  selectedDepartureRunwayName: string | null;
  selectedArrivalRunwayName: string | null;
  departure: RoutePlanningProcedureGroup | null;
  arrivalStar: RoutePlanningProcedureGroup | null;
  arrivalTransition: RoutePlanningTransitionGroup | null;
  arrivalApproach: RoutePlanningProcedureGroup | null;
  activeStage: RouteProcedureSelectionStage | null;
};

export type RouteMapOverlay = {
  selection: RoutePreviewSelection;
  departureProcedure: ProcedureGeometryResponse | null;
  arrivalProcedure: ProcedureGeometryResponse | null;
  arrivalTransition: TransitionGeometryResponse | null;
  approachProcedure: ProcedureGeometryResponse | null;
  planning: RoutePlanningOverlay | null;
};

export const initialVisibility: LayerVisibility = {
  airports: true,
  waypointsEnroute: false,
  waypointsTerminal: false,
  vors: true,
  ndbs: false,
  airways: true,
};

export const panelClass = "layout-panel p-5";

export const procedureFilterOptions: Array<{ key: ProcedureFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "sid", label: "SID" },
  { key: "star", label: "STAR" },
  { key: "approach", label: "Approach" },
  { key: "procedure", label: "Other" },
];
