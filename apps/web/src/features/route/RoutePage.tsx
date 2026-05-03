import { useEffect, useEffectEvent, useMemo, useRef, useState, type FormEvent } from "react";
import type { RoutePlanningOverlay, RoutePreviewSelection } from "../app/types";
import { getAirportProcedures, getAirportRunwayEnds, planRoute } from "../../lib/api";
import type {
  AirportRunwayEnd,
  ProcedureSummary,
  RouteAirwaySegment,
  RoutePlanCandidate,
  RoutePlanResponse,
  RouteProcedureOption,
} from "../../types/api";

type RoutePageProps = {
  onRoutePreviewChange?: (selection: RoutePreviewSelection | null, planning?: RoutePlanningOverlay | null) => void;
  planningProcedureSelectionId?: number | null;
};

type CandidateCardProps = {
  candidate: RoutePlanCandidate;
  index: number;
  isActive: boolean;
  onActivate: () => void;
};

type AirportPlanningData = {
  airportIdent: string;
  procedures: ProcedureSummary[];
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

  const sequence = [segments[0].fromIdent];
  for (const segment of segments) {
    sequence.push(segment.airwayName);
    sequence.push(segment.toIdent);
  }

  return sequence.join(" ");
}

function defaultProcedureId(procedures: RouteProcedureOption[]) {
  return procedures[0]?.procedureId ?? null;
}

function normalizeRunwayName(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase();
  return normalized ? normalized : null;
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

  return procedures.filter((procedure) => normalizeRunwayName(procedure.runwayName) === normalizedRunwayName);
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
      className={`rounded-full border px-3 py-1 text-xs transition ${
        isActive
          ? "border-slate-100/80 bg-slate-100/20 text-slate-50"
          : "border-slate-300/18 bg-slate-300/8 text-slate-200 hover:border-slate-200/40 hover:bg-slate-200/12"
      }`}
    >
      {label}
    </button>
  );
}

function CandidateCard({
  candidate,
  index,
  isActive,
  onActivate,
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
          <p className="section-kicker">Candidate {index + 1}</p>
          <h3 className="section-title mt-1 break-words text-[1.15rem]">{formatAirwaySequence(candidate.airways)}</h3>
          <p className="mt-2 text-sm text-slate-300">
            Select this candidate first. Then choose departure runway and SID, followed by arrival runway, STAR, and approach.
          </p>
        </div>
        <div className="grid w-full gap-3 text-left sm:w-auto sm:min-w-[180px] sm:text-right">
          <div>
            <p className="m-0 text-[0.72rem] uppercase tracking-[0.28em] text-slate-500">Total</p>
            <p className="m-0 font-mono text-[1.1rem] text-slate-100">
              {formatDistance(candidate.totalDistanceNm)}
            </p>
          </div>
          <div>
            <p className="m-0 text-[0.72rem] uppercase tracking-[0.28em] text-slate-500">Airway</p>
            <p className="m-0 font-mono text-sm text-slate-300">
              {formatDistance(candidate.airwayDistanceNm)}
            </p>
          </div>
          <button
            type="button"
            onClick={onActivate}
            className={`rounded-2xl border px-4 py-2 text-sm font-medium transition ${
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
          <p className="mt-1 text-sm text-slate-300">
            SID shortest path {formatDistance(candidate.departure.minimumProcedureDistanceNm)}. Detailed runway and SID selection starts after this route is displayed.
          </p>
        </section>

        <section className="rounded-[20px] border border-sky-400/16 bg-sky-400/6 p-4">
          <p className="m-0 text-[0.72rem] uppercase tracking-[0.28em] text-sky-200/80">Airway</p>
          <div className="mt-2 grid gap-2">
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
          <p className="mt-1 text-sm text-slate-300">
            STAR shortest path {formatDistance(candidate.arrival.minimumProcedureDistanceNm)}. Arrival runway, STAR, and approach are selected after this route is displayed.
          </p>
        </section>
      </div>

      <section className="mt-4 rounded-[20px] border border-fuchsia-400/16 bg-fuchsia-400/6 p-4">
        <p className="m-0 text-[0.72rem] uppercase tracking-[0.28em] text-fuchsia-200/80">Approach</p>
        <p className="mt-2 text-sm text-slate-300">
          Published approach candidates stay available, but exact approach selection moves to the runway-first arrival workflow.
        </p>
        <p className="mt-3 text-sm text-slate-400">
          {candidate.approaches.length > 0
            ? `${candidate.approaches.length} published approach option(s) available after arrival runway selection.`
            : "No published approach candidates were resolved."}
        </p>
      </section>
    </article>
  );
}

export function RoutePage({ onRoutePreviewChange, planningProcedureSelectionId }: RoutePageProps) {
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
  const [selectedApproachProcedureId, setSelectedApproachProcedureId] = useState<number | null>(null);
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
  const availableArrivalApproachProcedures = useMemo(
    () =>
      arrivalPlanningData
        ? filterProceduresByRunway(
            proceduresForKind(arrivalPlanningData.procedures, "approach"),
            selectedArrivalRunwayName,
          )
        : [],
    [arrivalPlanningData, selectedArrivalRunwayName],
  );
  const activeCandidate = useMemo(
    () => (activeCandidateIndex !== null ? result?.candidates[activeCandidateIndex] ?? null : null),
    [activeCandidateIndex, result],
  );
  const displayedDepartureProcedureIds = useMemo(
    () => availableDepartureProcedures.map((procedure) => procedure.id),
    [availableDepartureProcedures],
  );
  const displayedArrivalStarProcedureIds = useMemo(
    () => availableArrivalStarProcedures.map((procedure) => procedure.id),
    [availableArrivalStarProcedures],
  );
  const displayedArrivalApproachProcedureIds = useMemo(
    () => availableArrivalApproachProcedures.map((procedure) => procedure.id),
    [availableArrivalApproachProcedures],
  );
  const routePreviewSelection = useMemo<RoutePreviewSelection | null>(
    () =>
      activeCandidate
        ? {
            candidate: activeCandidate,
            departureProcedureId: selectedDepartureProcedureId,
            arrivalProcedureId: selectedArrivalProcedureId,
            approachProcedureId: selectedApproachProcedureId,
          }
        : null,
    [
      activeCandidate,
      selectedApproachProcedureId,
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
            arrivalApproach: selectedArrivalRunwayName && selectedArrivalProcedureId
              ? {
                  airportIdent: arrivalPlanningData.airportIdent,
                  runwayName: selectedArrivalRunwayName,
                  procedures: availableArrivalApproachProcedures,
                  displayedProcedureIds: displayedArrivalApproachProcedureIds,
                  selectedProcedureId: selectedApproachProcedureId,
                  displayedProcedures: [],
                }
              : null,
            activeStage: selectedArrivalProcedureId
              ? "arrival-approach"
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
      availableDepartureProcedures,
      departurePlanningData,
      displayedArrivalApproachProcedureIds,
      displayedArrivalStarProcedureIds,
      displayedDepartureProcedureIds,
      selectedApproachProcedureId,
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
      setPlanningError(null);
      planningAbortRef.current?.abort();
      return;
    }

    planningAbortRef.current?.abort();
    const controller = new AbortController();
    planningAbortRef.current = controller;
    setPlanningError(null);

    async function loadAirportPlanningData(airportIdent: string): Promise<AirportPlanningData> {
      const [proceduresResponse, runwayEnds] = await Promise.all([
        getAirportProcedures(airportIdent, { signal: controller.signal }),
        getAirportRunwayEnds(airportIdent, { signal: controller.signal }),
      ]);

      return {
        airportIdent: proceduresResponse.airport.ident,
        procedures: proceduresResponse.procedures,
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
      }
    }
  }, [availableDepartureProcedures, selectedDepartureProcedureId, selectedDepartureRunwayName]);

  useEffect(() => {
    if (selectedArrivalRunwayName && selectedArrivalProcedureId) {
      const stillAvailable = availableArrivalStarProcedures.some((procedure) => procedure.id === selectedArrivalProcedureId);
      if (!stillAvailable) {
        setSelectedArrivalProcedureId(null);
      }
    }
  }, [availableArrivalStarProcedures, selectedArrivalProcedureId, selectedArrivalRunwayName]);

  useEffect(() => {
    if (selectedArrivalRunwayName && selectedApproachProcedureId) {
      const stillAvailable = availableArrivalApproachProcedures.some((procedure) => procedure.id === selectedApproachProcedureId);
      if (!stillAvailable) {
        setSelectedApproachProcedureId(null);
      }
    }
  }, [availableArrivalApproachProcedures, selectedApproachProcedureId, selectedArrivalRunwayName]);

  useEffect(() => {
    if (!planningProcedureSelectionId) {
      return;
    }

    if (availableDepartureProcedures.some((procedure) => procedure.id === planningProcedureSelectionId)) {
      setSelectedDepartureProcedureId(planningProcedureSelectionId);
      return;
    }

    if (availableArrivalStarProcedures.some((procedure) => procedure.id === planningProcedureSelectionId)) {
      setSelectedArrivalProcedureId(planningProcedureSelectionId);
      return;
    }

    if (availableArrivalApproachProcedures.some((procedure) => procedure.id === planningProcedureSelectionId)) {
      setSelectedApproachProcedureId(planningProcedureSelectionId);
    }
  }, [
    availableArrivalApproachProcedures,
    availableArrivalStarProcedures,
    availableDepartureProcedures,
    planningProcedureSelectionId,
  ]);

  function activateCandidate(candidate: RoutePlanCandidate, index: number) {
    setActiveCandidateIndex(index);
    setSelectedDepartureProcedureId(null);
    setSelectedArrivalProcedureId(null);
    setSelectedApproachProcedureId(null);
    setSelectedDepartureRunwayName(null);
    setSelectedArrivalRunwayName(null);
    setPlanningError(null);
  }

  function clearDisplayedRoute() {
    setActiveCandidateIndex(null);
    setSelectedDepartureProcedureId(null);
    setSelectedArrivalProcedureId(null);
    setSelectedApproachProcedureId(null);
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
    setSelectedApproachProcedureId(null);
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
      <div className="rounded-[24px] border border-slate-700/60 bg-slate-950/60 p-5">
        <p className="section-kicker">Route Planner</p>
        <h1 className="hero-title mt-2 text-[1.7rem] leading-none sm:text-[2rem]">Route Desk</h1>
        <p className="support-copy mt-3 text-sm">
          Route planning stays first. After you pin one route, continue with runway-first SID, STAR, and approach selection.
        </p>
        <p className="support-copy mt-2 text-sm">
          Workflow: select a route candidate, choose departure runway, pick a SID on the map, then choose arrival runway, STAR, and approach in order.
        </p>

        <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.26em] text-slate-400">Departure</span>
              <input
                value={departure}
                onChange={(event) => setDeparture(event.target.value)}
                placeholder="ZBAA"
                className="rounded-2xl border border-slate-700/70 bg-slate-950/75 px-4 py-3 font-mono text-sm text-slate-100 outline-none transition focus:border-sky-300/60"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.26em] text-slate-400">Arrival</span>
              <input
                value={arrival}
                onChange={(event) => setArrival(event.target.value)}
                placeholder="ZSPD"
                className="rounded-2xl border border-slate-700/70 bg-slate-950/75 px-4 py-3 font-mono text-sm text-slate-100 outline-none transition focus:border-sky-300/60"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.26em] text-slate-400">Cruise Alt</span>
              <input
                value={cruiseAltitudeFt}
                onChange={(event) => setCruiseAltitudeFt(event.target.value)}
                placeholder="36000"
                inputMode="numeric"
                className="rounded-2xl border border-slate-700/70 bg-slate-950/75 px-4 py-3 font-mono text-sm text-slate-100 outline-none transition focus:border-sky-300/60"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.26em] text-slate-400">Candidates</span>
              <input
                value={limit}
                onChange={(event) => setLimit(event.target.value)}
                placeholder="5"
                inputMode="numeric"
                className="rounded-2xl border border-slate-700/70 bg-slate-950/75 px-4 py-3 font-mono text-sm text-slate-100 outline-none transition focus:border-sky-300/60"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-2xl border border-sky-300/30 bg-sky-300/12 px-5 py-3 text-sm font-medium text-sky-100 transition hover:border-sky-200/60 hover:bg-sky-300/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Planning..." : "Plan Route"}
            </button>

            <button
              type="button"
              onClick={clearDisplayedRoute}
              disabled={activeCandidateIndex === null}
              className="rounded-2xl border border-slate-300/18 bg-slate-900/55 px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-200/40 hover:bg-slate-900/80 disabled:cursor-not-allowed disabled:opacity-45"
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
          <div className="rounded-[22px] border border-slate-700/60 bg-slate-950/55 p-5">
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

          {activeCandidateIndex !== null ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <section className="rounded-[22px] border border-emerald-400/16 bg-emerald-400/6 p-5">
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
                      }}
                    />
                  ))}
                </div>
                <p className="mt-4 text-sm text-slate-300">
                  {selectedDepartureRunwayName
                    ? `${availableDepartureProcedures.length} SID option(s) are available for RWY ${selectedDepartureRunwayName}.`
                    : "Select a departure runway to preview matching SID procedures on the map."}
                </p>
              </section>

              <section className="rounded-[22px] border border-amber-400/16 bg-amber-400/6 p-5">
                <p className="m-0 text-[0.72rem] uppercase tracking-[0.28em] text-amber-200/80">Arrival Setup</p>
                <p className="mt-2 text-sm text-slate-300">
                  Choose arrival runway first. Then the map will display matching STAR procedures; after a STAR is chosen, approach procedures for that runway will also be available.
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
                        setSelectedApproachProcedureId(null);
                      }}
                    />
                  ))}
                </div>
                <p className="mt-4 text-sm text-slate-300">
                  {selectedArrivalRunwayName
                    ? `${availableArrivalStarProcedures.length} STAR option(s) and ${availableArrivalApproachProcedures.length} approach option(s) are available for RWY ${selectedArrivalRunwayName}.`
                    : "Select an arrival runway to preview matching STAR procedures on the map."}
                </p>
              </section>
            </div>
          ) : null}

          {result.candidates.length > 0 ? (
            result.candidates.map((candidate, index) => (
              <CandidateCard
                key={`${candidate.departure.ident}-${candidate.arrival.ident}-${index}`}
                candidate={candidate}
                index={index}
                isActive={activeCandidateIndex === index}
                onActivate={() => {
                  if (activeCandidateIndex !== index) {
                    activateCandidate(candidate, index);
                  }
                }}
              />
            ))
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
