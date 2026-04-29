import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { AirportSummary } from "../../types/api";

type MapViewProps = {
  airports: AirportSummary[];
  highlightedAirportId: string | null;
  showAirports: boolean;
  showRoute: boolean;
};

export function MapView({
  airports,
  highlightedAirportId,
  showAirports,
  showRoute,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const airportLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([35.8617, 104.1954], 4);

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

    const airportLayer = L.layerGroup().addTo(map);
    const routeLayer = L.layerGroup().addTo(map);

    mapRef.current = map;
    airportLayerRef.current = airportLayer;
    routeLayerRef.current = routeLayer;

    return () => {
      map.remove();
      mapRef.current = null;
      airportLayerRef.current = null;
      routeLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const airportLayer = airportLayerRef.current;
    const routeLayer = routeLayerRef.current;

    if (!map || !airportLayer || !routeLayer) {
      return;
    }

    airportLayer.clearLayers();
    routeLayer.clearLayers();

    if (airports.length === 0) {
      return;
    }

    const routePoints: L.LatLngTuple[] = [];

    for (const airport of airports) {
      const point: L.LatLngTuple = [airport.location.lat, airport.location.lon];
      routePoints.push(point);

      if (showAirports) {
        const isHighlighted = airport.id === highlightedAirportId;

        L.circleMarker(point, {
          radius: isHighlighted ? 8 : 6,
          weight: isHighlighted ? 3 : 2,
          color: isHighlighted ? "#22c55e" : "#f5c04f",
          fillColor: isHighlighted ? "#0f172a" : "#0b1f33",
          fillOpacity: 0.96,
        })
          .bindTooltip(`${airport.icao} | ${airport.name}`, {
            direction: "top",
            offset: [0, -6],
          })
          .addTo(airportLayer);
      }
    }

    if (showRoute && routePoints.length > 1) {
      L.polyline(routePoints, {
        color: "#3be3d0",
        weight: 3,
        opacity: 0.9,
        dashArray: "10 8",
      }).addTo(routeLayer);
    }

    const bounds = L.latLngBounds(routePoints);
    map.fitBounds(bounds.pad(0.4));
  }, [airports, highlightedAirportId, showAirports, showRoute]);

  return (
    <div
      className="min-h-[420px] overflow-hidden rounded-[24px] border border-slate-300/18 shadow-[0_28px_54px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.04)] md:min-h-[520px]"
      ref={containerRef}
    />
  );
}
