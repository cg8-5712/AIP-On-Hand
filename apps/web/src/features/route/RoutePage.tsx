import { useEffect, useEffectEvent, useMemo, useRef, useState, type FormEvent } from "react";
import type { RoutePlanningOverlay, RoutePlanningSelection, RoutePreviewSelection } from "../app/types";
import { getAirportProcedures, getAirportRunwayEnds, getAirportTransitions, planRoute } from "../../lib/api";
import type {
  AirportRunwayEnd,
  ProcedureSummary,
  RouteAirwaySegment,
  RoutePlanCandidate,
  RoutePlanResponse,
  RouteProcedureOption,
  TransitionSummary,
} from "../../types/api";

type RoutePageProps = {
  onRoutePreviewChange?: (selection: RoutePreviewSelection | null, planning?: RoutePlanningOverlay | null) => void;
  planningSelection?: RoutePlanningSelection | null;
};

type CandidateCardProps = {
  candidate: RoutePlanCandidate;
  index: number;
  isActive: boolean;
  onActivate: () => void;
  departureSelectionLabel?: string | null;
  arrivalSelectionLabel?: string | null;
  transitionSelectionLabel?: string | null;
  approachSelectionLabel?: string | null;
  approachStatusText?: string | null;
  approachCountText?: string | null;
};

type AirportPlanningData = {
  airportIdent: string;
  procedures: ProcedureSummary[];
  transitions: TransitionSummary[];
  runways: AirportRunwayEnd[];
};

function formatDistance(distanceNm: number) {
  return `${Math.round(distanceNm)} nm`;
}

function formatDirection(direction?: string | null) {
  switch (direction?.toUpperCase()) {
    case "F":
      return "one-way";
    case "B":
      return "reverse one-way";
    default:
      return "two-way";
  }
}

function formatAltitudeBand(segment: RouteAirwaySegment) {
  const minimum = segment.minimumAltitude ?? null;
  const maximum = segment.maximumAltitude ?? null;

  if (minimum !== null && maximum !== null) {
    return `${minimum}-${maximum} ft`;
  }

  if (minimum !== null) {
    return `>= ${minimum} ft`;
  }

  if (maximum !== null) {
    return `<= ${maximum} ft`;
  }

  return "unrestricted";
}

function formatProcedureLabel(procedure: RouteProcedureOption) {
  const runway = procedure.runwayName ? `RWY ${procedure.runwayName}` : "RWY later";
  return `${procedure.name} / ${runway}`;
}

function formatAirwaySequence(segments: RouteAirwaySegment[]) {
  if (segments.length === 0) {
    return "No airway path";
  }

  const sequence: string[] = [];
  let groupStartIdent = segments[0].fromIdent;
  let currentAirwayName = segments[0].airwayName;
  let groupEndIdent = segments[0].toIdent;

  for (let index = 1; index < segments.length; index += 1) {
    const segment = segments[index];
    const isSameAirwayGroup =
      segment.airwayName === currentAirwayName && segments[index - 1]?.toIdent === segment.fromIdent;

    if (isSameAirwayGroup) {
      groupEndIdent = segment.toIdent;
      continue;
    }

    if (sequence.length === 0) {
      sequence.push(groupStartIdent, currentAirwayName, groupEndIdent);
    } else {
      sequence.push(currentAirwayName, groupEndIdent);
    }

    groupStartIdent = segment.fromIdent;
    currentAirwayName = segment.airwayName;
    groupEndIdent = segment.toIdent;
  }

  if (sequence.length === 0) {
    sequence.push(groupStartIdent, currentAirwayName, groupEndIdent);
  } else {
    sequence.push(currentAirwayName, groupEndIdent);
  }

  return sequence.join(" ");
}

function findProcedureSummaryById(procedures: ProcedureSummary[], procedureId: number | null) {
  if (!procedureId) {
    return null;
  }

  return procedures.find((procedure) => procedure.id === procedureId) ?? null;
}

function findTransitionSummaryById(transitions: TransitionSummary[], transitionId: number | null) {
  if (!transitionId) {
    return null;
  }

  return transitions.find((transition) => transition.id === transitionId) ?? null;
}

function parseArincRunwayToken(value: string | null | undefined) {
  const normalized = normalizeRunwayName(value);
  if (!normalized) {
    return null;
  }

  const match = normalized.match(/^RWY?(\d{1,2})([LRCB])?$/);
  if (!match) {
    return null;
  }

  return {
    direction: match[1],
    side: match[2] ?? null,
  };
}

function resolveProcedureRunwayLabel(procedure: ProcedureSummary | null) {
  if (!procedure) {
    return null;
  }

  const directRunwayName = normalizeRunwayName(procedure.runwayName);
  if (directRunwayName) {
    return directRunwayName;
  }

  const normalizedArincName = normalizeRunwayName(procedure.arincName);
  if (!normalizedArincName) {
    return null;
  }

  const arincRunway = parseArincRunwayToken(normalizedArincName);
  if (!arincRunway) {
    return null;
  }

  return `${arincRunway.direction}${arincRunway.side ?? ""}`;
}

function formatSelectionWithRunway(name: string | null | undefined, runwayLabel: string | null | undefined) {
  if (!name) {
    return null;
  }

  return runwayLabel ? `${name} / RWY ${runwayLabel}` : name;
}

function defaultProcedureId(procedures: RouteProcedureOption[]) {
  return procedures[0]?.procedureId ?? null;
}

function normalizeRunwayName(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase();
  return normalized ? normalized : null;
}

function runwayDirectionKey(value: string | null | undefined) {
  const normalized = normalizeRunwayName(value);
  if (!normalized) {
    return null;
  }

  const match = normalized.match(/^(\d{1,2})/);
  return match?.[1] ?? null;
}

function procedureRunwayMatchesSelectedRunway(procedure: ProcedureSummary, runwayName: string) {
  const normalizedRunwayName = normalizeRunwayName(runwayName);
  if (!normalizedRunwayName) {
    return false;
  }

  const directRunwayName = normalizeRunwayName(procedure.runwayName);
  if (directRunwayName) {
    return directRunwayName === normalizedRunwayName;
  }

  const selectedDirection = runwayDirectionKey(normalizedRunwayName);
  if (!selectedDirection) {
    return false;
  }

  const arincRunway = parseArincRunwayToken(procedure.arincName);
  if (!arincRunway) {
    return false;
  }

  if (arincRunway.direction !== selectedDirection) {
    return false;
  }

  return arincRunway.side === null || arincRunway.side === "B" || normalizedRunwayName.endsWith(arincRunway.side);
}

function sortRunwaysForOperation(runways: AirportRunwayEnd[], operation: "departure" | "arrival") {
  return [...runways]
    .filter((runway) => (operation === "departure" ? runway.isTakeoff : runway.isLanding))
    .sort((left, right) => right.lengthFt - left.lengthFt || left.runwayName.localeCompare(right.runwayName));
}

function proceduresForKind(procedures: ProcedureSummary[], kind: ProcedureSummary["procedureKind"]) {
  return procedures.filter((procedure) => procedure.procedureKind === kind);
}

function filterProceduresByRunway(procedures: ProcedureSummary[], runwayName: string | null) {
  const normalizedRunwayName = normalizeRunwayName(runwayName);
  if (!normalizedRunwayName) {
    return procedures;
  }

  return procedures.filter((procedure) => procedureRunwayMatchesSelectedRunway(procedure, normalizedRunwayName));
}

function filterTransitionsByRunway(transitions: TransitionSummary[], runwayName: string | null) {
  const normalizedRunwayName = normalizeRunwayName(runwayName);
  if (!normalizedRunwayName) {
    return transitions;
  }

  return transitions.filter((transition) => normalizeRunwayName(transition.runwayName) === normalizedRunwayName);
}

function filterApproachesByRunwayAndTransition(
  procedures: ProcedureSummary[],
  runwayName: string | null,
  allowedApproachIds: Set<number> | null,
) {
  const byRunway = filterProceduresByRunway(procedures, runwayName);
  if (!allowedApproachIds || allowedApproachIds.size === 0) {
    return byRunway;
  }

  return byRunway.filter((procedure) => allowedApproachIds.has(procedure.id));
}

function groupTransitions(transitions: TransitionSummary[]) {
  const representatives: TransitionSummary[] = [];
  const approachIdsByTransitionId = new Map<number, Set<number>>();

  for (const transition of transitions) {
    const key = `${normalizeRunwayName(transition.runwayName) ?? ""}|${transition.name}`;
    const existing = representatives.find(
      (candidate) => `${normalizeRunwayName(candidate.runwayName) ?? ""}|${candidate.name}` === key,
    );

    if (!existing) {
      representatives.push(transition);
      approachIdsByTransitionId.set(transition.id, new Set([transition.approachId]));
      continue;
    }

    const approachIds = approachIdsByTransitionId.get(existing.id);
    if (approachIds) {
      approachIds.add(transition.approachId);
    }
  }

  return {
    transitions: representatives,
    approachIdsByTransitionId: new Map(
      [...approachIdsByTransitionId.entries()].map(([transitionId, approachIds]) => [
        transitionId,
        new Set(approachIds),
      ]),
    ),
  };
}

function ProcedureChip({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/35 ${
        isActive
          ? "border-slate-100/80 bg-slate-100/20 text-slate-50 shadow-[0_10px_24px_rgba(255,255,255,0.06)]"
          : "border-slate-300/18 bg-slate-300/8 text-slate-200 hover:border-slate-200/40 hover:bg-slate-200/12"
      }`}
    >
      {label}
    </button>
  );
}

function WorkflowStepCard({
  label,
  detail,
  isActive,
  isComplete,
}: {
  label: string;
  detail: string;
  isActive: boolean;
  isComplete: boolean;
}) {
  return (
    <div
      className={`rounded-[18px] border px-4 py-3 transition ${
        isActive
          ? "border-cyan-300/45 bg-cyan-300/10 shadow-[0_16px_36px_rgba(56,189,248,0.12)]"
          : isComplete
            ? "border-emerald-300/24 bg-emerald-300/8"
            : "border-slate-700/65 bg-slate-950/45"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className={`m-0 text-[0.68rem] uppercase tracking-[0.22em] ${isActive ? "text-cyan-100" : "text-slate-400"}`}>
          {label}
        </p>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.16em] ${
            isActive
              ? "border-cyan-200/45 bg-cyan-300/16 text-cyan-50"
              : isComplete
                ? "border-emerald-200/30 bg-emerald-300/14 text-emerald-50"
                : "border-slate-300/18 bg-slate-300/8 text-slate-300"
          }`}
        >
          {isActive ? "Current" : isComplete ? "Ready" : "Pending"}
        </span>
      </div>
      <p className={`mt-2 text-sm leading-5 ${isActive || isComplete ? "text-slate-100" : "text-slate-400"}`}>{detail}</p>
    </div>
  );
}

function SelectionSnapshotField({
  label,
  value,
  hint,
  tone = "slate",
}: {
  label: string;
  value: string;
  hint?: string | null;
  tone?: "slate" | "emerald" | "amber" | "orange" | "fuchsia" | "sky";
}) {
  const toneClasses =
    tone === "emerald"
      ? { label: "text-emerald-200/75", value: "text-emerald-50", border: "border-emerald-300/14 bg-emerald-300/6" }
      : tone === "amber"
        ? { label: "text-amber-200/75", value: "text-amber-50", border: "border-amber-300/14 bg-amber-300/6" }
        : tone === "orange"
          ? { label: "text-orange-200/75", value: "text-orange-50", border: "border-orange-300/14 bg-orange-300/6" }
          : tone === "fuchsia"
            ? { label: "text-fuchsia-200/75", value: "text-fuchsia-50", border: "border-fuchsia-300/14 bg-fuchsia-300/6" }
            : tone === "sky"
              ? { label: "text-sky-200/75", value: "text-sky-50", border: "border-sky-300/14 bg-sky-300/6" }
              : { label: "text-slate-400", value: "text-slate-100", border: "border-slate-700/60 bg-slate-950/45" };

  return (
    <div className={`rounded-[18px] border px-4 py-3 ${toneClasses.border}`}>
      <p className={`m-0 text-[0.68rem] uppercase tracking-[0.22em] ${toneClasses.label}`}>{label}</p>
      <p className={`mt-2 break-words font-mono text-sm ${toneClasses.value}`}>{value}</p>
      {hint ? <p className="mt-2 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

function CandidateCard({
  candidate,
  index,
  isActive,
  onActivate,
  departureSelectionLabel,
  arrivalSelectionLabel,
  transitionSelectionLabel,
  approachSelectionLabel,
  approachStatusText,
  approachCountText,
}: CandidateCardProps) {
  return (
    <article
      className={`min-w-0 rounded-[24px] border p-5 transition ${
        isActive
          ? "border-sky-300/60 bg-slate-950/70 shadow-[0_0_0_1px_rgba(125,211,252,0.18)]"
          : "border-slate-700/70 bg-slate-950/60"
      }`}
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="section-kicker">Candidate {index + 1}</p>
            <span
              className={`rounded-full border px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.18em] ${
                isActive
                  ? "border-cyan-200/45 bg-cyan-300/16 text-cyan-50"
                  : "border-slate-300/18 bg-slate-300/8 text-slate-300"
              }`}
            >
              {isActive ? "Pinned" : "Preview"}
            </span>
          </div>
          <h3 className="section-title mt-1 break-words text-[1.15rem]">{formatAirwaySequence(candidate.airways)}</h3>
          <p className="mt-2 text-sm text-slate-300">
            Select this candidate first. Then choose departure runway and SID, followed by arrival runway, STAR, transition, and approach.
          </p>
        </div>
        <div className="grid w-full gap-3 sm:w-auto sm:min-w-[210px]">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[18px] border border-slate-700/60 bg-slate-950/48 px-4 py-3 text-left">
              <p className="m-0 text-[0.72rem] uppercase tracking-[0.28em] text-slate-500">Total</p>
              <p className="m-0 mt-1 font-mono text-[1.1rem] text-slate-100">{formatDistance(candidate.totalDistanceNm)}</p>
            </div>
            <div className="rounded-[18px] border border-slate-700/60 bg-slate-950/48 px-4 py-3 text-left">
              <p className="m-0 text-[0.72rem] uppercase tracking-[0.28em] text-slate-500">Airway</p>
              <p className="m-0 mt-1 font-mono text-sm text-slate-300">{formatDistance(candidate.airwayDistanceNm)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onActivate}
            className={`cursor-pointer rounded-2xl border px-4 py-2 text-sm font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/35 ${
              isActive
                ? "border-sky-200/70 bg-sky-300/20 text-sky-50"
                : "border-sky-300/30 bg-sky-300/10 text-sky-100 hover:border-sky-200/60 hover:bg-sky-300/18"
            }`}
          >
            {isActive ? "Displayed on map" : "Show on map"}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 2xl:grid-cols-[1fr_1.15fr_1fr]">
        <section className="rounded-[20px] border border-emerald-400/16 bg-emerald-400/6 p-4">
          <p className="m-0 text-[0.72rem] uppercase tracking-[0.28em] text-emerald-200/80">Departure</p>
          <p className="mt-2 font-mono text-lg text-emerald-100">{candidate.departure.ident}</p>
          {departureSelectionLabel ? (
            <div className="mt-3 rounded-2xl border border-emerald-300/18 bg-slate-950/45 px-4 py-3">
              <p className="m-0 text-[0.68rem] uppercase tracking-[0.24em] text-emerald-200/70">Selected SID</p>
              <p className="mt-2 break-words font-mono text-base text-emerald-50">{departureSelectionLabel}</p>
            </div>
          ) : (
            <p className="mt-1 text-sm text-slate-300">
              SID shortest path {formatDistance(candidate.departure.minimumProcedureDistanceNm)}. Detailed runway and SID selection starts after this route is displayed.
            </p>
          )}
        </section>

        <section className="rounded-[20px] border border-sky-400/16 bg-sky-400/6 p-4">
          <p className="m-0 text-[0.72rem] uppercase tracking-[0.28em] text-sky-200/80">Airway</p>
          <div className="scroll-panel mt-2 grid max-h-[24rem] gap-2 overflow-y-auto pr-1">
            {candidate.airways.map((segment, segmentIndex) => (
              <div
                key={`${segment.airwayName}-${segmentIndex}-${segment.fromIdent}-${segment.toIdent}`}
                className="rounded-2xl border border-slate-700/70 bg-slate-950/55 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="m-0 font-mono text-sm text-slate-100">
                    {segment.fromIdent} <span className="text-sky-300">{segment.airwayName}</span>{" "}
                    {segment.toIdent}
                  </p>
                  <p className="m-0 font-mono text-xs text-slate-400">
                    {formatDistance(segment.distanceNm)}
                  </p>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  {segment.airwayType} / {formatDirection(segment.direction)} / {formatAltitudeBand(segment)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[20px] border border-amber-400/16 bg-amber-400/6 p-4">
          <p className="m-0 text-[0.72rem] uppercase tracking-[0.28em] text-amber-200/80">Arrival</p>
          <p className="mt-2 font-mono text-lg text-amber-100">{candidate.arrival.ident}</p>
          {arrivalSelectionLabel ? (
            <div className="mt-3 rounded-2xl border border-amber-300/18 bg-slate-950/45 px-4 py-3">
              <p className="m-0 text-[0.68rem] uppercase tracking-[0.24em] text-amber-200/70">Selected STAR</p>
              <p className="mt-2 break-words font-mono text-base text-amber-50">{arrivalSelectionLabel}</p>
            </div>
          ) : (
            <p className="mt-1 text-sm text-slate-300">
              STAR shortest path {formatDistance(candidate.arrival.minimumProcedureDistanceNm)}. Arrival runway, STAR, transition, and approach are selected after this route is displayed.
            </p>
          )}
        </section>
      </div>

      <section className="mt-4 rounded-[20px] border border-fuchsia-400/16 bg-fuchsia-400/6 p-4">
        <p className="m-0 text-[0.72rem] uppercase tracking-[0.28em] text-fuchsia-200/80">Approach</p>
        {transitionSelectionLabel ? (
          <div className="mt-3 rounded-2xl border border-orange-300/18 bg-slate-950/45 px-4 py-3">
            <p className="m-0 text-[0.68rem] uppercase tracking-[0.24em] text-orange-200/70">Selected Transition</p>
            <p className="mt-2 break-words font-mono text-base text-orange-50">{transitionSelectionLabel}</p>
          </div>
        ) : null}
        {approachSelectionLabel ? (
          <div className="mt-3 rounded-2xl border border-fuchsia-300/18 bg-slate-950/45 px-4 py-3">
            <p className="m-0 text-[0.68rem] uppercase tracking-[0.24em] text-fuchsia-200/70">Selected Approach</p>
            <p className="mt-2 break-words font-mono text-base text-fuchsia-50">{approachSelectionLabel}</p>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-300">
              {approachStatusText ?? "Published approach candidates stay available, but exact approach selection moves to the runway-first arrival workflow."}
            </p>
            <p className="mt-3 text-sm text-slate-400">
              {approachCountText ??
                (candidate.approaches.length > 0
                  ? `${candidate.approaches.length} published approach option(s) available after arrival runway selection.`
                  : "No published approach candidates were resolved.")}
            </p>
          </>
        )}
      </section>
    </article>
  );
}

export function RoutePage({ onRoutePreviewChange, planningSelection }: RoutePageProps) {
  const [departure, setDeparture] = useState("");
  const [arrival, setArrival] = useState("");
  const [cruiseAltitudeFt, setCruiseAltitudeFt] = useState("36000");
  const [limit, setLimit] = useState("5");
  const [result, setResult] = useState<RoutePlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeCandidateIndex, setActiveCandidateIndex] = useState<number | null>(null);
  const [selectedDepartureProcedureId, setSelectedDepartureProcedureId] = useState<number | null>(null);
  const [selectedArrivalProcedureId, setSelectedArrivalProcedureId] = useState<number | null>(null);
  const [selectedArrivalTransitionId, setSelectedArrivalTransitionId] = useState<number | null>(null);
  const [selectedApproachProcedureId, setSelectedApproachProcedureId] = useState<number | null>(null);
  const [isDepartureProcedureConfirmed, setIsDepartureProcedureConfirmed] = useState(false);
  const [isArrivalProcedureConfirmed, setIsArrivalProcedureConfirmed] = useState(false);
  const [isArrivalTransitionConfirmed, setIsArrivalTransitionConfirmed] = useState(false);
  const [isArrivalApproachConfirmed, setIsArrivalApproachConfirmed] = useState(false);
  const [departurePlanningData, setDeparturePlanningData] = useState<AirportPlanningData | null>(null);
  const [arrivalPlanningData, setArrivalPlanningData] = useState<AirportPlanningData | null>(null);
  const [selectedDepartureRunwayName, setSelectedDepartureRunwayName] = useState<string | null>(null);
  const [selectedArrivalRunwayName, setSelectedArrivalRunwayName] = useState<string | null>(null);
  const [planningError, setPlanningError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const planningAbortRef = useRef<AbortController | null>(null);
  const departureRunwayOptions = useMemo(
    () => (departurePlanningData ? sortRunwaysForOperation(departurePlanningData.runways, "departure") : []),
    [departurePlanningData],
  );
  const arrivalRunwayOptions = useMemo(
    () => (arrivalPlanningData ? sortRunwaysForOperation(arrivalPlanningData.runways, "arrival") : []),
    [arrivalPlanningData],
  );
  const availableDepartureProcedures = useMemo(
    () =>
      departurePlanningData
        ? filterProceduresByRunway(
            proceduresForKind(departurePlanningData.procedures, "sid"),
            selectedDepartureRunwayName,
          )
        : [],
    [departurePlanningData, selectedDepartureRunwayName],
  );
  const availableArrivalStarProcedures = useMemo(
    () =>
      arrivalPlanningData
        ? filterProceduresByRunway(
            proceduresForKind(arrivalPlanningData.procedures, "star"),
            selectedArrivalRunwayName,
          )
        : [],
    [arrivalPlanningData, selectedArrivalRunwayName],
  );
  const groupedArrivalTransitions = useMemo(
    () =>
      arrivalPlanningData
        ? groupTransitions(filterTransitionsByRunway(arrivalPlanningData.transitions, selectedArrivalRunwayName))
        : {
            transitions: [],
            approachIdsByTransitionId: new Map<number, Set<number>>(),
          },
    [arrivalPlanningData, selectedArrivalRunwayName],
  );
  const availableArrivalTransitions = groupedArrivalTransitions.transitions;
  const selectedArrivalTransitionApproachIds = useMemo(
    () =>
      selectedArrivalTransitionId
        ? groupedArrivalTransitions.approachIdsByTransitionId.get(selectedArrivalTransitionId) ?? null
        : null,
    [groupedArrivalTransitions.approachIdsByTransitionId, selectedArrivalTransitionId],
  );
  const availableArrivalApproachProcedures = useMemo(
    () =>
      arrivalPlanningData
        ? filterApproachesByRunwayAndTransition(
            proceduresForKind(arrivalPlanningData.procedures, "approach"),
            selectedArrivalRunwayName,
            selectedArrivalTransitionApproachIds,
          )
        : [],
    [arrivalPlanningData, selectedArrivalRunwayName, selectedArrivalTransitionApproachIds],
  );
  const activeCandidate = useMemo(
    () => (activeCandidateIndex !== null ? result?.candidates[activeCandidateIndex] ?? null : null),
    [activeCandidateIndex, result],
  );
  const displayedDepartureProcedureIds = useMemo(
    () =>
      isDepartureProcedureConfirmed && selectedDepartureProcedureId
        ? [selectedDepartureProcedureId]
        : availableDepartureProcedures.map((procedure) => procedure.id),
    [availableDepartureProcedures, isDepartureProcedureConfirmed, selectedDepartureProcedureId],
  );
  const displayedArrivalStarProcedureIds = useMemo(
    () =>
      isArrivalProcedureConfirmed && selectedArrivalProcedureId
        ? [selectedArrivalProcedureId]
        : availableArrivalStarProcedures.map((procedure) => procedure.id),
    [availableArrivalStarProcedures, isArrivalProcedureConfirmed, selectedArrivalProcedureId],
  );
  const displayedArrivalTransitionIds = useMemo(
    () =>
      isArrivalTransitionConfirmed && selectedArrivalTransitionId
        ? [selectedArrivalTransitionId]
        : availableArrivalTransitions.map((transition) => transition.id),
    [availableArrivalTransitions, isArrivalTransitionConfirmed, selectedArrivalTransitionId],
  );
  const displayedArrivalApproachProcedureIds = useMemo(
    () =>
      isArrivalApproachConfirmed && selectedApproachProcedureId
        ? [selectedApproachProcedureId]
        : availableArrivalApproachProcedures.map((procedure) => procedure.id),
    [availableArrivalApproachProcedures, isArrivalApproachConfirmed, selectedApproachProcedureId],
  );
  const selectedDepartureProcedure = useMemo(
    () => findProcedureSummaryById(availableDepartureProcedures, selectedDepartureProcedureId),
    [availableDepartureProcedures, selectedDepartureProcedureId],
  );
  const selectedArrivalProcedure = useMemo(
    () => findProcedureSummaryById(availableArrivalStarProcedures, selectedArrivalProcedureId),
    [availableArrivalStarProcedures, selectedArrivalProcedureId],
  );
  const selectedArrivalTransition = useMemo(
    () => findTransitionSummaryById(availableArrivalTransitions, selectedArrivalTransitionId),
    [availableArrivalTransitions, selectedArrivalTransitionId],
  );
  const selectedApproachProcedure = useMemo(
    () => findProcedureSummaryById(availableArrivalApproachProcedures, selectedApproachProcedureId),
    [availableArrivalApproachProcedures, selectedApproachProcedureId],
  );
  const selectedDepartureProcedureRunwayLabel = useMemo(
    () => resolveProcedureRunwayLabel(selectedDepartureProcedure) ?? selectedDepartureRunwayName,
    [selectedDepartureProcedure, selectedDepartureRunwayName],
  );
  const selectedArrivalProcedureRunwayLabel = useMemo(
    () => resolveProcedureRunwayLabel(selectedArrivalProcedure) ?? selectedArrivalRunwayName,
    [selectedArrivalProcedure, selectedArrivalRunwayName],
  );
  const selectedArrivalTransitionRunwayLabel = useMemo(
    () => normalizeRunwayName(selectedArrivalTransition?.runwayName) ?? selectedArrivalRunwayName,
    [selectedArrivalTransition, selectedArrivalRunwayName],
  );
  const selectedApproachProcedureRunwayLabel = useMemo(
    () => resolveProcedureRunwayLabel(selectedApproachProcedure) ?? selectedArrivalRunwayName,
    [selectedApproachProcedure, selectedArrivalRunwayName],
  );
  const activeApproachStatusText = useMemo(() => {
    if (selectedApproachProcedure && selectedArrivalRunwayName) {
      return `Approach locked for RWY ${selectedArrivalRunwayName}.`;
    }

    if (selectedArrivalTransition && selectedArrivalRunwayName) {
      return `Transition ${selectedArrivalTransition.name} is selected for RWY ${selectedArrivalRunwayName}. Choose an approach on the map next.`;
    }

    if (selectedArrivalProcedure && selectedArrivalRunwayName) {
      return `STAR ${selectedArrivalProcedure.name} is selected for RWY ${selectedArrivalRunwayName}. Choose a transition on the map next.`;
    }

    if (selectedArrivalRunwayName) {
      return `Choose a STAR first. Transition and approach selection for RWY ${selectedArrivalRunwayName} unlocks after a STAR is chosen.`;
    }

    return "Published approach candidates stay available, but exact approach selection moves to the runway-first arrival workflow.";
  }, [
    selectedApproachProcedure,
    selectedArrivalTransition,
    selectedArrivalProcedure,
    selectedArrivalRunwayName,
  ]);
  const activeApproachCountText = useMemo(() => {
    if (selectedArrivalRunwayName && selectedArrivalTransition) {
      return availableArrivalApproachProcedures.length > 0
        ? `${availableArrivalApproachProcedures.length} approach option(s) are available for RWY ${selectedArrivalRunwayName}.`
        : `No published approach candidates were resolved for RWY ${selectedArrivalRunwayName}.`;
    }

    if (selectedArrivalRunwayName && selectedArrivalProcedure) {
      return availableArrivalTransitions.length > 0
        ? `${availableArrivalTransitions.length} transition option(s) are available for RWY ${selectedArrivalRunwayName}.`
        : `No published transitions were resolved for RWY ${selectedArrivalRunwayName}.`;
    }

    return activeCandidate && activeCandidate.approaches.length > 0
      ? `${activeCandidate.approaches.length} published approach option(s) available after arrival runway selection.`
      : "No published approach candidates were resolved.";
  }, [
    activeCandidate,
    availableArrivalApproachProcedures.length,
    availableArrivalTransitions.length,
    selectedArrivalProcedure,
    selectedArrivalTransition,
    selectedArrivalRunwayName,
  ]);
  const currentWorkflowStageLabel = useMemo(() => {
    if (selectedApproachProcedure) {
      return isArrivalApproachConfirmed ? "Approach confirmed" : "Review and confirm approach";
    }

    if (selectedArrivalTransition) {
      return isArrivalTransitionConfirmed ? "Transition locked, choose approach" : "Review and confirm transition";
    }

    if (selectedArrivalProcedure) {
      return isArrivalProcedureConfirmed ? "STAR locked, choose transition" : "Review and confirm STAR";
    }

    if (selectedArrivalRunwayName) {
      return "Choose arrival STAR on the map";
    }

    if (selectedDepartureProcedure) {
      return isDepartureProcedureConfirmed ? "SID locked, choose arrival runway" : "Review and confirm SID";
    }

    if (selectedDepartureRunwayName) {
      return "Choose departure SID on the map";
    }

    if (activeCandidateIndex !== null) {
      return "Choose departure runway";
    }

    return "Select a candidate route";
  }, [
    activeCandidateIndex,
    isArrivalApproachConfirmed,
    isArrivalProcedureConfirmed,
    isArrivalTransitionConfirmed,
    isDepartureProcedureConfirmed,
    selectedApproachProcedure,
    selectedArrivalProcedure,
    selectedArrivalRunwayName,
    selectedArrivalTransition,
    selectedDepartureProcedure,
    selectedDepartureRunwayName,
  ]);
  const workflowSteps = useMemo(
    () => [
      {
        label: "Candidate",
        detail: activeCandidateIndex !== null ? `Candidate ${activeCandidateIndex + 1} is pinned on the map.` : "Choose one route option first.",
        isComplete: activeCandidateIndex !== null,
        isActive: activeCandidateIndex === null,
      },
      {
        label: "Departure",
        detail: selectedDepartureProcedure
          ? `${selectedDepartureProcedure.name}${isDepartureProcedureConfirmed ? " locked in." : " selected on the map."}`
          : selectedDepartureRunwayName
            ? `RWY ${selectedDepartureRunwayName} selected. Pick a SID next.`
            : "Choose departure runway, then pick a SID.",
        isComplete: Boolean(selectedDepartureProcedure),
        isActive: activeCandidateIndex !== null && !selectedDepartureProcedure,
      },
      {
        label: "Arrival",
        detail: selectedArrivalProcedure
          ? `${selectedArrivalProcedure.name}${isArrivalProcedureConfirmed ? " locked in." : " selected on the map."}`
          : selectedArrivalRunwayName
            ? `RWY ${selectedArrivalRunwayName} selected. Pick a STAR next.`
            : "Choose arrival runway, then pick a STAR.",
        isComplete: Boolean(selectedArrivalProcedure),
        isActive: Boolean(selectedDepartureProcedure) && !selectedArrivalProcedure,
      },
      {
        label: "Transition",
        detail: selectedArrivalTransition
          ? `${selectedArrivalTransition.name}${isArrivalTransitionConfirmed ? " locked in." : " selected on the map."}`
          : "Transition options unlock after STAR selection.",
        isComplete: Boolean(selectedArrivalTransition),
        isActive: Boolean(selectedArrivalProcedure) && !selectedArrivalTransition,
      },
      {
        label: "Approach",
        detail: selectedApproachProcedure
          ? `${selectedApproachProcedure.name}${isArrivalApproachConfirmed ? " locked in." : " selected on the map."}`
          : "Final approach unlocks after transition selection.",
        isComplete: Boolean(selectedApproachProcedure),
        isActive: Boolean(selectedArrivalTransition) && !selectedApproachProcedure,
      },
    ],
    [
      activeCandidateIndex,
      isArrivalApproachConfirmed,
      isArrivalProcedureConfirmed,
      isArrivalTransitionConfirmed,
      isDepartureProcedureConfirmed,
      selectedApproachProcedure,
      selectedArrivalProcedure,
      selectedArrivalRunwayName,
      selectedArrivalTransition,
      selectedDepartureProcedure,
      selectedDepartureRunwayName,
    ],
  );
  const selectionSnapshot = useMemo(
    () => [
      {
        label: "Departure runway",
        value: selectedDepartureRunwayName ? `RWY ${selectedDepartureRunwayName}` : "Pending",
        hint: selectedDepartureRunwayName ? "Runway-first departure setup" : "Choose after pinning a candidate",
        tone: "emerald" as const,
      },
      {
        label: "SID",
        value: formatSelectionWithRunway(selectedDepartureProcedure?.name, selectedDepartureProcedureRunwayLabel) ?? "Pending",
        hint: selectedDepartureProcedure
          ? isDepartureProcedureConfirmed
            ? "Confirmed and highlighted"
            : "Selected on the map"
          : "Map selection after runway choice",
        tone: "emerald" as const,
      },
      {
        label: "Arrival runway",
        value: selectedArrivalRunwayName ? `RWY ${selectedArrivalRunwayName}` : "Pending",
        hint: selectedArrivalRunwayName ? "Runway-first arrival setup" : "Choose after SID completion",
        tone: "amber" as const,
      },
      {
        label: "STAR",
        value: formatSelectionWithRunway(selectedArrivalProcedure?.name, selectedArrivalProcedureRunwayLabel) ?? "Pending",
        hint: selectedArrivalProcedure
          ? isArrivalProcedureConfirmed
            ? "Confirmed and highlighted"
            : "Selected on the map"
          : "Map selection after arrival runway",
        tone: "amber" as const,
      },
      {
        label: "Transition",
        value:
          formatSelectionWithRunway(selectedArrivalTransition?.name, selectedArrivalTransitionRunwayLabel) ?? "Pending",
        hint: selectedArrivalTransition
          ? isArrivalTransitionConfirmed
            ? "Confirmed and highlighted"
            : "Selected on the map"
          : "Available after STAR selection",
        tone: "orange" as const,
      },
      {
        label: "Approach",
        value: formatSelectionWithRunway(selectedApproachProcedure?.name, selectedApproachProcedureRunwayLabel) ?? "Pending",
        hint: selectedApproachProcedure
          ? isArrivalApproachConfirmed
            ? "Confirmed and highlighted"
            : "Selected on the map"
          : "Available after transition selection",
        tone: "fuchsia" as const,
      },
    ],
    [
      isArrivalApproachConfirmed,
      isArrivalProcedureConfirmed,
      isArrivalTransitionConfirmed,
      isDepartureProcedureConfirmed,
      selectedApproachProcedure?.name,
      selectedApproachProcedureRunwayLabel,
      selectedArrivalProcedure?.name,
      selectedArrivalProcedureRunwayLabel,
      selectedArrivalRunwayName,
      selectedArrivalTransition?.name,
      selectedArrivalTransitionRunwayLabel,
      selectedDepartureProcedure?.name,
      selectedDepartureProcedureRunwayLabel,
      selectedDepartureRunwayName,
    ],
  );
  const routePreviewSelection = useMemo<RoutePreviewSelection | null>(
    () =>
      activeCandidate
        ? {
            candidate: activeCandidate,
            departureProcedureId: selectedDepartureProcedureId,
            arrivalProcedureId: selectedArrivalProcedureId,
            arrivalTransitionId: selectedArrivalTransitionId,
            approachProcedureId: selectedApproachProcedureId,
          }
        : null,
    [
      activeCandidate,
      selectedApproachProcedureId,
      selectedArrivalTransitionId,
      selectedArrivalProcedureId,
      selectedDepartureProcedureId,
    ],
  );
  const planningOverlay = useMemo<RoutePlanningOverlay | null>(
    () =>
      activeCandidate && departurePlanningData && arrivalPlanningData
        ? {
            departureAirportIdent: departurePlanningData.airportIdent,
            arrivalAirportIdent: arrivalPlanningData.airportIdent,
            departureRunways: departurePlanningData.runways,
            arrivalRunways: arrivalPlanningData.runways,
            selectedDepartureRunwayName,
            selectedArrivalRunwayName,
            departure: selectedDepartureRunwayName
              ? {
                  airportIdent: departurePlanningData.airportIdent,
                  runwayName: selectedDepartureRunwayName,
                  procedures: availableDepartureProcedures,
                  displayedProcedureIds: displayedDepartureProcedureIds,
                  selectedProcedureId: selectedDepartureProcedureId,
                  displayedProcedures: [],
                }
              : null,
            arrivalStar: selectedArrivalRunwayName
              ? {
                  airportIdent: arrivalPlanningData.airportIdent,
                  runwayName: selectedArrivalRunwayName,
                  procedures: availableArrivalStarProcedures,
                  displayedProcedureIds: displayedArrivalStarProcedureIds,
                  selectedProcedureId: selectedArrivalProcedureId,
                  displayedProcedures: [],
                }
              : null,
            arrivalTransition: selectedArrivalRunwayName && selectedArrivalProcedureId
              ? {
                  airportIdent: arrivalPlanningData.airportIdent,
                  runwayName: selectedArrivalRunwayName,
                  transitions: availableArrivalTransitions,
                  displayedTransitionIds: displayedArrivalTransitionIds,
                  selectedTransitionId: selectedArrivalTransitionId,
                  displayedTransitions: [],
                }
              : null,
            arrivalApproach: selectedArrivalRunwayName && selectedArrivalTransitionId
              ? {
                  airportIdent: arrivalPlanningData.airportIdent,
                  runwayName: selectedArrivalRunwayName,
                  procedures: availableArrivalApproachProcedures,
                  displayedProcedureIds: displayedArrivalApproachProcedureIds,
                  selectedProcedureId: selectedApproachProcedureId,
                  displayedProcedures: [],
                }
              : null,
            activeStage: selectedArrivalTransitionId
              ? "arrival-approach"
              : selectedArrivalProcedureId
                ? "arrival-transition"
              : selectedArrivalRunwayName
                ? "arrival-star"
                : "departure",
          }
        : null,
    [
      activeCandidate,
      arrivalPlanningData,
      availableArrivalApproachProcedures,
      availableArrivalStarProcedures,
      availableArrivalTransitions,
      availableDepartureProcedures,
      departurePlanningData,
      displayedArrivalApproachProcedureIds,
      displayedArrivalStarProcedureIds,
      displayedArrivalTransitionIds,
      displayedDepartureProcedureIds,
      selectedApproachProcedureId,
      selectedArrivalTransitionId,
      selectedArrivalProcedureId,
      selectedArrivalRunwayName,
      selectedDepartureProcedureId,
      selectedDepartureRunwayName,
    ],
  );
  const emitRoutePreviewChange = useEffectEvent(
    (selection: RoutePreviewSelection | null, planning: RoutePlanningOverlay | null) => {
      onRoutePreviewChange?.(selection, planning);
    },
  );

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      planningAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    emitRoutePreviewChange(routePreviewSelection, planningOverlay);
  }, [
    planningOverlay,
    routePreviewSelection,
  ]);

  useEffect(() => {
    if (!activeCandidate || !result) {
      setDeparturePlanningData(null);
      setArrivalPlanningData(null);
      setSelectedDepartureRunwayName(null);
      setSelectedArrivalRunwayName(null);
      setSelectedArrivalTransitionId(null);
      setIsDepartureProcedureConfirmed(false);
      setIsArrivalProcedureConfirmed(false);
      setIsArrivalTransitionConfirmed(false);
      setIsArrivalApproachConfirmed(false);
      setPlanningError(null);
      planningAbortRef.current?.abort();
      return;
    }

    planningAbortRef.current?.abort();
    const controller = new AbortController();
    planningAbortRef.current = controller;
    setPlanningError(null);

    async function loadAirportPlanningData(airportIdent: string): Promise<AirportPlanningData> {
      const [proceduresResponse, transitionsResponse, runwayEnds] = await Promise.all([
        getAirportProcedures(airportIdent, { signal: controller.signal }),
        getAirportTransitions(airportIdent, { signal: controller.signal }),
        getAirportRunwayEnds(airportIdent, { signal: controller.signal }),
      ]);

      return {
        airportIdent: proceduresResponse.airport.ident,
        procedures: proceduresResponse.procedures,
        transitions: transitionsResponse.transitions,
        runways: runwayEnds,
      };
    }

    Promise.all([
      loadAirportPlanningData(result.departureAirport.ident),
      loadAirportPlanningData(result.arrivalAirport.ident),
    ])
      .then(([departureData, arrivalData]) => {
        if (controller.signal.aborted) {
          return;
        }

        setDeparturePlanningData(departureData);
        setArrivalPlanningData(arrivalData);
      })
      .catch((loadError) => {
        if (controller.signal.aborted) {
          return;
        }

        setDeparturePlanningData(null);
        setArrivalPlanningData(null);
        setPlanningError(loadError instanceof Error ? loadError.message : "Failed to load runway and procedure data");
      });

    return () => {
      controller.abort();
    };
  }, [activeCandidate, result]);

  useEffect(() => {
    if (selectedDepartureRunwayName && selectedDepartureProcedureId) {
      const stillAvailable = availableDepartureProcedures.some((procedure) => procedure.id === selectedDepartureProcedureId);
      if (!stillAvailable) {
        setSelectedDepartureProcedureId(null);
        setIsDepartureProcedureConfirmed(false);
      }
    }
  }, [availableDepartureProcedures, selectedDepartureProcedureId, selectedDepartureRunwayName]);

  useEffect(() => {
    if (selectedArrivalRunwayName && selectedArrivalProcedureId) {
      const stillAvailable = availableArrivalStarProcedures.some((procedure) => procedure.id === selectedArrivalProcedureId);
      if (!stillAvailable) {
        setSelectedArrivalProcedureId(null);
        setIsArrivalProcedureConfirmed(false);
      }
    }
  }, [availableArrivalStarProcedures, selectedArrivalProcedureId, selectedArrivalRunwayName]);

  useEffect(() => {
    if (!selectedArrivalProcedureId && selectedArrivalTransitionId) {
      setSelectedArrivalTransitionId(null);
      setIsArrivalTransitionConfirmed(false);
      setIsArrivalApproachConfirmed(false);
    }
  }, [selectedArrivalProcedureId, selectedArrivalTransitionId]);

  useEffect(() => {
    if (selectedArrivalRunwayName && selectedArrivalTransitionId) {
      const stillAvailable = availableArrivalTransitions.some((transition) => transition.id === selectedArrivalTransitionId);
      if (!stillAvailable) {
        setSelectedArrivalTransitionId(null);
        setIsArrivalTransitionConfirmed(false);
        setIsArrivalApproachConfirmed(false);
      }
    }
  }, [availableArrivalTransitions, selectedArrivalTransitionId, selectedArrivalRunwayName]);

  useEffect(() => {
    if (!selectedArrivalTransitionId && selectedApproachProcedureId) {
      setSelectedApproachProcedureId(null);
      setIsArrivalApproachConfirmed(false);
    }
  }, [selectedArrivalTransitionId, selectedApproachProcedureId]);

  useEffect(() => {
    if (selectedArrivalRunwayName && selectedApproachProcedureId) {
      const stillAvailable = availableArrivalApproachProcedures.some((procedure) => procedure.id === selectedApproachProcedureId);
      if (!stillAvailable) {
        setSelectedApproachProcedureId(null);
        setIsArrivalApproachConfirmed(false);
      }
    }
  }, [availableArrivalApproachProcedures, selectedApproachProcedureId, selectedArrivalRunwayName]);

  useEffect(() => {
    if (!planningSelection) {
      return;
    }

    if (planningSelection.kind === "transition") {
      if (availableArrivalTransitions.some((transition) => transition.id === planningSelection.id)) {
        setSelectedArrivalTransitionId(planningSelection.id);
        setIsArrivalTransitionConfirmed(false);
        setSelectedApproachProcedureId(null);
        setIsArrivalApproachConfirmed(false);
      }
      return;
    }

    if (availableDepartureProcedures.some((procedure) => procedure.id === planningSelection.id)) {
      setSelectedDepartureProcedureId(planningSelection.id);
      setIsDepartureProcedureConfirmed(false);
      return;
    }

    if (availableArrivalStarProcedures.some((procedure) => procedure.id === planningSelection.id)) {
      setSelectedArrivalProcedureId(planningSelection.id);
      setIsArrivalProcedureConfirmed(false);
      setSelectedArrivalTransitionId(null);
      setIsArrivalTransitionConfirmed(false);
      setSelectedApproachProcedureId(null);
      setIsArrivalApproachConfirmed(false);
      return;
    }

    if (availableArrivalApproachProcedures.some((procedure) => procedure.id === planningSelection.id)) {
      setSelectedApproachProcedureId(planningSelection.id);
      setIsArrivalApproachConfirmed(false);
    }
  }, [
    availableArrivalApproachProcedures,
    availableArrivalStarProcedures,
    availableArrivalTransitions,
    availableDepartureProcedures,
    planningSelection,
  ]);

  function activateCandidate(candidate: RoutePlanCandidate, index: number) {
    setActiveCandidateIndex(index);
    setSelectedDepartureProcedureId(null);
    setSelectedArrivalProcedureId(null);
    setSelectedArrivalTransitionId(null);
    setSelectedApproachProcedureId(null);
    setIsDepartureProcedureConfirmed(false);
    setIsArrivalProcedureConfirmed(false);
    setIsArrivalTransitionConfirmed(false);
    setIsArrivalApproachConfirmed(false);
    setSelectedDepartureRunwayName(null);
    setSelectedArrivalRunwayName(null);
    setPlanningError(null);
  }

  function clearDisplayedRoute() {
    setActiveCandidateIndex(null);
    setSelectedDepartureProcedureId(null);
    setSelectedArrivalProcedureId(null);
    setSelectedArrivalTransitionId(null);
    setSelectedApproachProcedureId(null);
    setIsDepartureProcedureConfirmed(false);
    setIsArrivalProcedureConfirmed(false);
    setIsArrivalTransitionConfirmed(false);
    setIsArrivalApproachConfirmed(false);
    setDeparturePlanningData(null);
    setArrivalPlanningData(null);
    setSelectedDepartureRunwayName(null);
    setSelectedArrivalRunwayName(null);
    setPlanningError(null);
    onRoutePreviewChange?.(null, null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedDeparture = departure.trim().toUpperCase();
    const normalizedArrival = arrival.trim().toUpperCase();
    const parsedCruiseAltitude = Number(cruiseAltitudeFt);
    const parsedLimit = Number(limit);

    if (!normalizedDeparture || !normalizedArrival) {
      setError("Departure and arrival airport identifiers are required.");
      setResult(null);
      onRoutePreviewChange?.(null, null);
      return;
    }

    if (!Number.isFinite(parsedCruiseAltitude) || parsedCruiseAltitude <= 0) {
      setError("Cruise altitude must be a positive number in feet.");
      setResult(null);
      onRoutePreviewChange?.(null, null);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);
    setActiveCandidateIndex(null);
    setSelectedDepartureProcedureId(null);
    setSelectedArrivalProcedureId(null);
    setSelectedArrivalTransitionId(null);
    setSelectedApproachProcedureId(null);
    setIsDepartureProcedureConfirmed(false);
    setIsArrivalProcedureConfirmed(false);
    setIsArrivalTransitionConfirmed(false);
    setIsArrivalApproachConfirmed(false);
    setDeparturePlanningData(null);
    setArrivalPlanningData(null);
    setSelectedDepartureRunwayName(null);
    setSelectedArrivalRunwayName(null);
    setPlanningError(null);
    onRoutePreviewChange?.(null, null);

    try {
      const response = await planRoute({
        departure: normalizedDeparture,
        arrival: normalizedArrival,
        cruiseAltitudeFt: parsedCruiseAltitude,
        limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 5,
        signal: controller.signal,
      });
      setResult(response);
    } catch (requestError) {
      if (controller.signal.aborted) {
        return;
      }

      setResult(null);
      setError(requestError instanceof Error ? requestError.message : "Failed to plan route");
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }

  return (
    <section className="grid gap-4">
      <div className="rounded-[24px] border border-slate-700/60 bg-slate-950/60 p-5 shadow-[0_24px_54px_rgba(2,8,23,0.24)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="section-kicker">Route Planner</p>
            <h1 className="hero-title mt-2 text-[1.7rem] leading-none sm:text-[2rem]">Route Desk</h1>
            <p className="support-copy mt-3 text-sm">
              Route planning stays first. After you pin one route, continue with runway-first SID, STAR, transition, and approach selection.
            </p>
            <p className="support-copy mt-2 text-sm">
              Workflow: select a route candidate, choose departure runway, pick a SID on the map, then choose arrival runway, STAR, transition, and approach in order.
            </p>
          </div>
          <div className="grid w-full gap-3 sm:w-auto sm:min-w-[230px]">
            <div className="status-tile">
              <div className="flex items-center justify-between gap-3">
                <p className="stat-label m-0">Workflow</p>
                <span className="rounded-full border border-cyan-300/25 bg-cyan-300/12 px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-cyan-50">
                  Live
                </span>
              </div>
              <p className="m-0 text-sm text-slate-100">{currentWorkflowStageLabel}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-5">
          {workflowSteps.map((step) => (
            <WorkflowStepCard
              key={step.label}
              label={step.label}
              detail={step.detail}
              isActive={step.isActive}
              isComplete={step.isComplete}
            />
          ))}
        </div>

        <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-3 xl:grid-cols-4">
            <label className="grid gap-2 xl:col-span-1">
              <span className="text-xs uppercase tracking-[0.26em] text-slate-400">Departure</span>
              <input
                value={departure}
                onChange={(event) => setDeparture(event.target.value)}
                placeholder="ZBAA"
                className="input-shell font-mono text-sm"
              />
            </label>

            <label className="grid gap-2 xl:col-span-1">
              <span className="text-xs uppercase tracking-[0.26em] text-slate-400">Arrival</span>
              <input
                value={arrival}
                onChange={(event) => setArrival(event.target.value)}
                placeholder="ZSPD"
                className="input-shell font-mono text-sm"
              />
            </label>

            <label className="grid gap-2 xl:col-span-1">
              <span className="text-xs uppercase tracking-[0.26em] text-slate-400">Cruise Alt</span>
              <input
                value={cruiseAltitudeFt}
                onChange={(event) => setCruiseAltitudeFt(event.target.value)}
                placeholder="36000"
                inputMode="numeric"
                className="input-shell font-mono text-sm"
              />
            </label>

            <label className="grid gap-2 xl:col-span-1">
              <span className="text-xs uppercase tracking-[0.26em] text-slate-400">Candidates</span>
              <input
                value={limit}
                onChange={(event) => setLimit(event.target.value)}
                placeholder="5"
                inputMode="numeric"
                className="input-shell font-mono text-sm"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isLoading}
              className="cursor-pointer rounded-2xl border border-sky-300/30 bg-sky-300/12 px-5 py-3 text-sm font-medium text-sky-100 transition duration-200 hover:border-sky-200/60 hover:bg-sky-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/35 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Planning..." : "Plan Route"}
            </button>

            <button
              type="button"
              onClick={clearDisplayedRoute}
              disabled={activeCandidateIndex === null}
              className="cursor-pointer rounded-2xl border border-slate-300/18 bg-slate-900/55 px-5 py-3 text-sm font-medium text-slate-200 transition duration-200 hover:border-slate-200/40 hover:bg-slate-900/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/25 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Clear displayed route
            </button>
          </div>
        </form>

        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
        {planningError ? <p className="mt-2 text-sm text-amber-200">{planningError}</p> : null}
      </div>

      {result ? (
        <>
          <div className="rounded-[22px] border border-slate-700/60 bg-slate-950/55 p-5 shadow-[0_18px_42px_rgba(2,8,23,0.2)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="section-kicker">Plan Summary</p>
                <h3 className="section-title mt-1 break-words text-[1.12rem]">
                  {result.departureAirport.ident} to {result.arrivalAirport.ident} at FL
                  {Math.round(result.cruiseAltitudeFt / 100)}
                </h3>
                {activeCandidateIndex !== null ? (
                  <p className="mt-2 text-sm text-cyan-200">
                    The selected route is pinned on the map and will stay there until you clear it.
                  </p>
                ) : null}
              </div>
              <div className="grid gap-1 text-left sm:text-right">
                <p className="m-0 text-[0.72rem] uppercase tracking-[0.28em] text-slate-500">Candidates</p>
                <p className="m-0 font-mono text-[1.1rem] text-slate-100">{result.candidates.length}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="status-tile">
                <p className="stat-label m-0">Active Route</p>
                <p className="m-0 text-sm text-slate-100">
                  {activeCandidateIndex !== null ? `Candidate ${activeCandidateIndex + 1}` : "No candidate pinned"}
                </p>
              </div>
              <div className="status-tile">
                <p className="stat-label m-0">Cruise</p>
                <p className="m-0 font-mono text-[1.02rem] text-slate-100">FL{Math.round(result.cruiseAltitudeFt / 100)}</p>
              </div>
              <div className="status-tile">
                <p className="stat-label m-0">Current Stage</p>
                <p className="m-0 text-sm text-slate-100">{currentWorkflowStageLabel}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              {result.notes.map((note) => (
                <p
                  key={note}
                  className="m-0 rounded-2xl border border-slate-700/60 bg-slate-900/60 px-4 py-3 text-sm text-slate-300"
                >
                  {note}
                </p>
              ))}
            </div>
          </div>

          <div className="rounded-[22px] border border-slate-700/60 bg-slate-950/55 p-5 shadow-[0_18px_42px_rgba(2,8,23,0.2)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="section-kicker">Selection Snapshot</p>
                <h3 className="section-title mt-1 text-[1.08rem]">Current route build state</h3>
                <p className="mt-2 text-sm text-slate-300">
                  Keep this panel in view while working through runway, procedure, transition, and approach choices.
                </p>
              </div>
              <div className="rounded-full border border-slate-300/18 bg-slate-300/8 px-3 py-1 text-[0.68rem] uppercase tracking-[0.2em] text-slate-300">
                {currentWorkflowStageLabel}
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {selectionSnapshot.map((item) => (
                <SelectionSnapshotField
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  hint={item.hint}
                  tone={item.tone}
                />
              ))}
            </div>
          </div>

          {activeCandidateIndex !== null ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <section className="rounded-[22px] border border-emerald-400/16 bg-emerald-400/6 p-5 shadow-[0_18px_42px_rgba(16,185,129,0.08)]">
                <p className="m-0 text-[0.72rem] uppercase tracking-[0.28em] text-emerald-200/80">Departure Setup</p>
                <p className="mt-2 text-sm text-slate-300">
                  Choose departure runway first. The map will then display all matching SID procedures with names; click a SID on the map to confirm it.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {departureRunwayOptions.map((runway) => (
                    <ProcedureChip
                      key={`${runway.runwayName}-${runway.headingDeg}`}
                      label={`RWY ${runway.runwayName}`}
                      isActive={selectedDepartureRunwayName === runway.runwayName}
                      onClick={() => {
                        setSelectedDepartureRunwayName(runway.runwayName);
                        setSelectedDepartureProcedureId(null);
                        setIsDepartureProcedureConfirmed(false);
                      }}
                    />
                  ))}
                </div>
                <p className="mt-4 text-sm text-slate-300">
                  {selectedDepartureRunwayName
                    ? `${availableDepartureProcedures.length} SID option(s) are available for RWY ${selectedDepartureRunwayName}.`
                    : "Select a departure runway to preview matching SID procedures on the map."}
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <SelectionSnapshotField
                    label="Runway"
                    value={selectedDepartureRunwayName ? `RWY ${selectedDepartureRunwayName}` : "Pending"}
                    hint={selectedDepartureRunwayName ? "Departure runway selected" : "Choose a runway to unlock SIDs"}
                    tone="emerald"
                  />
                  <SelectionSnapshotField
                    label="SID status"
                    value={selectedDepartureProcedure ? selectedDepartureProcedure.name : "Waiting for map pick"}
                    hint={
                      selectedDepartureProcedure
                        ? isDepartureProcedureConfirmed
                          ? "Confirmed and isolated on the map"
                          : "Selected on the map, confirm if needed"
                        : "Pick one SID from the displayed procedures"
                    }
                    tone="emerald"
                  />
                </div>
                {selectedDepartureProcedure ? (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <p className="text-sm text-emerald-100">
                      Selected SID: {selectedDepartureProcedure.name}
                      {selectedDepartureProcedureRunwayLabel ? ` / RWY ${selectedDepartureProcedureRunwayLabel}` : ""}
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsDepartureProcedureConfirmed((current) => !current)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        isDepartureProcedureConfirmed
                          ? "border-emerald-200/70 bg-emerald-300/20 text-emerald-50"
                          : "border-emerald-300/30 bg-emerald-300/10 text-emerald-100 hover:border-emerald-200/60 hover:bg-emerald-300/18"
                      }`}
                    >
                      {isDepartureProcedureConfirmed ? "SID confirmed" : "Confirm SID"}
                    </button>
                  </div>
                ) : null}
              </section>

              <section className="rounded-[22px] border border-amber-400/16 bg-amber-400/6 p-5 shadow-[0_18px_42px_rgba(245,158,11,0.08)]">
                <p className="m-0 text-[0.72rem] uppercase tracking-[0.28em] text-amber-200/80">Arrival Setup</p>
                <p className="mt-2 text-sm text-slate-300">
                  Choose arrival runway first. Then the map will display matching STAR procedures; after a STAR is chosen, matching transitions will appear; after a transition is chosen, approach procedures for that runway will be available.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {arrivalRunwayOptions.map((runway) => (
                    <ProcedureChip
                      key={`${runway.runwayName}-${runway.headingDeg}`}
                      label={`RWY ${runway.runwayName}`}
                      isActive={selectedArrivalRunwayName === runway.runwayName}
                      onClick={() => {
                        setSelectedArrivalRunwayName(runway.runwayName);
                        setSelectedArrivalProcedureId(null);
                        setIsArrivalProcedureConfirmed(false);
                        setSelectedArrivalTransitionId(null);
                        setIsArrivalTransitionConfirmed(false);
                        setSelectedApproachProcedureId(null);
                        setIsArrivalApproachConfirmed(false);
                      }}
                    />
                  ))}
                </div>
                <p className="mt-4 text-sm text-slate-300">
                  {selectedArrivalRunwayName
                    ? `${availableArrivalStarProcedures.length} STAR option(s), ${availableArrivalTransitions.length} transition option(s), and ${availableArrivalApproachProcedures.length} approach option(s) are available for RWY ${selectedArrivalRunwayName}.`
                    : "Select an arrival runway to preview matching STAR procedures on the map."}
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <SelectionSnapshotField
                    label="Runway"
                    value={selectedArrivalRunwayName ? `RWY ${selectedArrivalRunwayName}` : "Pending"}
                    hint={selectedArrivalRunwayName ? "Arrival runway selected" : "Choose a runway to unlock STARs"}
                    tone="amber"
                  />
                  <SelectionSnapshotField
                    label="STAR"
                    value={selectedArrivalProcedure ? selectedArrivalProcedure.name : "Pending"}
                    hint={
                      selectedArrivalProcedure
                        ? isArrivalProcedureConfirmed
                          ? "Confirmed and isolated on the map"
                          : "Selected on the map"
                        : "Choose after runway selection"
                    }
                    tone="amber"
                  />
                  <SelectionSnapshotField
                    label="Transition"
                    value={selectedArrivalTransition ? selectedArrivalTransition.name : "Pending"}
                    hint={
                      selectedArrivalTransition
                        ? isArrivalTransitionConfirmed
                          ? "Confirmed and isolated on the map"
                          : "Selected on the map"
                        : "Unlocks after STAR selection"
                    }
                    tone="orange"
                  />
                  <SelectionSnapshotField
                    label="Approach"
                    value={selectedApproachProcedure ? selectedApproachProcedure.name : "Pending"}
                    hint={
                      selectedApproachProcedure
                        ? isArrivalApproachConfirmed
                          ? "Confirmed and isolated on the map"
                          : "Selected on the map"
                        : "Unlocks after transition selection"
                    }
                    tone="fuchsia"
                  />
                </div>
                {selectedArrivalProcedure ? (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <p className="text-sm text-amber-100">
                      Selected STAR: {selectedArrivalProcedure.name}
                      {selectedArrivalProcedureRunwayLabel ? ` / RWY ${selectedArrivalProcedureRunwayLabel}` : ""}
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsArrivalProcedureConfirmed((current) => !current)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        isArrivalProcedureConfirmed
                          ? "border-amber-200/70 bg-amber-300/20 text-amber-50"
                          : "border-amber-300/30 bg-amber-300/10 text-amber-100 hover:border-amber-200/60 hover:bg-amber-300/18"
                      }`}
                    >
                      {isArrivalProcedureConfirmed ? "STAR confirmed" : "Confirm STAR"}
                    </button>
                  </div>
                ) : null}
                {selectedArrivalTransition ? (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <p className="text-sm text-orange-100">
                      Selected transition: {selectedArrivalTransition.name}
                      {selectedArrivalTransitionRunwayLabel ? ` / RWY ${selectedArrivalTransitionRunwayLabel}` : ""}
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsArrivalTransitionConfirmed((current) => !current)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        isArrivalTransitionConfirmed
                          ? "border-orange-200/70 bg-orange-300/20 text-orange-50"
                          : "border-orange-300/30 bg-orange-300/10 text-orange-100 hover:border-orange-200/60 hover:bg-orange-300/18"
                      }`}
                    >
                      {isArrivalTransitionConfirmed ? "Transition confirmed" : "Confirm transition"}
                    </button>
                  </div>
                ) : null}
                {selectedApproachProcedure ? (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <p className="text-sm text-fuchsia-100">
                      Selected approach: {selectedApproachProcedure.name}
                      {selectedApproachProcedureRunwayLabel ? ` / RWY ${selectedApproachProcedureRunwayLabel}` : ""}
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsArrivalApproachConfirmed((current) => !current)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        isArrivalApproachConfirmed
                          ? "border-fuchsia-200/70 bg-fuchsia-300/20 text-fuchsia-50"
                          : "border-fuchsia-300/30 bg-fuchsia-300/10 text-fuchsia-100 hover:border-fuchsia-200/60 hover:bg-fuchsia-300/18"
                      }`}
                    >
                      {isArrivalApproachConfirmed ? "Approach confirmed" : "Confirm approach"}
                    </button>
                  </div>
                ) : null}
              </section>
            </div>
          ) : null}

          {result.candidates.length > 0 ? (
            <div className="rounded-[22px] border border-slate-700/60 bg-slate-950/55 p-5 shadow-[0_18px_42px_rgba(2,8,23,0.2)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="section-kicker">Route Candidates</p>
                  <h3 className="section-title mt-1 text-[1.08rem]">Pick the route backbone before procedure work</h3>
                  <p className="mt-2 text-sm text-slate-300">
                    Candidate cards keep the airway backbone readable while the live setup panels above handle runway-first SID, STAR, transition, and approach decisions.
                  </p>
                </div>
                <div className="rounded-full border border-slate-300/18 bg-slate-300/8 px-3 py-1 text-[0.68rem] uppercase tracking-[0.2em] text-slate-300">
                  {result.candidates.length} option(s)
                </div>
              </div>

              <div className="scroll-panel mt-4 grid max-h-[56rem] gap-4 overflow-y-auto pr-1">
                {result.candidates.map((candidate, index) => (
                  <CandidateCard
                    key={`${candidate.departure.ident}-${candidate.arrival.ident}-${index}`}
                    candidate={candidate}
                    index={index}
                    isActive={activeCandidateIndex === index}
                    departureSelectionLabel={
                      activeCandidateIndex === index && selectedDepartureProcedure
                        ? `${selectedDepartureProcedure.name}${selectedDepartureProcedureRunwayLabel ? ` / RWY ${selectedDepartureProcedureRunwayLabel}` : ""}`
                        : null
                    }
                    arrivalSelectionLabel={
                      activeCandidateIndex === index && selectedArrivalProcedure
                        ? `${selectedArrivalProcedure.name}${selectedArrivalProcedureRunwayLabel ? ` / RWY ${selectedArrivalProcedureRunwayLabel}` : ""}`
                        : null
                    }
                    transitionSelectionLabel={
                      activeCandidateIndex === index && selectedArrivalTransition
                        ? `${selectedArrivalTransition.name}${selectedArrivalTransitionRunwayLabel ? ` / RWY ${selectedArrivalTransitionRunwayLabel}` : ""}`
                        : null
                    }
                    approachSelectionLabel={
                      activeCandidateIndex === index && selectedApproachProcedure
                        ? `${selectedApproachProcedure.name}${selectedApproachProcedureRunwayLabel ? ` / RWY ${selectedApproachProcedureRunwayLabel}` : ""}`
                        : null
                    }
                    approachStatusText={activeCandidateIndex === index ? activeApproachStatusText : null}
                    approachCountText={activeCandidateIndex === index ? activeApproachCountText : null}
                    onActivate={() => {
                      if (activeCandidateIndex !== index) {
                        activateCandidate(candidate, index);
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-[22px] border border-slate-700/60 bg-slate-950/55 p-5">
              <p className="m-0 text-sm text-slate-300">
                No airway-connected candidate was found for the current altitude and procedure-point combination.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-[22px] border border-slate-700/60 bg-slate-950/55 p-5">
          <p className="m-0 text-sm text-slate-300">
            Results are shown in this order: departure airport, SID options, SID exit point,
            airway path, STAR entry point, STAR options, approach options, arrival airport.
          </p>
        </div>
      )}
    </section>
  );
}
