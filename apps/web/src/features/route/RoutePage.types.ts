import type { RoutePlanningOverlay, RoutePlanningSelection, RoutePreviewSelection } from "../app/types";
import type { AirportRunwayEnd, ProcedureSummary, TransitionSummary } from "../../types/api";

export type RoutePageProps = {
  onRoutePreviewChange?: (selection: RoutePreviewSelection | null, planning?: RoutePlanningOverlay | null) => void;
  planningSelection?: RoutePlanningSelection | null;
};

export type AirportPlanningData = {
  airportIdent: string;
  procedures: ProcedureSummary[];
  transitions: TransitionSummary[];
  runways: AirportRunwayEnd[];
};

export type RouteSelectionTone = "slate" | "emerald" | "amber" | "orange" | "fuchsia" | "sky";

export type WorkflowStep = {
  step: string;
  label: string;
  detail: string;
  isActive: boolean;
  isComplete: boolean;
};

export type SelectionSnapshotItem = {
  label: string;
  value: string;
  hint?: string | null;
  tone: RouteSelectionTone;
};
