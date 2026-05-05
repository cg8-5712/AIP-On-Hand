import { useEffect, useEffectEvent, useMemo, useRef, useState, type FormEvent } from "react";
import { getAirportProcedures, getAirportRunwayEnds, getAirportTransitions, planRoute } from "../../lib/api";
import type { RoutePageProps, SelectionSnapshotItem, WorkflowStep } from "./RoutePage.types";
import { type AirportPlanningData } from "./RoutePage.types";
import type { RoutePlanningOverlay, RoutePreviewSelection } from "../app/types";
import {
  filterApproachesByRunwayAndTransition,
  filterProceduresByRouteOptions,
  filterProceduresByRunway,
  filterTransitionsByRunway,
  findProcedureSummaryById,
  findTransitionSummaryById,
  formatSelectionWithRunway,
  groupTransitions,
  normalizeRunwayName,
  proceduresForKind,
  resolveProcedureRunwayLabel,
  sortRunwaysForOperation,
} from "./routePlanning";

export function useRoutePlannerState({ onRoutePreviewChange, planningSelection }: RoutePageProps) {
  const [departure, setDeparture] = useState("");
  const [arrival, setArrival] = useState("");
  const [cruiseAltitudeFt, setCruiseAltitudeFt] = useState("36000");
  const [limit, setLimit] = useState("5");
  const [result, setResult] = useState<Awaited<ReturnType<typeof planRoute>> | null>(null);
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
  const activeCandidate = useMemo(
    () => (activeCandidateIndex !== null ? result?.candidates[activeCandidateIndex] ?? null : null),
    [activeCandidateIndex, result],
  );
  const availableDepartureProcedures = useMemo(
    () =>
      departurePlanningData && activeCandidate
        ? filterProceduresByRouteOptions(
            filterProceduresByRunway(
              proceduresForKind(departurePlanningData.procedures, "sid"),
              selectedDepartureRunwayName,
            ),
            activeCandidate.departure.procedures,
          )
        : [],
    [activeCandidate, departurePlanningData, selectedDepartureRunwayName],
  );
  const availableArrivalStarProcedures = useMemo(
    () =>
      arrivalPlanningData && activeCandidate
        ? filterProceduresByRouteOptions(
            filterProceduresByRunway(
              proceduresForKind(arrivalPlanningData.procedures, "star"),
              selectedArrivalRunwayName,
            ),
            activeCandidate.arrival.procedures,
          )
        : [],
    [activeCandidate, arrivalPlanningData, selectedArrivalRunwayName],
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
  const selectedDepartureProcedureDisplay = useMemo(
    () => formatSelectionWithRunway(selectedDepartureProcedure?.name, selectedDepartureProcedureRunwayLabel),
    [selectedDepartureProcedure?.name, selectedDepartureProcedureRunwayLabel],
  );
  const selectedArrivalProcedureDisplay = useMemo(
    () => formatSelectionWithRunway(selectedArrivalProcedure?.name, selectedArrivalProcedureRunwayLabel),
    [selectedArrivalProcedure?.name, selectedArrivalProcedureRunwayLabel],
  );
  const selectedArrivalTransitionDisplay = useMemo(
    () => formatSelectionWithRunway(selectedArrivalTransition?.name, selectedArrivalTransitionRunwayLabel),
    [selectedArrivalTransition?.name, selectedArrivalTransitionRunwayLabel],
  );
  const selectedApproachProcedureDisplay = useMemo(
    () => formatSelectionWithRunway(selectedApproachProcedure?.name, selectedApproachProcedureRunwayLabel),
    [selectedApproachProcedure?.name, selectedApproachProcedureRunwayLabel],
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
    selectedArrivalProcedure,
    selectedArrivalRunwayName,
    selectedArrivalTransition,
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
    selectedArrivalRunwayName,
    selectedArrivalTransition,
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
  const workflowSteps = useMemo<WorkflowStep[]>(
    () => [
      {
        step: "01",
        label: "Candidate",
        detail: activeCandidateIndex !== null ? `Candidate ${activeCandidateIndex + 1} pinned.` : "Choose one route option.",
        isComplete: activeCandidateIndex !== null,
        isActive: activeCandidateIndex === null,
      },
      {
        step: "02",
        label: "Departure",
        detail: selectedDepartureProcedure
          ? `${selectedDepartureProcedure.name}${isDepartureProcedureConfirmed ? " locked." : " selected."}`
          : selectedDepartureRunwayName
            ? `RWY ${selectedDepartureRunwayName} selected. Pick a SID.`
            : "Choose departure runway, then SID.",
        isComplete: Boolean(selectedDepartureProcedure),
        isActive: activeCandidateIndex !== null && !selectedDepartureProcedure,
      },
      {
        step: "03",
        label: "Arrival",
        detail: selectedArrivalProcedure
          ? `${selectedArrivalProcedure.name}${isArrivalProcedureConfirmed ? " locked." : " selected."}`
          : selectedArrivalRunwayName
            ? `RWY ${selectedArrivalRunwayName} selected. Pick a STAR.`
            : "Choose arrival runway, then STAR.",
        isComplete: Boolean(selectedArrivalProcedure),
        isActive: Boolean(selectedDepartureProcedure) && !selectedArrivalProcedure,
      },
      {
        step: "04",
        label: "Transition",
        detail: selectedArrivalTransition
          ? `${selectedArrivalTransition.name}${isArrivalTransitionConfirmed ? " locked." : " selected."}`
          : "Unlocks after STAR.",
        isComplete: Boolean(selectedArrivalTransition),
        isActive: Boolean(selectedArrivalProcedure) && !selectedArrivalTransition,
      },
      {
        step: "05",
        label: "Approach",
        detail: selectedApproachProcedure
          ? `${selectedApproachProcedure.name}${isArrivalApproachConfirmed ? " locked." : " selected."}`
          : "Unlocks after transition.",
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
  const currentFocusDetail = useMemo(
    () =>
      workflowSteps.find((step) => step.isActive)?.detail ??
      [...workflowSteps].reverse().find((step) => step.isComplete)?.detail ??
      "Select a candidate route to begin.",
    [workflowSteps],
  );
  const selectionSnapshot = useMemo<SelectionSnapshotItem[]>(
    () => [
      {
        label: "Departure runway",
        value: selectedDepartureRunwayName ? `RWY ${selectedDepartureRunwayName}` : "Pending",
        hint: selectedDepartureRunwayName ? "Runway-first departure setup" : "Choose after pinning a candidate",
        tone: "emerald",
      },
      {
        label: "SID",
        value: selectedDepartureProcedureDisplay ?? "Pending",
        hint: selectedDepartureProcedure
          ? isDepartureProcedureConfirmed
            ? "Confirmed and highlighted"
            : "Selected on the map"
          : "Map selection after runway choice",
        tone: "emerald",
      },
      {
        label: "Arrival runway",
        value: selectedArrivalRunwayName ? `RWY ${selectedArrivalRunwayName}` : "Pending",
        hint: selectedArrivalRunwayName ? "Runway-first arrival setup" : "Choose after SID completion",
        tone: "amber",
      },
      {
        label: "STAR",
        value: selectedArrivalProcedureDisplay ?? "Pending",
        hint: selectedArrivalProcedure
          ? isArrivalProcedureConfirmed
            ? "Confirmed and highlighted"
            : "Selected on the map"
          : "Map selection after arrival runway",
        tone: "amber",
      },
      {
        label: "Transition",
        value: selectedArrivalTransitionDisplay ?? "Pending",
        hint: selectedArrivalTransition
          ? isArrivalTransitionConfirmed
            ? "Confirmed and highlighted"
            : "Selected on the map"
          : "Available after STAR selection",
        tone: "orange",
      },
      {
        label: "Approach",
        value: selectedApproachProcedureDisplay ?? "Pending",
        hint: selectedApproachProcedure
          ? isArrivalApproachConfirmed
            ? "Confirmed and highlighted"
            : "Selected on the map"
          : "Available after transition selection",
        tone: "fuchsia",
      },
    ],
    [
      isArrivalApproachConfirmed,
      isArrivalProcedureConfirmed,
      isArrivalTransitionConfirmed,
      isDepartureProcedureConfirmed,
      selectedApproachProcedure,
      selectedApproachProcedureDisplay,
      selectedArrivalProcedure,
      selectedArrivalProcedureDisplay,
      selectedArrivalRunwayName,
      selectedArrivalTransition,
      selectedArrivalTransitionDisplay,
      selectedDepartureProcedure,
      selectedDepartureProcedureDisplay,
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
      selectedArrivalProcedureId,
      selectedArrivalTransitionId,
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
      selectedArrivalProcedureId,
      selectedArrivalRunwayName,
      selectedArrivalTransitionId,
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
  }, [emitRoutePreviewChange, planningOverlay, routePreviewSelection]);

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

  function activateCandidate(index: number) {
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

  function selectDepartureRunway(runwayName: string) {
    setSelectedDepartureRunwayName(runwayName);
    setSelectedDepartureProcedureId(null);
    setIsDepartureProcedureConfirmed(false);
  }

  function selectArrivalRunway(runwayName: string) {
    setSelectedArrivalRunwayName(runwayName);
    setSelectedArrivalProcedureId(null);
    setIsArrivalProcedureConfirmed(false);
    setSelectedArrivalTransitionId(null);
    setIsArrivalTransitionConfirmed(false);
    setSelectedApproachProcedureId(null);
    setIsArrivalApproachConfirmed(false);
  }

  function toggleDepartureProcedureConfirmation() {
    setIsDepartureProcedureConfirmed((current) => !current);
  }

  function toggleArrivalProcedureConfirmation() {
    setIsArrivalProcedureConfirmed((current) => !current);
  }

  function toggleArrivalTransitionConfirmation() {
    setIsArrivalTransitionConfirmed((current) => !current);
  }

  function toggleArrivalApproachConfirmation() {
    setIsArrivalApproachConfirmed((current) => !current);
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

  return {
    departure,
    setDeparture,
    arrival,
    setArrival,
    cruiseAltitudeFt,
    setCruiseAltitudeFt,
    limit,
    setLimit,
    result,
    error,
    planningError,
    isLoading,
    activeCandidateIndex,
    departureRunwayOptions,
    arrivalRunwayOptions,
    selectedDepartureRunwayName,
    selectedArrivalRunwayName,
    selectedDepartureProcedureDisplay,
    selectedArrivalProcedureDisplay,
    selectedArrivalTransitionDisplay,
    selectedApproachProcedureDisplay,
    hasSelectedDepartureProcedure: Boolean(selectedDepartureProcedure),
    hasSelectedArrivalProcedure: Boolean(selectedArrivalProcedure),
    hasSelectedArrivalTransition: Boolean(selectedArrivalTransition),
    hasSelectedApproachProcedure: Boolean(selectedApproachProcedure),
    isDepartureProcedureConfirmed,
    isArrivalProcedureConfirmed,
    isArrivalTransitionConfirmed,
    isArrivalApproachConfirmed,
    availableDepartureProcedureCount: availableDepartureProcedures.length,
    availableArrivalStarProcedureCount: availableArrivalStarProcedures.length,
    availableArrivalTransitionCount: availableArrivalTransitions.length,
    availableArrivalApproachProcedureCount: availableArrivalApproachProcedures.length,
    currentWorkflowStageLabel,
    currentFocusDetail,
    workflowSteps,
    selectionSnapshot,
    activeApproachStatusText,
    activeApproachCountText,
    handleSubmit,
    clearDisplayedRoute,
    activateCandidate,
    selectDepartureRunway,
    selectArrivalRunway,
    toggleDepartureProcedureConfirmation,
    toggleArrivalProcedureConfirmation,
    toggleArrivalTransitionConfirmation,
    toggleArrivalApproachConfirmation,
  };
}

export type RoutePlannerState = ReturnType<typeof useRoutePlannerState>;
