import type {
  Bounds,
  LatLon,
  ProcedureGeometryResponse,
  ProcedureKind,
  RoutePlanCandidate,
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
export type AppPage = "map" | "eaip" | "weather" | "route" | "fuel" | "settings";
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
  approachProcedureId: number | null;
};

export type RouteMapOverlay = {
  selection: RoutePreviewSelection;
  departureProcedure: ProcedureGeometryResponse | null;
  arrivalProcedure: ProcedureGeometryResponse | null;
  approachProcedure: ProcedureGeometryResponse | null;
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
