import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { DetailHeader } from "./features/layout/DetailHeader";
import { MapStage } from "./features/layout/MapStage";
import { SideRail } from "./features/layout/SideRail";
import {
  type BasemapTone,
  initialVisibility,
  type AppPage,
  type MapFocusRequest,
  type MapFocusRequestPayload,
  type ProcedureFilter,
  type RouteMapOverlay,
  type RoutePreviewSelection,
  type ViewportState,
} from "./features/app/types";
import { EaipPage } from "./features/eaip/EaipPage";
import { FuelPage } from "./features/fuel/FuelPage";
import { MapDetailPage } from "./features/map/MapDetailPage";
import { WeatherPage } from "./features/weather/WeatherPage";
import { formatUnixUtc } from "./features/weather/formatters";
import { RoutePage } from "./features/route/RoutePage";
import { SettingsPage } from "./features/settings/SettingsPage";
import {
  getAirportOverview,
  getAirportProcedures,
  getHealth,
  getMapLayers,
  getProcedureGeometry,
  getVersion,
  searchNavdata,
} from "./lib/api";
import type {
  AirportFeature,
  AirportProceduresResponse,
  AirportWeatherOverviewResponse,
  HealthResponse,
  LatLon,
  MapLayersResponse,
  ProcedureGeometryResponse,
  SearchResultItem,
  VersionResponse,
} from "./types/api";

type BootstrapState = {
  health?: HealthResponse;
  version?: VersionResponse;
  error?: string;
};

const basemapToneStorageKey = "aoh.basemap-tone";

function getInitialBasemapTone(): BasemapTone {
  if (typeof window === "undefined") {
    return "classic";
  }

  const stored = window.localStorage.getItem(basemapToneStorageKey);
  if (stored === "classic" || stored === "dark" || stored === "light") {
    return stored;
  }

  return "classic";
}

function routeOverlayPoints(overlay: RouteMapOverlay): LatLon[] {
  const points: LatLon[] = [];

  for (const segment of overlay.selection.candidate.airways) {
    points.push(segment.from, segment.to);
  }

  for (const geometry of [
    overlay.departureProcedure,
    overlay.arrivalProcedure,
    overlay.approachProcedure,
  ]) {
    if (!geometry) {
      continue;
    }

    for (const point of [...geometry.path, ...geometry.missedPath]) {
      points.push(point.position);
    }
  }

  return points;
}

export default function App() {
  const [activePage, setActivePage] = useState<AppPage>("map");
  const [bootstrap, setBootstrap] = useState<BootstrapState>({});
  const [layers, setLayers] = useState<MapLayersResponse | null>(null);
  const [layerError, setLayerError] = useState<string | null>(null);
  const [viewport, setViewport] = useState<ViewportState | null>(null);
  const [visibility, setVisibility] = useState(initialVisibility);
  const [airportFilter, setAirportFilter] = useState("");
  const [selectedAirportIdent, setSelectedAirportIdent] = useState<string | null>(null);
  const [airportProcedures, setAirportProcedures] = useState<AirportProceduresResponse | null>(null);
  const [procedureError, setProcedureError] = useState<string | null>(null);
  const [selectedProcedureId, setSelectedProcedureId] = useState<number | null>(null);
  const [selectedProcedureGeometry, setSelectedProcedureGeometry] =
    useState<ProcedureGeometryResponse | null>(null);
  const [procedureFilter, setProcedureFilter] = useState<ProcedureFilter>("all");
  const [airportOverview, setAirportOverview] = useState<AirportWeatherOverviewResponse | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);
  const [weatherHistoryHours, setWeatherHistoryHours] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [focusRequest, setFocusRequest] = useState<MapFocusRequest | null>(null);
  const [basemapTone, setBasemapTone] = useState<BasemapTone>(getInitialBasemapTone);
  const [selectedRoutePreview, setSelectedRoutePreview] = useState<RoutePreviewSelection | null>(null);
  const [routeMapOverlay, setRouteMapOverlay] = useState<RouteMapOverlay | null>(null);
  const deferredAirportFilter = useDeferredValue(airportFilter);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const focusRequestIdRef = useRef(0);
  const shellGridClass =
    activePage === "route"
      ? "grid gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[110px_minmax(560px,0.95fr)_minmax(0,1.45fr)]"
      : "grid gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[110px_400px_minmax(0,1fr)]";
  const detailPanelClass =
    activePage === "route"
      ? "layout-panel flex min-h-[620px] flex-col overflow-hidden xl:min-h-0"
      : "layout-panel flex min-h-[620px] flex-col overflow-hidden xl:min-h-0";

  useEffect(() => {
    let active = true;

    async function loadBootstrap() {
      try {
        const [health, version] = await Promise.all([getHealth(), getVersion()]);

        if (!active) {
          return;
        }

        setBootstrap({ health, version });
      } catch (error) {
        if (!active) {
          return;
        }

        setBootstrap({
          error: error instanceof Error ? error.message : "Unknown bootstrap failure",
        });
      }
    }

    loadBootstrap();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const trimmed = deferredSearchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    setSearchError(null);
    setIsSearching(true);

    searchNavdata(trimmed, { signal: controller.signal })
      .then((response) => {
        setSearchResults(response.results);
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        setSearchResults([]);
        setSearchError(error instanceof Error ? error.message : "Failed to search navdata");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [deferredSearchQuery]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(basemapToneStorageKey, basemapTone);
  }, [basemapTone]);

  useEffect(() => {
    if (!viewport) {
      return;
    }

    const controller = new AbortController();
    setLayerError(null);

    getMapLayers(viewport.bounds, {
      zoom: viewport.zoom,
      ...visibility,
      signal: controller.signal,
    })
      .then((response) => {
        setLayers(response);
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        setLayerError(error instanceof Error ? error.message : "Failed to load map layers");
      });

    return () => {
      controller.abort();
    };
  }, [viewport, visibility]);

  useEffect(() => {
    if (!layers || layers.airports.length === 0) {
      return;
    }

    if (!selectedAirportIdent) {
      setSelectedAirportIdent(layers.airports[0].ident);
    }
  }, [layers, selectedAirportIdent]);

  useEffect(() => {
    if (!selectedAirportIdent) {
      setAirportProcedures(null);
      setSelectedProcedureId(null);
      setSelectedProcedureGeometry(null);
      return;
    }

    const controller = new AbortController();
    setProcedureError(null);

    getAirportProcedures(selectedAirportIdent, { signal: controller.signal })
      .then((response) => {
        setAirportProcedures(response);
        setSelectedProcedureId((current) =>
          current && response.procedures.some((procedure) => procedure.id === current)
            ? current
            : null,
        );
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        setProcedureError(error instanceof Error ? error.message : "Failed to load procedures");
        setAirportProcedures(null);
        setSelectedProcedureId(null);
        setSelectedProcedureGeometry(null);
      });

    return () => {
      controller.abort();
    };
  }, [selectedAirportIdent]);

  useEffect(() => {
    if (!selectedProcedureId) {
      setSelectedProcedureGeometry(null);
      return;
    }

    const controller = new AbortController();
    setProcedureError(null);

    getProcedureGeometry(selectedProcedureId, { signal: controller.signal })
      .then((response) => {
        setSelectedProcedureGeometry(response);
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        setProcedureError(error instanceof Error ? error.message : "Failed to load procedure geometry");
        setSelectedProcedureGeometry(null);
      });

    return () => {
      controller.abort();
    };
  }, [selectedProcedureId]);

  useEffect(() => {
    if (!selectedRoutePreview) {
      setRouteMapOverlay(null);
      return;
    }

    const currentSelection = selectedRoutePreview;
    const controller = new AbortController();
    setProcedureError(null);

    async function loadRouteOverlay() {
      const loadGeometry = async (procedureId: number | null) => {
        if (!procedureId) {
          return null;
        }

        return getProcedureGeometry(procedureId, { signal: controller.signal });
      };

      try {
        const [departureProcedure, arrivalProcedure, approachProcedure] = await Promise.all([
          loadGeometry(currentSelection.departureProcedureId),
          loadGeometry(currentSelection.arrivalProcedureId),
          loadGeometry(currentSelection.approachProcedureId),
        ]);

        if (controller.signal.aborted) {
          return;
        }

        setRouteMapOverlay({
          selection: currentSelection,
          departureProcedure,
          arrivalProcedure,
          approachProcedure,
        });
        setProcedureError(null);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setRouteMapOverlay(null);
        setProcedureError(error instanceof Error ? error.message : "Failed to load selected route procedures");
      }
    }

    loadRouteOverlay();

    return () => {
      controller.abort();
    };
  }, [selectedRoutePreview]);

  useEffect(() => {
    if (!routeMapOverlay) {
      return;
    }

    const points = routeOverlayPoints(routeMapOverlay);
    if (points.length === 0) {
      return;
    }

    queueMapFocus({
      kind: "bounds",
      points,
    });
  }, [routeMapOverlay]);

  const visibleAirports = useMemo(() => {
    const airports = layers?.airports ?? [];
    const normalizedFilter = deferredAirportFilter.trim().toLowerCase();

    if (!normalizedFilter) {
      return airports;
    }

    return airports.filter((airport) => {
      return (
        airport.ident.toLowerCase().includes(normalizedFilter) ||
        airport.name.toLowerCase().includes(normalizedFilter) ||
        airport.icao?.toLowerCase().includes(normalizedFilter)
      );
    });
  }, [deferredAirportFilter, layers]);

  const selectedAirport = useMemo(() => {
    const byVisibleList = layers?.airports.find((airport) => airport.ident === selectedAirportIdent);
    if (byVisibleList) {
      return byVisibleList;
    }

    if (!airportProcedures) {
      return null;
    }

    const airport = airportProcedures.airport;
    return {
      id: airport.id,
      ident: airport.ident,
      icao: airport.icao,
      name: airport.name,
      country: null,
      numApproaches: airportProcedures.procedures.length,
      longestRunwayLength: 0,
      location: airport.location,
    } satisfies AirportFeature;
  }, [airportProcedures, layers, selectedAirportIdent]);

  const selectedWeatherStationId = useMemo(() => {
    if (selectedAirport?.icao?.trim()) {
      return selectedAirport.icao.trim();
    }

    if (selectedAirport?.ident?.trim()) {
      return selectedAirport.ident.trim();
    }

    return selectedAirportIdent;
  }, [selectedAirport, selectedAirportIdent]);

  useEffect(() => {
    setWeatherHistoryHours(0);
  }, [selectedWeatherStationId]);

  useEffect(() => {
    if (!selectedWeatherStationId) {
      setAirportOverview(null);
      setWeatherError(null);
      setIsWeatherLoading(false);
      return;
    }

    const controller = new AbortController();
    setWeatherError(null);
    setIsWeatherLoading(true);

    getAirportOverview(selectedWeatherStationId, {
      historyHours: weatherHistoryHours,
      signal: controller.signal,
    })
      .then((response) => {
        setAirportOverview(response);
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        setAirportOverview(null);
        setWeatherError(error instanceof Error ? error.message : "Failed to load airport weather overview");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsWeatherLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [selectedWeatherStationId, weatherHistoryHours]);

  const filteredProcedures = useMemo(() => {
    const procedures = airportProcedures?.procedures ?? [];
    if (procedureFilter === "all") {
      return procedures;
    }

    return procedures.filter((procedure) => procedure.procedureKind === procedureFilter);
  }, [airportProcedures, procedureFilter]);

  useEffect(() => {
    if (procedureFilter === "all" || !selectedProcedureId) {
      return;
    }

    if (!airportProcedures || airportProcedures.airport.ident !== selectedAirportIdent) {
      return;
    }

    if (!filteredProcedures.some((procedure) => procedure.id === selectedProcedureId)) {
      setSelectedProcedureId(null);
    }
  }, [airportProcedures, filteredProcedures, procedureFilter, selectedAirportIdent, selectedProcedureId]);

  const selectedProcedureSummary = selectedProcedureGeometry?.summary ?? null;
  const weatherFlightCategory = airportOverview?.metar?.flightCategory ?? "n/a";
  const weatherObservedAt = formatUnixUtc(airportOverview?.metar?.observedAtUnix);
  const stationTypes =
    airportOverview?.station?.siteTypes.length
      ? airportOverview.station.siteTypes.join(" / ")
      : "n/a";
  const totalProcedureCount = airportProcedures?.procedures.length ?? 0;
  const visibleProcedureCount = filteredProcedures.length;
  const selectedAirportLabel = selectedAirport
    ? `${selectedAirport.ident}${selectedAirport.icao ? ` | ${selectedAirport.icao}` : ""}`
    : "none";

  function queueMapFocus(request: MapFocusRequestPayload) {
    focusRequestIdRef.current += 1;
    setFocusRequest({
      requestId: focusRequestIdRef.current,
      ...request,
    });
  }

  function handleViewportAirportSelect(airport: AirportFeature) {
    setSelectedAirportIdent(airport.ident);
    queueMapFocus({
      kind: "location",
      location: airport.location,
      preserveZoom: true,
    });
  }

  function handleProcedureListSelect(procedureId: number) {
    setSelectedProcedureId(procedureId);
    queueMapFocus({
      kind: "procedure",
      procedureId,
    });
  }

  function handleSearchSelection(result: SearchResultItem) {
    setSearchQuery(`${result.ident}${result.airportIdent ? ` ${result.airportIdent}` : ""}`);

    if (result.airportIdent) {
      setSelectedAirportIdent(result.airportIdent);
    } else if (result.entityType === "airport") {
      setSelectedAirportIdent(result.ident);
    }

    if (result.procedureId) {
      if (result.procedureKind) {
        setProcedureFilter(result.procedureKind);
      }
      setSelectedProcedureId(result.procedureId);
      queueMapFocus({
        kind: "procedure",
        procedureId: result.procedureId,
      });
      setActivePage("map");
      return;
    }

    if (result.entityType === "airway" && result.from && result.to) {
      queueMapFocus({
        kind: "bounds",
        points: [result.from, result.to],
      });
      setActivePage("map");
      return;
    }

    if (result.location) {
      queueMapFocus({
        kind: "location",
        location: result.location,
        zoom: result.entityType === "airport" ? 10 : 11,
      });
      setActivePage("map");
      return;
    }

    if (result.entityType === "airport") {
      setActivePage("map");
    }
  }

  function toggleLayer(key: keyof typeof visibility) {
    setVisibility((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  return (
    <div className="app-shell">
      <div className="page-frame">
        <div className={shellGridClass}>
          <SideRail activePage={activePage} onPageChange={setActivePage} />

          <section className={detailPanelClass}>
            <DetailHeader
              activePage={activePage}
              searchQuery={searchQuery}
              deferredSearchQuery={deferredSearchQuery}
              isSearching={isSearching}
              searchError={searchError}
              searchResults={searchResults}
              onSearchQueryChange={setSearchQuery}
              onSearchSelection={handleSearchSelection}
              backendStatus={bootstrap.health?.status ?? "pending"}
              airacCycle={layers?.metadata.airacCycle ?? "loading"}
              selectedAirportLabel={selectedAirportLabel}
              selectedProcedureLabel={selectedProcedureSummary?.name ?? "none"}
              weatherFlightCategory={weatherFlightCategory}
              stationTypes={stationTypes}
              bootstrapError={bootstrap.error}
              layerError={layerError}
              procedureError={procedureError}
            />

            <div className="scroll-panel min-h-0 flex-1 overflow-y-auto p-5">
              {activePage === "map" ? (
                <MapDetailPage
                  layers={layers}
                  visibility={visibility}
                  onToggleLayer={toggleLayer}
                  airportFilter={airportFilter}
                  onAirportFilterChange={setAirportFilter}
                  visibleAirports={visibleAirports}
                  selectedAirportIdent={selectedAirportIdent}
                  onAirportSelect={handleViewportAirportSelect}
                  selectedAirport={selectedAirport}
                  totalProcedureCount={totalProcedureCount}
                  visibleProcedureCount={visibleProcedureCount}
                  filteredProcedures={filteredProcedures}
                  selectedProcedureId={selectedProcedureId}
                  onProcedureSelect={handleProcedureListSelect}
                  procedureFilter={procedureFilter}
                  onProcedureFilterChange={setProcedureFilter}
                  selectedProcedureSummary={selectedProcedureSummary}
                />
              ) : null}

              {activePage === "weather" ? (
                <WeatherPage
                  selectedAirport={selectedAirport}
                  selectedWeatherStationId={selectedWeatherStationId}
                  airportOverview={airportOverview}
                  weatherError={weatherError}
                  isWeatherLoading={isWeatherLoading}
                  weatherHistoryHours={weatherHistoryHours}
                  weatherFlightCategory={weatherFlightCategory}
                  weatherObservedAt={weatherObservedAt}
                  onToggleWeatherHistory={() => setWeatherHistoryHours((current) => (current === 24 ? 0 : 24))}
                />
              ) : null}

              {activePage === "eaip" ? (
                <EaipPage
                  selectedAirport={selectedAirport}
                  selectedWeatherStationId={selectedWeatherStationId}
                  airportOverview={airportOverview}
                  isLoading={isWeatherLoading}
                  error={weatherError}
                  stationTypes={stationTypes}
                />
              ) : null}

              <div className={activePage === "route" ? "block" : "hidden"} aria-hidden={activePage !== "route"}>
                <RoutePage onRoutePreviewChange={setSelectedRoutePreview} />
              </div>
              {activePage === "fuel" ? (
                <FuelPage
                  selectedAirport={selectedAirport}
                  selectedProcedureSummary={selectedProcedureSummary}
                />
              ) : null}
              {activePage === "settings" ? <SettingsPage /> : null}
            </div>
          </section>

          <MapStage
            layers={layers}
            selectedAirportIdent={selectedAirportIdent}
            selectedProcedure={selectedProcedureGeometry}
            routeOverlay={routeMapOverlay}
            focusRequest={focusRequest}
            basemapTone={basemapTone}
            visibility={visibility}
            onViewportChange={setViewport}
            onAirportSelect={setSelectedAirportIdent}
            onBasemapToneChange={setBasemapTone}
            onFocusRequestHandled={(requestId) => {
              setFocusRequest((current) => (current?.requestId === requestId ? null : current));
            }}
          />
        </div>
      </div>
    </div>
  );
}
