import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Bounds, MapLayersResponse, ProcedureGeometryResponse, ProcedureKind } from "../../types/api";
import type { BasemapTone, MapFocusRequest, RouteMapOverlay } from "../app/types";

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
  focusRequest: MapFocusRequest | null;
  basemapTone: BasemapTone;
  visibility: LayerVisibility;
  onViewportChange: (viewport: ViewportState) => void;
  onAirportSelect: (airportIdent: string) => void;
  onFocusRequestHandled: (requestId: number) => void;
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

function createBasemapLayer(tone: BasemapTone) {
  const config = basemapConfig[tone];
  const options: L.TileLayerOptions = {
    maxZoom: 20,
    className: "navmap-tile",
  };

  if (config.subdomains) {
    options.subdomains = config.subdomains;
  }

  return L.tileLayer(config.url, options);
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

export function MapView({
  layers,
  selectedAirportIdent,
  selectedProcedure,
  routeOverlay,
  focusRequest,
  basemapTone,
  visibility,
  onViewportChange,
  onAirportSelect,
  onFocusRequestHandled,
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
  const lastHandledFocusRequestIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    delete (containerRef.current as HTMLDivElement & { _leaflet_id?: number })._leaflet_id;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([35.8617, 104.1954], 5);

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
    routeOverlayLayerRef.current = L.layerGroup().addTo(map);
    procedureLayerRef.current = L.layerGroup().addTo(map);

    const publishViewport = () => {
      const bounds = map.getBounds();
      onViewportChange({
        bounds: {
          west: bounds.getWest(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          north: bounds.getNorth(),
        },
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
      procedureLayerRef.current = null;
      routeOverlayLayerRef.current = null;
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
        L.polyline(
          [
            [airway.from.lat, airway.from.lon],
            [airway.to.lat, airway.to.lon],
          ],
          {
            color:
              airway.airwayType === "J"
                ? airwayLineColors.J
                : airway.airwayType === "V"
                  ? airwayLineColors.V
                  : airwayLineColors.default,
            weight: 1.35,
            opacity: 0.62,
          },
        ).addTo(airwayLayer);
      }
    }

    if (visibility.waypointsEnroute || visibility.waypointsTerminal) {
      for (const waypoint of layers.waypoints) {
        if (waypoint.isAirportWaypoint && !visibility.waypointsTerminal) {
          continue;
        }

        if (!waypoint.isAirportWaypoint && !visibility.waypointsEnroute) {
          continue;
        }

        L.marker([waypoint.location.lat, waypoint.location.lon], {
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
        L.marker([vor.location.lat, vor.location.lon], {
          icon: createSymbolIcon("vor", vorSymbolSvg),
          keyboard: false,
        })
          .bindTooltip(`${vor.ident}${vor.facilityType ? ` | ${vor.facilityType}` : ""}`)
          .addTo(vorLayer);
      }
    }

    if (visibility.ndbs) {
      for (const ndb of layers.ndbs) {
        L.marker([ndb.location.lat, ndb.location.lon], {
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
        const marker = L.marker([airport.location.lat, airport.location.lon], {
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
          L.circleMarker([airport.location.lat, airport.location.lon], {
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

    const path = selectedProcedure.path.map((point) => [point.position.lat, point.position.lon] as L.LatLngTuple);
    const missedPath = selectedProcedure.missedPath.map(
      (point) => [point.position.lat, point.position.lon] as L.LatLngTuple,
    );
    const style = procedurePalette[selectedProcedure.summary.procedureKind];
    renderProcedureGeometry(procedureLayer, path, missedPath, style.line, style.point, true);
  }, [selectedProcedure]);

  useEffect(() => {
    const routeOverlayLayer = routeOverlayLayerRef.current;

    if (!routeOverlayLayer) {
      return;
    }

    routeOverlayLayer.clearLayers();

    if (!routeOverlay) {
      return;
    }

    const airwayPath = routeOverlay.selection.candidate.airways.flatMap((segment, index) => {
      const points = [
        [segment.from.lat, segment.from.lon] as L.LatLngTuple,
        [segment.to.lat, segment.to.lon] as L.LatLngTuple,
      ];

      return index === 0 ? points : points.slice(1);
    });

    if (airwayPath.length > 1) {
      L.polyline(airwayPath, {
        color: routeOverlayLineColor,
        weight: 7,
        opacity: 0.95,
      }).addTo(routeOverlayLayer);
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
    renderRouteProcedure(
      routeOverlayLayer,
      routeOverlay.approachProcedure,
      procedurePalette.approach.line,
      procedurePalette.approach.point,
    );
  }, [routeOverlay]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !focusRequest || lastHandledFocusRequestIdRef.current === focusRequest.requestId) {
      return;
    }

    if (focusRequest.kind === "location") {
      if (focusRequest.preserveZoom) {
        map.panTo([focusRequest.location.lat, focusRequest.location.lon], {
          animate: true,
        });
      } else {
        map.flyTo([focusRequest.location.lat, focusRequest.location.lon], focusRequest.zoom ?? 10, {
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
        map.flyTo([point.lat, point.lon], 10, {
          animate: true,
          duration: 0.85,
        });
      } else {
        map.fitBounds(
          L.latLngBounds(focusRequest.points.map((point) => [point.lat, point.lon] as L.LatLngTuple)).pad(0.25),
          {
            animate: true,
          },
        );
      }

      lastHandledFocusRequestIdRef.current = focusRequest.requestId;
      onFocusRequestHandled(focusRequest.requestId);
      return;
    }

    if (!selectedProcedure || selectedProcedure.summary.id !== focusRequest.procedureId) {
      return;
    }

    const procedurePoints = [...selectedProcedure.path, ...selectedProcedure.missedPath].map(
      (point) => [point.position.lat, point.position.lon] as L.LatLngTuple,
    );

    if (procedurePoints.length === 0) {
      lastHandledFocusRequestIdRef.current = focusRequest.requestId;
      onFocusRequestHandled(focusRequest.requestId);
      return;
    }

    if (procedurePoints.length === 1) {
      const [point] = procedurePoints;
      map.flyTo(point, 10, {
        animate: true,
        duration: 0.85,
      });
    } else {
      map.fitBounds(L.latLngBounds(procedurePoints).pad(0.25), {
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

  const path = procedure.path.map((point) => [point.position.lat, point.position.lon] as L.LatLngTuple);
  const missedPath = procedure.missedPath.map((point) => [point.position.lat, point.position.lon] as L.LatLngTuple);
  renderProcedureGeometry(layer, path, missedPath, lineColor, pointColor, false);
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
