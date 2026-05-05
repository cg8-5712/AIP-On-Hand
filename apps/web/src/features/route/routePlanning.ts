import type {
  AirportRunwayEnd,
  ProcedureSummary,
  RouteAirwaySegment,
  RouteProcedureOption,
  TransitionSummary,
} from "../../types/api";

export function formatDistance(distanceNm: number) {
  return `${Math.round(distanceNm)} nm`;
}

export function formatDirection(direction?: string | null) {
  switch (direction?.toUpperCase()) {
    case "F":
      return "one-way";
    case "B":
      return "reverse one-way";
    default:
      return "two-way";
  }
}

export function formatAltitudeBand(segment: RouteAirwaySegment) {
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

export function formatAirwaySequence(segments: RouteAirwaySegment[]) {
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

export function findProcedureSummaryById(procedures: ProcedureSummary[], procedureId: number | null) {
  if (!procedureId) {
    return null;
  }

  return procedures.find((procedure) => procedure.id === procedureId) ?? null;
}

export function findTransitionSummaryById(transitions: TransitionSummary[], transitionId: number | null) {
  if (!transitionId) {
    return null;
  }

  return transitions.find((transition) => transition.id === transitionId) ?? null;
}

export function resolveProcedureRunwayLabel(procedure: ProcedureSummary | null) {
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

export function formatSelectionWithRunway(name: string | null | undefined, runwayLabel: string | null | undefined) {
  if (!name) {
    return null;
  }

  return runwayLabel ? `${name} / RWY ${runwayLabel}` : name;
}

export function normalizeRunwayName(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase();
  return normalized ? normalized : null;
}

export function sortRunwaysForOperation(runways: AirportRunwayEnd[], operation: "departure" | "arrival") {
  return [...runways]
    .filter((runway) => (operation === "departure" ? runway.isTakeoff : runway.isLanding))
    .sort((left, right) => right.lengthFt - left.lengthFt || left.runwayName.localeCompare(right.runwayName));
}

export function proceduresForKind(procedures: ProcedureSummary[], kind: ProcedureSummary["procedureKind"]) {
  return procedures.filter((procedure) => procedure.procedureKind === kind);
}

export function filterProceduresByRunway(procedures: ProcedureSummary[], runwayName: string | null) {
  const normalizedRunwayName = normalizeRunwayName(runwayName);
  if (!normalizedRunwayName) {
    return procedures;
  }

  return procedures.filter((procedure) => procedureRunwayMatchesSelectedRunway(procedure, normalizedRunwayName));
}

export function filterProceduresByRouteOptions(procedures: ProcedureSummary[], routeOptions: RouteProcedureOption[]) {
  const allowedProcedureIds = new Set(routeOptions.map((option) => option.procedureId));
  return procedures.filter((procedure) => allowedProcedureIds.has(procedure.id));
}

export function filterTransitionsByRunway(transitions: TransitionSummary[], runwayName: string | null) {
  const normalizedRunwayName = normalizeRunwayName(runwayName);
  if (!normalizedRunwayName) {
    return transitions;
  }

  return transitions.filter((transition) => normalizeRunwayName(transition.runwayName) === normalizedRunwayName);
}

export function filterApproachesByRunwayAndTransition(
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

export function groupTransitions(transitions: TransitionSummary[]) {
  const representativesByKey = new Map<string, TransitionSummary>();
  const approachIdsByKey = new Map<string, Set<number>>();

  for (const transition of transitions) {
    const key = `${normalizeRunwayName(transition.runwayName) ?? ""}|${transition.name}`;

    if (!representativesByKey.has(key)) {
      representativesByKey.set(key, transition);
    }

    const approachIds = approachIdsByKey.get(key) ?? new Set<number>();
    approachIds.add(transition.approachId);
    approachIdsByKey.set(key, approachIds);
  }

  const transitionsByRepresentativeId = new Map<number, Set<number>>();

  for (const [key, transition] of representativesByKey.entries()) {
    transitionsByRepresentativeId.set(transition.id, new Set(approachIdsByKey.get(key) ?? []));
  }

  return {
    transitions: [...representativesByKey.values()],
    approachIdsByTransitionId: transitionsByRepresentativeId,
  };
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
