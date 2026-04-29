import type { Bounds, ProcedureKind } from "../../types/api";

export type LayerVisibility = {
  airports: boolean;
  waypoints: boolean;
  vors: boolean;
  ndbs: boolean;
  airways: boolean;
};

export type ViewportState = {
  bounds: Bounds;
  zoom: number;
};

export type ProcedureFilter = "all" | ProcedureKind;

export const initialVisibility: LayerVisibility = {
  airports: true,
  waypoints: false,
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
