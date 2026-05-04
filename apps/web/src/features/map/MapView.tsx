import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type {
  Bounds,
  LatLon,
  MapLayersResponse,
  ProcedureGeometryResponse,
  ProcedureKind,
  TransitionGeometryResponse,
} from "../../types/api";
import type {
  BasemapTone,
  MapFocusRequest,
  RouteMapOverlay,
  RoutePlanningOverlay,
  RoutePlanningSelection,
} from "../app/types";

type LayerVisibility = {
  airports: boolean;
  waypointsEnroute: boolean;
  waypointsTerminal: boolean;
  vors: boolean;
  ndbs: boolean;
  airways: boolean;
};

type ViewportState = {
  bounds: Bounds;
  zoom: number;
};

type MapViewProps = {
  layers: MapLayersResponse | null;
  selectedAirportIdent: string | null;
  selectedProcedure: ProcedureGeometryResponse | null;
  routeOverlay: RouteMapOverlay | null;
  routePlanningOverlay: RoutePlanningOverlay | null;
  selectedAirwayPath: LatLon[];
  focusRequest: MapFocusRequest | null;
  basemapTone: BasemapTone;
  visibility: LayerVisibility;
  onViewportChange: (viewport: ViewportState) => void;
  onAirportSelect: (airportIdent: string) => void;
  onFocusRequestHandled: (requestId: number) => void;
  onPlanningProcedureSelect: (selection: RoutePlanningSelection) => void;
};

const basemapConfig: Record<BasemapTone, { url: string; attribution: string; subdomains?: string }> = {
  classic: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
  },
  light: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
  },
};

const airportSymbolSvg = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <g fill="none" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="6.4" stroke="#4ade80" stroke-width="2.1" />
      <path d="M12 1.1v3.1M12 19.8v3.1M1.1 12h3.1M19.8 12h3.1" stroke="#4ade80" stroke-width="2.1" />
    </g>
  </svg>
`;

const waypointSymbolSvg = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <g fill="#49628f" stroke="#dbeafe" stroke-width="0.6" stroke-linejoin="round">
      <path d="M12 6.4 18.7 17.6H5.3Z" />
    </g>
  </svg>
`;

const vorSymbolSvg = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <g fill="none" stroke="#3f5a8a" stroke-linecap="square" stroke-linejoin="miter">
      <rect x="3.2" y="6.1" width="17.6" height="11.8" stroke-width="1.45" />
      <path d="M8.2 8.2 5.9 12l2.3 3.8" stroke-width="1.85" />
      <path d="M15.8 8.2 18.1 12l-2.3 3.8" stroke-width="1.85" />
    </g>
    <circle cx="12" cy="12" r="1.05" fill="#3f5a8a" />
  </svg>
`;

const ndbSymbolSvg = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <g fill="none" stroke="#58b947" stroke-linecap="round">
      <circle cx="12" cy="12" r="8.6" stroke-width="1.85" stroke-dasharray="0.01 3.1" />
      <circle cx="12" cy="12" r="6.3" stroke-width="1.65" stroke-dasharray="0.01 2.85" />
      <circle cx="12" cy="12" r="4.1" stroke-width="1.45" stroke-dasharray="0.01 2.5" />
      <circle cx="12" cy="12" r="1.9" stroke-width="1.25" stroke-dasharray="0.01 2.2" />
    </g>
    <circle cx="12" cy="12" r="1.35" fill="#58b947" />
  </svg>
`;

const routeOverlayLineColor = "#3f5a8a";
const routeOverlayPointColor = "#e0f2fe";
const asiaDefaultCenter = {
  lat: 35.8617,
  lon: 104.1954,
} as const;
const asiaDefaultZoom = 5;
const singleWorldMinZoom = 1;
const pacificLongitudeOffset = 180;
const worldBounds = L.latLngBounds(
  [-85, -180] as L.LatLngTuple,
  [85, 180] as L.LatLngTuple,
);
const airwayLineColors = {
  J: "#3f5a8a",
  V: "#67e8f9",
  default: "#8ecae6",
} as const;
const procedurePalette: Record<ProcedureKind, { line: string; point: string }> = {
  sid: { line: "#34d399", point: "#bbf7d0" },
  star: { line: "#f59e0b", point: "#fde68a" },
  approach: { line: "#e879f9", point: "#f5d0fe" },
  procedure: { line: "#94a3b8", point: "#e2e8f0" },
};
const transitionPalette = { line: "#f97316", point: "#fdba74" } as const;
const airwayLabelLimits = {
  baseMaxCount: 100,
  routeMaxCount: 6,
  minDistanceNm: 24,
  baseMinPixelSpacing: 140,
  routeMinPixelSpacing: 160,
} as const;

type AirwayLabelDirection = "both" | "forward" | "backward";
type RenderablePlanningGeometry = ProcedureGeometryResponse | TransitionGeometryResponse;
type AirwayLabelSegment = {
  airwayName: string;
  direction?: string | null;
  airwayType?: string | null;
  from: LatLon;
  to: LatLon;
};

function normalizeLongitude(lon: number) {
  const normalized = ((((lon + 180) % 360) + 360) % 360) - 180;

  if (normalized === -180 && lon > 0) {
    return 180;
  }

  return normalized;
}

function toDisplayLongitude(lon: number) {
  return normalizeLongitude(lon - pacificLongitudeOffset);
}

function fromDisplayLongitude(displayLon: number) {
  return normalizeLongitude(displayLon + pacificLongitudeOffset);
}

function toDisplayLatLng(point: LatLon): L.LatLngTuple {
  return [point.lat, toDisplayLongitude(point.lon)];
}

function toDisplayTuple(lat: number, lon: number): L.LatLngTuple {
  return [lat, toDisplayLongitude(lon)];
}

function viewportBoundsFromDisplay(bounds: L.LatLngBounds): Bounds {
  const west = bounds.getWest();
  const east = bounds.getEast();
  const south = Math.max(bounds.getSouth(), -85);
  const north = Math.min(bounds.getNorth(), 85);

  if (east - west >= 359.5) {
    return {
      west: -180,
      south,
      east: 180,
      north,
    };
  }

  return {
    west: fromDisplayLongitude(west),
    south,
    east: fromDisplayLongitude(east),
    north,
  };
}

function unwrapDisplayPolyline(points: L.LatLngTuple[]) {
  if (points.length <= 1) {
    return [...points];
  }

  const unwrapped: L.LatLngTuple[] = [points[0]];

  for (const [lat, lon] of points.slice(1)) {
    let adjustedLon = lon;
    const [, previousLon] = unwrapped[unwrapped.length - 1];

    while (adjustedLon - previousLon > 180) {
      adjustedLon -= 360;
    }

    while (adjustedLon - previousLon < -180) {
      adjustedLon += 360;
    }

    unwrapped.push([lat, adjustedLon]);
  }

  return unwrapped;
}

function splitWrappedPolyline(points: L.LatLngTuple[]) {
  if (points.length === 0) {
    return [];
  }

  if (points.length === 1) {
    return [[points[0]]];
  }

  const unwrapped = unwrapDisplayPolyline(points);
  const segments: L.LatLngTuple[][] = [[[unwrapped[0][0], normalizeLongitude(unwrapped[0][1])]]];

  for (let index = 1; index < unwrapped.length; index += 1) {
    const [previousLat, previousLon] = unwrapped[index - 1];
    const [nextLat, nextLon] = unwrapped[index];
    const currentSegment = segments[segments.length - 1];

    if (Math.abs(nextLon - previousLon) <= 180 && nextLon >= -180 && nextLon <= 180) {
      currentSegment.push([nextLat, normalizeLongitude(nextLon)]);
      continue;
    }

    const seamLon = nextLon > previousLon ? 180 : -180;
    const wrappedSeamLon = seamLon === 180 ? -180 : 180;
    const ratio = (seamLon - previousLon) / (nextLon - previousLon);
    const seamLat = previousLat + (nextLat - previousLat) * ratio;

    currentSegment.push([seamLat, seamLon]);
    segments.push([
      [seamLat, wrappedSeamLon],
      [nextLat, normalizeLongitude(nextLon)],
    ]);
  }

  return segments.filter((segment) => segment.length > 1);
}

function addWrappedPolyline(layer: L.LayerGroup, points: L.LatLngTuple[], options: L.PolylineOptions) {
  for (const segment of splitWrappedPolyline(points)) {
    L.polyline(segment, options).addTo(layer);
  }
}

function displayBoundsForPoints(points: LatLon[]) {
  return L.latLngBounds(unwrapDisplayPolyline(points.map(toDisplayLatLng)).map(([lat, lon]) => L.latLng(lat, lon)));
}

function createBasemapLayer(tone: BasemapTone) {
  const config = basemapConfig[tone];
  const options: L.TileLayerOptions = {
    maxZoom: 20,
    className: "navmap-tile",
    noWrap: true,
    bounds: worldBounds,
  };

  if (config.subdomains) {
    options.subdomains = config.subdomains;
  }

  const layer = L.tileLayer(config.url, options);
  const originalGetTileUrl = layer.getTileUrl.bind(layer);

  layer.getTileUrl = (coords: L.Coords) => {
    const worldWidth = 1 << coords.z;
    const shiftedX = (((coords.x + worldWidth / 2) % worldWidth) + worldWidth) % worldWidth;
    const shiftedCoords = new L.Point(shiftedX, coords.y) as L.Coords;
    shiftedCoords.z = coords.z;

    return originalGetTileUrl(shiftedCoords);
  };

  return layer;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createSymbolIcon(
  variant: "airport" | "waypoint" | "vor" | "ndb",
  svg: string,
  label?: string,
) {
  const safeLabel = label ? escapeHtml(label) : null;

  return L.divIcon({
    className: `navmap-div-icon navmap-div-icon-${variant}${safeLabel ? " navmap-div-icon-with-label" : ""}`,
    html: `
      <div class="navmap-symbol navmap-symbol-${variant}">
        <span class="navmap-symbol-glyph">${svg}</span>
        ${safeLabel ? `<span class="navmap-symbol-label">${safeLabel}</span>` : ""}
      </div>
    `,
    iconSize: safeLabel ? [92, 24] : [24, 24],
    iconAnchor: [12, 12],
    tooltipAnchor: [0, -14],
  });
}

function airwayLineColor(airwayType?: string | null) {
  const normalized = airwayType?.trim().toUpperCase();
  if (normalized === "J") {
    return airwayLineColors.J;
  }
  if (normalized === "V") {
    return airwayLineColors.V;
  }
  return airwayLineColors.default;
}

function normalizeAirwayLabelDirection(direction?: string | null): AirwayLabelDirection {
  switch (direction?.trim().toUpperCase()) {
    case "F":
      return "forward";
    case "B":
      return "backward";
    default:
      return "both";
  }
}

function midpoint(from: LatLon, to: LatLon): LatLon {
  return { lat: (from.lat + to.lat) / 2, lon: (from.lon + to.lon) / 2 };
}

function approximateDistanceNm(from: LatLon, to: LatLon) {
  const averageLatitudeRad = (((from.lat + to.lat) / 2) * Math.PI) / 180;
  const latNm = (to.lat - from.lat) * 60;
  const lonNm = (to.lon - from.lon) * 60 * Math.cos(averageLatitudeRad);
  return Math.hypot(latNm, lonNm);
}

function airwayLabelOrientation(
  map: L.Map,
  from: LatLon,
  to: LatLon,
  direction?: string | null,
) {
  // Use projected pixel coordinates to calculate angle, ensuring label aligns with rendered line
  const zoom = map.getZoom();
  const fromPoint = map.project(toDisplayLatLng(from), zoom);
  const toPoint = map.project(toDisplayLatLng(to), zoom);

  const dx = toPoint.x - fromPoint.x;
  const dy = toPoint.y - fromPoint.y;

  // atan2 with y, x gives angle from positive x-axis
  // In screen coordinates, y increases downward, so we negate dy
  let rotationDeg = (Math.atan2(-dy, dx) * 180) / Math.PI;
  let labelDirection = normalizeAirwayLabelDirection(direction);

  // Keep label readable by flipping if upside down
  if (rotationDeg > 90) {
    rotationDeg -= 180;
    labelDirection = labelDirection === "forward" ? "backward" : labelDirection === "backward" ? "forward" : "both";
  } else if (rotationDeg < -90) {
    rotationDeg += 180;
    labelDirection = labelDirection === "forward" ? "backward" : labelDirection === "backward" ? "forward" : "both";
  }

  return { rotationDeg, labelDirection };
}

function createAirwayLabelIcon(
  airwayName: string,
  lineColor: string,
  rotationDeg: number,
  labelDirection: AirwayLabelDirection,
  emphasized: boolean,
) {
  const safeName = escapeHtml(airwayName);
  const fontSize = emphasized ? 13 : 12;
  const bodyHeight = emphasized ? 18 : 16;
  const strokeWidth = emphasized ? 1.8 : 1.5;
  const arrowWidth = labelDirection === "both" ? 0 : emphasized ? 10 : 8;
  const bodyWidth = Math.max(emphasized ? 48 : 44, Math.round(airwayName.length * (fontSize * 0.65) + (emphasized ? 14 : 12)));
  const totalWidth = bodyWidth + arrowWidth + strokeWidth * 2;
  const totalHeight = bodyHeight + strokeWidth * 2;
  const halfHeight = totalHeight / 2;
  const left = strokeWidth;
  const right = totalWidth - strokeWidth;
  const top = strokeWidth;
  const bottom = totalHeight - strokeWidth;
  const rectangularRight = labelDirection === "forward" ? right - arrowWidth : right;
  const rectangularLeft = labelDirection === "backward" ? left + arrowWidth : left;

  const outlinePoints =
    labelDirection === "forward"
      ? `${left},${top} ${rectangularRight},${top} ${right},${halfHeight} ${rectangularRight},${bottom} ${left},${bottom}`
      : labelDirection === "backward"
        ? `${rectangularLeft},${top} ${right},${top} ${right},${bottom} ${rectangularLeft},${bottom} ${left},${halfHeight}`
        : `${left},${top} ${right},${top} ${right},${bottom} ${left},${bottom}`;
  const textX =
    labelDirection === "forward"
      ? left + bodyWidth / 2
      : labelDirection === "backward"
        ? rectangularLeft + bodyWidth / 2
        : totalWidth / 2;
  const textY = totalHeight / 2;

  return L.divIcon({
    className: "navmap-div-icon navmap-div-icon-airway-label",
    html: `
      <div
        class="navmap-airway-label"
        style="width: ${totalWidth}px; height: ${totalHeight}px; transform: rotate(${rotationDeg}deg);"
      >
        <svg
          viewBox="0 0 ${totalWidth} ${totalHeight}"
          width="${totalWidth}"
          height="${totalHeight}"
          aria-hidden="true"
          focusable="false"
        >
          <polygon
            points="${outlinePoints}"
            fill="white"
            fill-opacity="0.95"
            stroke="${lineColor}"
            stroke-width="${strokeWidth}"
            stroke-linejoin="round"
          />
          <text
            x="${textX}"
            y="${textY}"
            fill="${lineColor}"
            font-family="'Fira Code', monospace"
            font-size="${fontSize}"
            font-weight="600"
            letter-spacing="${emphasized ? "0.04em" : "0.03em"}"
            text-anchor="middle"
            dominant-baseline="central"
          >${safeName}</text>
        </svg>
      </div>
    `,
    iconSize: [totalWidth, totalHeight],
    iconAnchor: [totalWidth / 2, totalHeight / 2],
  });
}

function addAirwayLabel(
  map: L.Map,
  layer: L.LayerGroup,
  airwayName: string,
  direction: string | null | undefined,
  from: LatLon,
  to: LatLon,
  lineColor: string,
  emphasized: boolean,
) {
  const { rotationDeg, labelDirection } = airwayLabelOrientation(map, from, to, direction);
  const anchor = midpoint(from, to);

  L.marker(toDisplayLatLng(anchor), {
    icon: createAirwayLabelIcon(airwayName, lineColor, rotationDeg, labelDirection, emphasized),
    interactive: false,
    keyboard: false,
    zIndexOffset: emphasized ? 1100 : 320,
  }).addTo(layer);
}

function collapseAirwayRuns<T extends AirwayLabelSegment>(segments: T[]) {
  const runs: T[] = [];

  for (const segment of segments) {
    const lastRun = runs[runs.length - 1];

    if (
      lastRun &&
      lastRun.airwayName === segment.airwayName &&
      normalizeAirwayLabelDirection(lastRun.direction) === normalizeAirwayLabelDirection(segment.direction)
    ) {
      lastRun.to = segment.to;
      continue;
    }

    runs.push({ ...segment });
  }

  return runs;
}

function dedupeAirwayNames<T extends AirwayLabelSegment>(segments: T[]) {
  const longestByAirwayName = new Map<string, T>();

  for (const segment of segments) {
    const existing = longestByAirwayName.get(segment.airwayName);

    if (!existing || approximateDistanceNm(segment.from, segment.to) > approximateDistanceNm(existing.from, existing.to)) {
      longestByAirwayName.set(segment.airwayName, segment);
    }
  }

  return [...longestByAirwayName.values()];
}

function baseAirwayLabelBudget(zoom: number) {
  if (zoom >= 9) {
    return { maxCount: airwayLabelLimits.baseMaxCount, minPixelSpacing: 120 };
  }

  if (zoom >= 8) {
    return { maxCount: 12, minPixelSpacing: 150 };
  }

  if (zoom >= 7) {
    return { maxCount: 8, minPixelSpacing: 180 };
  }

  return { maxCount: 0, minPixelSpacing: airwayLabelLimits.baseMinPixelSpacing };
}

function selectAirwayLabelSegments<T extends AirwayLabelSegment>(
  map: L.Map,
  segments: T[],
  maxCount: number,
  minPixelSpacing: number,
  uniqueByAirwayName = false,
) {
  const bounds = map.getBounds().pad(0.08);
  const collapsedRuns = collapseAirwayRuns(segments).filter((segment) => {
    const anchor = midpoint(segment.from, segment.to);
    return bounds.contains(toDisplayLatLng(anchor));
  });
  const candidateRuns = uniqueByAirwayName ? dedupeAirwayNames(collapsedRuns) : collapsedRuns;
  const runs = candidateRuns
    .filter((segment) => approximateDistanceNm(segment.from, segment.to) >= airwayLabelLimits.minDistanceNm)
    .sort((left, right) => approximateDistanceNm(right.from, right.to) - approximateDistanceNm(left.from, left.to));

  if (runs.length === 0 || runs.length > maxCount) {
    return [];
  }

  const accepted: T[] = [];
  const acceptedPoints: L.Point[] = [];
  const zoom = map.getZoom();

  for (const segment of runs) {
    const anchor = midpoint(segment.from, segment.to);
    const projectedAnchor = map.project(toDisplayLatLng(anchor), zoom);

    if (acceptedPoints.some((point) => point.distanceTo(projectedAnchor) < minPixelSpacing)) {
      continue;
    }

    accepted.push(segment);
    acceptedPoints.push(projectedAnchor);
  }

  return accepted;
}

// TODO(navmap): Re-enable airway label rendering after redesigning placement rules.
// Keep the current helpers in place so the next pass can iterate on them instead of rebuilding from zero.
const airwayLabelTodoKeepalive = { addAirwayLabel, selectAirwayLabelSegments };
void airwayLabelTodoKeepalive;

export function MapView({
  layers,
  selectedAirportIdent,
  selectedProcedure,
  routeOverlay,
  routePlanningOverlay,
  selectedAirwayPath,
  focusRequest,
  basemapTone,
  visibility,
  onViewportChange,
  onAirportSelect,
  onFocusRequestHandled,
  onPlanningProcedureSelect,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const attributionControlRef = useRef<L.Control.Attribution | null>(null);
  const currentAttributionRef = useRef<string | null>(null);
  const basemapLayerRef = useRef<L.TileLayer | null>(null);
  const airwayLayerRef = useRef<L.LayerGroup | null>(null);
  const waypointLayerRef = useRef<L.LayerGroup | null>(null);
  const vorLayerRef = useRef<L.LayerGroup | null>(null);
  const ndbLayerRef = useRef<L.LayerGroup | null>(null);
  const airportLayerRef = useRef<L.LayerGroup | null>(null);
  const selectedAirportLayerRef = useRef<L.LayerGroup | null>(null);
  const procedureLayerRef = useRef<L.LayerGroup | null>(null);
  const routeOverlayLayerRef = useRef<L.LayerGroup | null>(null);
  const routePlanningLayerRef = useRef<L.LayerGroup | null>(null);
  const selectedAirwayLayerRef = useRef<L.LayerGroup | null>(null);
  const lastHandledFocusRequestIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    delete (containerRef.current as HTMLDivElement & { _leaflet_id?: number })._leaflet_id;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      worldCopyJump: false,
      maxBounds: worldBounds,
      maxBoundsViscosity: 1,
      minZoom: singleWorldMinZoom,
      zoomSnap: 0.25,
    }).setView(toDisplayTuple(asiaDefaultCenter.lat, asiaDefaultCenter.lon), asiaDefaultZoom);

    L.control
      .zoom({
        position: "bottomright",
      })
      .addTo(map);

    attributionControlRef.current = L.control
      .attribution({
        position: "bottomleft",
        prefix: false,
      })
      .addTo(map);

    attributionControlRef.current.addAttribution(basemapConfig[basemapTone].attribution);
    currentAttributionRef.current = basemapConfig[basemapTone].attribution;

    basemapLayerRef.current = createBasemapLayer(basemapTone).addTo(map);

    airwayLayerRef.current = L.layerGroup().addTo(map);
    waypointLayerRef.current = L.layerGroup().addTo(map);
    vorLayerRef.current = L.layerGroup().addTo(map);
    ndbLayerRef.current = L.layerGroup().addTo(map);
    airportLayerRef.current = L.layerGroup().addTo(map);
    selectedAirportLayerRef.current = L.layerGroup().addTo(map);
    selectedAirwayLayerRef.current = L.layerGroup().addTo(map);
    routeOverlayLayerRef.current = L.layerGroup().addTo(map);
    routePlanningLayerRef.current = L.layerGroup().addTo(map);
    procedureLayerRef.current = L.layerGroup().addTo(map);

    const publishViewport = () => {
      const bounds = viewportBoundsFromDisplay(map.getBounds());
      onViewportChange({
        bounds,
        zoom: map.getZoom(),
      });
    };

    map.on("moveend zoomend", publishViewport);
    publishViewport();

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            map.invalidateSize({
              animate: false,
            });
          });

    if (resizeObserver) {
      resizeObserver.observe(containerRef.current);
    }

    mapRef.current = map;

    return () => {
      map.off("moveend zoomend", publishViewport);
      resizeObserver?.disconnect();
      map.remove();
      mapRef.current = null;
      attributionControlRef.current = null;
      currentAttributionRef.current = null;
      basemapLayerRef.current = null;
      airwayLayerRef.current = null;
      waypointLayerRef.current = null;
      vorLayerRef.current = null;
      ndbLayerRef.current = null;
      airportLayerRef.current = null;
      selectedAirportLayerRef.current = null;
      selectedAirwayLayerRef.current = null;
      procedureLayerRef.current = null;
      routeOverlayLayerRef.current = null;
      routePlanningLayerRef.current = null;
    };
  }, [onViewportChange]);

  useEffect(() => {
    const map = mapRef.current;
    const currentBasemapLayer = basemapLayerRef.current;

    if (!map || !currentBasemapLayer) {
      return;
    }

    const nextBasemapLayer = createBasemapLayer(basemapTone);

    if (attributionControlRef.current && currentAttributionRef.current) {
      attributionControlRef.current.removeAttribution(currentAttributionRef.current);
    }
    attributionControlRef.current?.addAttribution(basemapConfig[basemapTone].attribution);
    currentAttributionRef.current = basemapConfig[basemapTone].attribution;

    currentBasemapLayer.removeFrom(map);
    nextBasemapLayer.addTo(map);
    basemapLayerRef.current = nextBasemapLayer;
  }, [basemapTone]);

  useEffect(() => {
    const map = mapRef.current;
    const airwayLayer = airwayLayerRef.current;
    const waypointLayer = waypointLayerRef.current;
    const vorLayer = vorLayerRef.current;
    const ndbLayer = ndbLayerRef.current;
    const airportLayer = airportLayerRef.current;
    const selectedAirportLayer = selectedAirportLayerRef.current;

    if (!map || !airwayLayer || !waypointLayer || !vorLayer || !ndbLayer || !airportLayer || !selectedAirportLayer) {
      return;
    }

    airwayLayer.clearLayers();
    waypointLayer.clearLayers();
    vorLayer.clearLayers();
    ndbLayer.clearLayers();
    airportLayer.clearLayers();
    selectedAirportLayer.clearLayers();

    if (!layers) {
      return;
    }

    if (visibility.airways) {
      for (const airway of layers.airways) {
        const color = airwayLineColor(airway.airwayType);

        addWrappedPolyline(airwayLayer, [toDisplayLatLng(airway.from), toDisplayLatLng(airway.to)], {
          color,
          weight: 1.35,
          opacity: 0.62,
        });
      }

      /*
      TODO(navmap): Re-enable airway labels after redesigning low-zoom placement.
      const airwayLabelBudget = baseAirwayLabelBudget(map.getZoom());
      const labelableAirways = selectAirwayLabelSegments(
        map,
        layers.airways,
        airwayLabelBudget.maxCount,
        airwayLabelBudget.minPixelSpacing,
        true,
      );

      for (const airway of labelableAirways) {
        addAirwayLabel(
          map,
          airwayLayer,
          airway.airwayName,
          airway.direction,
          airway.from,
          airway.to,
          airwayLineColor(airway.airwayType),
          false,
        );
      }
      */
    }

    if (visibility.waypointsEnroute || visibility.waypointsTerminal) {
      for (const waypoint of layers.waypoints) {
        if (waypoint.isAirportWaypoint && !visibility.waypointsTerminal) {
          continue;
        }

        if (!waypoint.isAirportWaypoint && !visibility.waypointsEnroute) {
          continue;
        }

        L.marker(toDisplayLatLng(waypoint.location), {
          icon: createSymbolIcon("waypoint", waypointSymbolSvg),
          keyboard: false,
        })
          .bindTooltip(
            `${waypoint.ident}${waypoint.name ? ` | ${waypoint.name}` : ""}${waypoint.airportIdent ? ` | ${waypoint.airportIdent}` : ""}`,
          )
          .addTo(waypointLayer);
      }
    }

    if (visibility.vors) {
      for (const vor of layers.vors) {
        L.marker(toDisplayLatLng(vor.location), {
          icon: createSymbolIcon("vor", vorSymbolSvg),
          keyboard: false,
        })
          .bindTooltip(`${vor.ident}${vor.facilityType ? ` | ${vor.facilityType}` : ""}`)
          .addTo(vorLayer);
      }
    }

    if (visibility.ndbs) {
      for (const ndb of layers.ndbs) {
        L.marker(toDisplayLatLng(ndb.location), {
          icon: createSymbolIcon("ndb", ndbSymbolSvg),
          keyboard: false,
        })
          .bindTooltip(`${ndb.ident}${ndb.facilityType ? ` | ${ndb.facilityType}` : ""}`)
          .addTo(ndbLayer);
      }
    }

    if (visibility.airports) {
      const showAirportLabels = layers.airports.length < 200;

      for (const airport of layers.airports) {
        const marker = L.marker(toDisplayLatLng(airport.location), {
          icon: createSymbolIcon(
            "airport",
            airportSymbolSvg,
            showAirportLabels ? (airport.icao?.trim() || airport.ident.trim()) : undefined,
          ),
          keyboard: false,
        })
          .bindTooltip(`${airport.ident}${airport.icao ? ` | ${airport.icao}` : ""} | ${airport.name}`)
          .on("click", () => onAirportSelect(airport.ident))
          .addTo(airportLayer);

        if (airport.ident === selectedAirportIdent) {
          L.circleMarker(toDisplayLatLng(airport.location), {
            radius: 12,
            weight: 3,
            color: "#22d3ee",
            fillColor: "#0f172a",
            fillOpacity: 0.14,
          })
            .bindTooltip(`${airport.ident} | selected`)
            .addTo(selectedAirportLayer);

          marker.setZIndexOffset(1200);
        }
      }
    }
  }, [layers, onAirportSelect, selectedAirportIdent, visibility]);

  useEffect(() => {
    const map = mapRef.current;
    const procedureLayer = procedureLayerRef.current;

    if (!map || !procedureLayer) {
      return;
    }

    procedureLayer.clearLayers();

    if (!selectedProcedure) {
      return;
    }

    const path = selectedProcedure.path.map((point) => toDisplayLatLng(point.position));
    const missedPath = selectedProcedure.missedPath.map(
      (point) => toDisplayLatLng(point.position),
    );
    const style = procedurePalette[selectedProcedure.summary.procedureKind];
    renderProcedureGeometry(procedureLayer, path, missedPath, style.line, style.point, true);
  }, [selectedProcedure]);

  useEffect(() => {
    const map = mapRef.current;
    const routeOverlayLayer = routeOverlayLayerRef.current;

    if (!map || !routeOverlayLayer) {
      return;
    }

    routeOverlayLayer.clearLayers();

    if (!routeOverlay) {
      return;
    }

    const airwayPath = routeOverlay.selection.candidate.airways.flatMap((segment, index) => {
      const points = [
        toDisplayLatLng(segment.from),
        toDisplayLatLng(segment.to),
      ];

      return index === 0 ? points : points.slice(1);
    });

    if (airwayPath.length > 1) {
      addWrappedPolyline(routeOverlayLayer, airwayPath, {
        color: routeOverlayLineColor,
        weight: 7,
        opacity: 0.95,
      });
    }

    for (const point of airwayPath) {
      L.circleMarker(point, {
        radius: 4.5,
        weight: 2,
        color: routeOverlayPointColor,
        fillColor: routeOverlayLineColor,
        fillOpacity: 0.95,
      }).addTo(routeOverlayLayer);
    }

    /*
    TODO(navmap): Re-enable route preview airway labels after redesigning placement rules.
    const airwayRuns = selectAirwayLabelSegments(
      map,
      routeOverlay.selection.candidate.airways,
      airwayLabelLimits.routeMaxCount,
      airwayLabelLimits.routeMinPixelSpacing,
      true,
    );

    if (airwayRuns.length > 0) {
      for (const airwayRun of airwayRuns) {
        addAirwayLabel(
          map,
          routeOverlayLayer,
          airwayRun.airwayName,
          airwayRun.direction,
          airwayRun.from,
          airwayRun.to,
          routeOverlayLineColor,
          true,
        );
      }
    }
    */

    renderRouteProcedure(
      routeOverlayLayer,
      routeOverlay.departureProcedure,
      procedurePalette.sid.line,
      procedurePalette.sid.point,
    );
    renderRouteProcedure(
      routeOverlayLayer,
      routeOverlay.arrivalProcedure,
      procedurePalette.star.line,
      procedurePalette.star.point,
    );
    renderRouteTransition(
      routeOverlayLayer,
      routeOverlay.arrivalTransition,
      transitionPalette.line,
      transitionPalette.point,
    );
    renderRouteProcedure(
      routeOverlayLayer,
      routeOverlay.approachProcedure,
      procedurePalette.approach.line,
      procedurePalette.approach.point,
    );
  }, [routeOverlay]);

  useEffect(() => {
    const map = mapRef.current;
    const routePlanningLayer = routePlanningLayerRef.current;

    if (!map || !routePlanningLayer) {
      return;
    }

    routePlanningLayer.clearLayers();

    const planning = routePlanningOverlay ?? routeOverlay?.planning ?? null;
    if (!planning) {
      return;
    }

    if (planning.selectedDepartureRunwayName) {
      const runway = planning.departureRunways.find((item) => item.runwayName === planning.selectedDepartureRunwayName);
      if (runway) {
        renderPlanningRunway(routePlanningLayer, runway, procedurePalette.sid.line);
      }
    }

    if (planning.selectedArrivalRunwayName) {
      const runway = planning.arrivalRunways.find((item) => item.runwayName === planning.selectedArrivalRunwayName);
      if (runway) {
        renderPlanningRunway(routePlanningLayer, runway, procedurePalette.star.line);
      }
    }

    for (const [group, style] of [
      [planning.departure, procedurePalette.sid],
      [planning.arrivalStar, procedurePalette.star],
      [planning.arrivalApproach, procedurePalette.approach],
    ] as const) {
      if (!group) {
        continue;
      }

      for (const procedure of group.displayedProcedures) {
        const isSelected = group.selectedProcedureId === procedure.summary.id;
        renderSelectablePlanningGeometry(
          map,
          routePlanningLayer,
          procedure,
          style.line,
          style.point,
          isSelected,
          { kind: "procedure", id: procedure.summary.id },
          onPlanningProcedureSelect,
        );
      }
    }

    if (planning.arrivalTransition) {
      for (const transition of planning.arrivalTransition.displayedTransitions) {
        const isSelected = planning.arrivalTransition.selectedTransitionId === transition.summary.id;
        renderSelectablePlanningGeometry(
          map,
          routePlanningLayer,
          transition,
          transitionPalette.line,
          transitionPalette.point,
          isSelected,
          { kind: "transition", id: transition.summary.id },
          onPlanningProcedureSelect,
        );
      }
    }
  }, [onPlanningProcedureSelect, routeOverlay?.planning, routePlanningOverlay]);

  useEffect(() => {
    const map = mapRef.current;
    const selectedAirwayLayer = selectedAirwayLayerRef.current;

    if (!map || !selectedAirwayLayer) {
      return;
    }

    selectedAirwayLayer.clearLayers();

    if (selectedAirwayPath.length < 2) {
      return;
    }

    const airwayPath = selectedAirwayPath.map(toDisplayLatLng);

    addWrappedPolyline(selectedAirwayLayer, airwayPath, {
      color: "#fef3c7",
      weight: 9,
      opacity: 0.72,
    });

    addWrappedPolyline(selectedAirwayLayer, airwayPath, {
      color: "#f59e0b",
      weight: 5.6,
      opacity: 0.96,
    });

    const uniquePoints = new Set<string>();
    for (const point of selectedAirwayPath) {
      uniquePoints.add(`${point.lat},${point.lon}`);
    }

    for (const pointKey of uniquePoints) {
      const [lat, lon] = pointKey.split(",").map(Number);
      L.circleMarker(toDisplayTuple(lat, lon), {
        radius: 4.4,
        weight: 0,
        color: "#fef3c7",
        fillColor: "#fef3c7",
        fillOpacity: 0.72,
      }).addTo(selectedAirwayLayer);

      L.circleMarker(toDisplayTuple(lat, lon), {
        radius: 3.2,
        weight: 2,
        color: "#fef3c7",
        fillColor: "#f59e0b",
        fillOpacity: 0.96,
      }).addTo(selectedAirwayLayer);
    }
  }, [selectedAirwayPath]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !focusRequest || lastHandledFocusRequestIdRef.current === focusRequest.requestId) {
      return;
    }

    if (focusRequest.kind === "location") {
      const displayLocation = toDisplayLatLng(focusRequest.location);
      if (focusRequest.preserveZoom) {
        map.panTo(displayLocation, {
          animate: true,
        });
      } else {
        map.flyTo(displayLocation, focusRequest.zoom ?? 10, {
          animate: true,
          duration: 0.85,
        });
      }
      lastHandledFocusRequestIdRef.current = focusRequest.requestId;
      onFocusRequestHandled(focusRequest.requestId);
      return;
    }

    if (focusRequest.kind === "bounds") {
      if (focusRequest.points.length === 0) {
        lastHandledFocusRequestIdRef.current = focusRequest.requestId;
        onFocusRequestHandled(focusRequest.requestId);
        return;
      }

      if (focusRequest.points.length === 1) {
        const [point] = focusRequest.points;
        map.flyTo(toDisplayLatLng(point), 10, {
          animate: true,
          duration: 0.85,
        });
      } else {
        map.fitBounds(displayBoundsForPoints(focusRequest.points).pad(0.25), {
          animate: true,
        });
      }

      lastHandledFocusRequestIdRef.current = focusRequest.requestId;
      onFocusRequestHandled(focusRequest.requestId);
      return;
    }

    if (!selectedProcedure || selectedProcedure.summary.id !== focusRequest.procedureId) {
      return;
    }

    const procedurePoints = [...selectedProcedure.path, ...selectedProcedure.missedPath].map((point) => point.position);

    if (procedurePoints.length === 0) {
      lastHandledFocusRequestIdRef.current = focusRequest.requestId;
      onFocusRequestHandled(focusRequest.requestId);
      return;
    }

    if (procedurePoints.length === 1) {
      const [point] = procedurePoints;
      map.flyTo(toDisplayLatLng(point), 10, {
        animate: true,
        duration: 0.85,
      });
    } else {
      map.fitBounds(displayBoundsForPoints(procedurePoints).pad(0.25), {
        animate: true,
      });
    }

    lastHandledFocusRequestIdRef.current = focusRequest.requestId;
    onFocusRequestHandled(focusRequest.requestId);
  }, [focusRequest, onFocusRequestHandled, selectedProcedure]);

  return (
    <div
      className={`map-tone-${basemapTone} h-full min-h-[620px] w-full xl:min-h-0`}
      ref={containerRef}
    />
  );
}

function renderRouteProcedure(
  layer: L.LayerGroup,
  procedure: ProcedureGeometryResponse | null,
  lineColor: string,
  pointColor: string,
) {
  if (!procedure) {
    return;
  }

  const path = procedure.path.map((point) => toDisplayLatLng(point.position));
  const missedPath = procedure.missedPath.map((point) => toDisplayLatLng(point.position));
  renderProcedureGeometry(layer, path, missedPath, lineColor, pointColor, false);
}

function renderRouteTransition(
  layer: L.LayerGroup,
  transition: TransitionGeometryResponse | null,
  lineColor: string,
  pointColor: string,
) {
  if (!transition) {
    return;
  }

  const path = transition.path.map((point) => toDisplayLatLng(point.position));
  renderProcedureGeometry(layer, path, [], lineColor, pointColor, false);
}

function renderPlanningRunway(layer: L.LayerGroup, runway: { headingDeg: number; lengthFt: number; location: LatLon; runwayName: string }, color: string) {
  const headingRad = (runway.headingDeg * Math.PI) / 180;
  const halfLengthNm = Math.max(0.35, Math.min(runway.lengthFt / 6076.12 / 2, 3.2));
  const deltaLat = (Math.cos(headingRad) * halfLengthNm) / 60;
  const latCos = Math.max(0.15, Math.cos((runway.location.lat * Math.PI) / 180));
  const deltaLon = (Math.sin(headingRad) * halfLengthNm) / (60 * latCos);
  const from = {
    lat: runway.location.lat - deltaLat,
    lon: runway.location.lon - deltaLon,
  };
  const to = {
    lat: runway.location.lat + deltaLat,
    lon: runway.location.lon + deltaLon,
  };

  addWrappedPolyline(layer, [toDisplayLatLng(from), toDisplayLatLng(to)], {
    color,
    weight: 6,
    opacity: 0.8,
  });

  L.circleMarker(toDisplayLatLng(runway.location), {
    radius: 4,
    weight: 2,
    color,
    fillColor: "#0f172a",
    fillOpacity: 0.9,
  })
    .bindTooltip(`RWY ${runway.runwayName}`)
    .addTo(layer);
}

function renderSelectablePlanningGeometry(
  map: L.Map,
  layer: L.LayerGroup,
  geometry: RenderablePlanningGeometry,
  lineColor: string,
  pointColor: string,
  isSelected: boolean,
  selection: RoutePlanningSelection,
  onPlanningProcedureSelect: (selection: RoutePlanningSelection) => void,
) {
  const path = geometry.path.map((point) => toDisplayLatLng(point.position));
  const missedPath = "missedPath" in geometry ? geometry.missedPath.map((point) => toDisplayLatLng(point.position)) : [];
  renderProcedureGeometry(layer, path, missedPath, lineColor, pointColor, isSelected);

  const anchorPoint = geometry.path[Math.floor(geometry.path.length / 2)]?.position ?? geometry.path[0]?.position;
  if (anchorPoint) {
    L.marker(toDisplayLatLng(anchorPoint), {
      icon: createProcedureLabelIcon(geometry.summary.name, lineColor, isSelected),
      keyboard: false,
      zIndexOffset: isSelected ? 1250 : 1000,
    })
      .on("click", () => onPlanningProcedureSelect(selection))
      .addTo(layer);
  }

  for (const segment of splitWrappedPolyline(path)) {
    L.polyline(segment, {
      color: lineColor,
      weight: isSelected ? 7.4 : 10,
      opacity: 0.01,
      interactive: true,
    })
      .on("click", () => onPlanningProcedureSelect(selection))
      .addTo(layer);
  }

  for (const segment of splitWrappedPolyline(missedPath)) {
    L.polyline(segment, {
      color: lineColor,
      weight: isSelected ? 6.2 : 8.8,
      opacity: 0.01,
      interactive: true,
      dashArray: "10 7",
    })
      .on("click", () => onPlanningProcedureSelect(selection))
      .addTo(layer);
  }

  void map;
}

function createProcedureLabelIcon(name: string, color: string, isSelected: boolean) {
  const safeName = escapeHtml(name);
  const fontSize = isSelected ? 13 : 12;
  const horizontalPadding = isSelected ? 12 : 10;
  const width = Math.max(52, Math.round(safeName.length * (fontSize * 0.62) + horizontalPadding * 2));
  const height = isSelected ? 24 : 22;

  return L.divIcon({
    className: "navmap-div-icon navmap-div-icon-procedure-label",
    html: `
      <div
        class="navmap-procedure-label"
        style="min-width:${width}px;height:${height}px;border:1.5px solid ${color};color:${color};"
      >${safeName}</div>
    `,
    iconSize: [width, height],
    iconAnchor: [width / 2, height / 2],
  });
}

function renderProcedureGeometry(
  layer: L.LayerGroup,
  path: L.LatLngTuple[],
  missedPath: L.LatLngTuple[],
  lineColor: string,
  pointColor: string,
  isSelected: boolean,
) {
  const primaryWeight = isSelected ? 6.2 : 4.6;
  const missedWeight = isSelected ? 4.8 : 3.4;
  const outlineWeight = isSelected ? primaryWeight + 4 : primaryWeight + 1.8;
  const missedOutlineWeight = isSelected ? missedWeight + 3.2 : missedWeight + 1.4;
  const pointRadius = isSelected ? 6.2 : 4.4;
  const pointWeight = isSelected ? 2.6 : 2;

  if (path.length > 1) {
    L.polyline(path, {
      color: pointColor,
      weight: outlineWeight,
      opacity: isSelected ? 0.86 : 0.48,
    }).addTo(layer);

    L.polyline(path, {
      color: lineColor,
      weight: primaryWeight,
      opacity: 0.96,
    }).addTo(layer);
  }

  if (missedPath.length > 1) {
    L.polyline(missedPath, {
      color: pointColor,
      weight: missedOutlineWeight,
      opacity: isSelected ? 0.72 : 0.4,
      dashArray: isSelected ? "12 8" : "10 7",
    }).addTo(layer);

    L.polyline(missedPath, {
      color: lineColor,
      weight: missedWeight,
      opacity: isSelected ? 0.9 : 0.82,
      dashArray: isSelected ? "12 8" : "10 7",
    }).addTo(layer);
  }

  for (const point of [...path, ...missedPath]) {
    L.circleMarker(point, {
      radius: pointRadius + (isSelected ? 1.4 : 0.8),
      weight: 0,
      color: pointColor,
      fillColor: pointColor,
      fillOpacity: isSelected ? 0.75 : 0.42,
    }).addTo(layer);

    L.circleMarker(point, {
      radius: pointRadius,
      weight: pointWeight,
      color: pointColor,
      fillColor: lineColor,
      fillOpacity: 0.96,
    }).addTo(layer);
  }
}
