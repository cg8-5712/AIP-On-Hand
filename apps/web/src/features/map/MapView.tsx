import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Bounds, MapLayersResponse, ProcedureGeometryResponse } from "../../types/api";

type LayerVisibility = {
  airports: boolean;
  waypoints: boolean;
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
  visibility: LayerVisibility;
  onViewportChange: (viewport: ViewportState) => void;
  onAirportSelect: (airportIdent: string) => void;
};

export function MapView({
  layers,
  selectedAirportIdent,
  selectedProcedure,
  visibility,
  onViewportChange,
  onAirportSelect,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const airwayLayerRef = useRef<L.LayerGroup | null>(null);
  const waypointLayerRef = useRef<L.LayerGroup | null>(null);
  const vorLayerRef = useRef<L.LayerGroup | null>(null);
  const ndbLayerRef = useRef<L.LayerGroup | null>(null);
  const airportLayerRef = useRef<L.LayerGroup | null>(null);
  const selectedAirportLayerRef = useRef<L.LayerGroup | null>(null);
  const procedureLayerRef = useRef<L.LayerGroup | null>(null);
  const lastProcedureIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([35.8617, 104.1954], 5);

    L.control
      .zoom({
        position: "bottomright",
      })
      .addTo(map);

    L.control
      .attribution({
        position: "bottomleft",
        prefix: false,
      })
      .addAttribution(
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      )
      .addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    airwayLayerRef.current = L.layerGroup().addTo(map);
    waypointLayerRef.current = L.layerGroup().addTo(map);
    vorLayerRef.current = L.layerGroup().addTo(map);
    ndbLayerRef.current = L.layerGroup().addTo(map);
    airportLayerRef.current = L.layerGroup().addTo(map);
    selectedAirportLayerRef.current = L.layerGroup().addTo(map);
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

    mapRef.current = map;

    return () => {
      map.off("moveend zoomend", publishViewport);
      map.remove();
      mapRef.current = null;
      airwayLayerRef.current = null;
      waypointLayerRef.current = null;
      vorLayerRef.current = null;
      ndbLayerRef.current = null;
      airportLayerRef.current = null;
      selectedAirportLayerRef.current = null;
      procedureLayerRef.current = null;
    };
  }, [onViewportChange]);

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
            color: airway.airwayType === "J" ? "#5eead4" : airway.airwayType === "V" ? "#38bdf8" : "#67e8f9",
            weight: 1.2,
            opacity: 0.55,
          },
        ).addTo(airwayLayer);
      }
    }

    if (visibility.waypoints) {
      for (const waypoint of layers.waypoints) {
        L.circleMarker([waypoint.location.lat, waypoint.location.lon], {
          radius: 2.5,
          weight: 1,
          color: "#93c5fd",
          fillColor: "#dbeafe",
          fillOpacity: 0.8,
        })
          .bindTooltip(`${waypoint.ident}${waypoint.name ? ` | ${waypoint.name}` : ""}`)
          .addTo(waypointLayer);
      }
    }

    if (visibility.vors) {
      for (const vor of layers.vors) {
        L.circleMarker([vor.location.lat, vor.location.lon], {
          radius: 4.5,
          weight: 2,
          color: "#86efac",
          fillColor: "#14532d",
          fillOpacity: 0.92,
        })
          .bindTooltip(`${vor.ident}${vor.facilityType ? ` | ${vor.facilityType}` : ""}`)
          .addTo(vorLayer);
      }
    }

    if (visibility.ndbs) {
      for (const ndb of layers.ndbs) {
        L.circleMarker([ndb.location.lat, ndb.location.lon], {
          radius: 4,
          weight: 2,
          color: "#f9a8d4",
          fillColor: "#831843",
          fillOpacity: 0.92,
        })
          .bindTooltip(`${ndb.ident}${ndb.facilityType ? ` | ${ndb.facilityType}` : ""}`)
          .addTo(ndbLayer);
      }
    }

    if (visibility.airports) {
      for (const airport of layers.airports) {
        const marker = L.circleMarker([airport.location.lat, airport.location.lon], {
          radius: 5.5,
          weight: 2,
          color: "#fbbf24",
          fillColor: "#0f172a",
          fillOpacity: 0.95,
        })
          .bindTooltip(`${airport.ident}${airport.icao ? ` | ${airport.icao}` : ""} | ${airport.name}`)
          .on("click", () => onAirportSelect(airport.ident))
          .addTo(airportLayer);

        if (airport.ident === selectedAirportIdent) {
          L.circleMarker([airport.location.lat, airport.location.lon], {
            radius: 9,
            weight: 3,
            color: "#22c55e",
            fillColor: "#0f172a",
            fillOpacity: 0.15,
          })
            .bindTooltip(`${airport.ident} | selected`)
            .addTo(selectedAirportLayer);

          marker.bringToFront();
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
      lastProcedureIdRef.current = null;
      return;
    }

    const path = selectedProcedure.path.map((point) => [point.position.lat, point.position.lon] as L.LatLngTuple);
    const missedPath = selectedProcedure.missedPath.map(
      (point) => [point.position.lat, point.position.lon] as L.LatLngTuple,
    );

    if (path.length > 1) {
      L.polyline(path, {
        color: "#f97316",
        weight: 4,
        opacity: 0.95,
      }).addTo(procedureLayer);
    }

    if (missedPath.length > 1) {
      L.polyline(missedPath, {
        color: "#fb7185",
        weight: 3,
        opacity: 0.9,
        dashArray: "10 8",
      }).addTo(procedureLayer);
    }

    const highlightedPoints = [...path, ...missedPath];

    for (const point of highlightedPoints) {
      L.circleMarker(point, {
        radius: 4,
        weight: 2,
        color: "#fde68a",
        fillColor: "#f97316",
        fillOpacity: 0.95,
      }).addTo(procedureLayer);
    }

    if (selectedProcedure.summary.id !== lastProcedureIdRef.current && highlightedPoints.length > 1) {
      map.fitBounds(L.latLngBounds(highlightedPoints).pad(0.25), {
        animate: true,
      });
    }

    lastProcedureIdRef.current = selectedProcedure.summary.id;
  }, [selectedProcedure]);

  return (
    <div
      className="min-h-[460px] overflow-hidden rounded-[24px] border border-slate-300/18 shadow-[0_28px_54px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.04)] md:min-h-[620px]"
      ref={containerRef}
    />
  );
}
