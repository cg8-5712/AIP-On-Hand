import type { Dispatch, SetStateAction } from "react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { MapView } from "./features/map/MapView";
import {
  getAirportProcedures,
  getHealth,
  getMapLayers,
  getProcedureGeometry,
  getVersion,
} from "./lib/api";
import type {
  AirportFeature,
  AirportProceduresResponse,
  Bounds,
  HealthResponse,
  MapLayersResponse,
  ProcedureGeometryResponse,
  ProcedureSummary,
  VersionResponse,
} from "./types/api";

type BootstrapState = {
  health?: HealthResponse;
  version?: VersionResponse;
  error?: string;
};

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

const initialVisibility: LayerVisibility = {
  airports: true,
  waypoints: false,
  vors: true,
  ndbs: false,
  airways: true,
};

const panelClass = "layout-panel p-5";

const layerConfig = [
  { key: "airports", label: "Airports", colorClass: "bg-amber-300", activeClass: "text-amber-200" },
  { key: "waypoints", label: "Waypoints", colorClass: "bg-sky-300", activeClass: "text-sky-200" },
  { key: "vors", label: "VOR", colorClass: "bg-emerald-300", activeClass: "text-emerald-200" },
  { key: "ndbs", label: "NDB", colorClass: "bg-pink-300", activeClass: "text-pink-200" },
  { key: "airways", label: "Airways", colorClass: "bg-cyan-300", activeClass: "text-cyan-200" },
] as const;

export default function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapState>({});
  const [layers, setLayers] = useState<MapLayersResponse | null>(null);
  const [layerError, setLayerError] = useState<string | null>(null);
  const [viewport, setViewport] = useState<ViewportState | null>(null);
  const [visibility, setVisibility] = useState<LayerVisibility>(initialVisibility);
  const [airportFilter, setAirportFilter] = useState("");
  const [selectedAirportIdent, setSelectedAirportIdent] = useState<string | null>(null);
  const [airportProcedures, setAirportProcedures] = useState<AirportProceduresResponse | null>(null);
  const [procedureError, setProcedureError] = useState<string | null>(null);
  const [selectedProcedureId, setSelectedProcedureId] = useState<number | null>(null);
  const [selectedProcedureGeometry, setSelectedProcedureGeometry] =
    useState<ProcedureGeometryResponse | null>(null);
  const deferredAirportFilter = useDeferredValue(airportFilter);

  useEffect(() => {
    let active = true;

    async function loadBootstrap() {
      try {
        const [health, version] = await Promise.all([getHealth(), getVersion()]);

        if (!active) {
          return;
        }

        setBootstrap({
          health,
          version,
        });
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
      setSelectedAirportIdent(null);
      return;
    }

    if (!selectedAirportIdent || !layers.airports.some((airport) => airport.ident === selectedAirportIdent)) {
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
            : response.procedures[0]?.id ?? null,
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

  const procedureMetadata = layers?.metadata;
  const selectedProcedureSummary = selectedProcedureGeometry?.summary;
  const visibleProcedureCount = airportProcedures?.procedures.length ?? 0;
  const selectedPathCount =
    (selectedProcedureGeometry?.path.length ?? 0) + (selectedProcedureGeometry?.missedPath.length ?? 0);
  const viewportSummary = viewport
    ? `${viewport.zoom.toFixed(0)} / ${viewport.bounds.south.toFixed(1)}-${viewport.bounds.north.toFixed(1)}`
    : "syncing";
  const activeLayerCount = Object.values(visibility).filter(Boolean).length;

  return (
    <div className="app-shell">
      <div className="page-frame">
        <header className="layout-panel overflow-hidden px-5 py-5 sm:px-6 lg:px-7">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(420px,0.8fr)]">
            <div className="flex flex-col gap-4">
              <div>
                <p className="section-kicker">Web Flight Planning Surface</p>
                <h1 className="hero-title">AIP On Hand</h1>
              </div>

              <p className="support-copy max-w-[56rem] text-[1.03rem]">
                Real navdata is now driving the map. The UI should feel like a working aviation
                panel, not a debug page, so this pass tightens hierarchy, map focus, and selection
                readability without changing the backend contract.
              </p>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <HeroMetric
                  label="Backend"
                  value={bootstrap.health?.status ?? "pending"}
                  accentClass={bootstrap.health?.status === "ok" ? "text-emerald-300" : "text-amber-200"}
                />
                <HeroMetric
                  label="AIRAC"
                  value={procedureMetadata?.airacCycle ?? "loading"}
                  accentClass="text-cyan-200"
                />
                <HeroMetric
                  label="Viewport"
                  value={viewportSummary}
                  accentClass="text-slate-100"
                />
                <HeroMetric
                  label="Active Layers"
                  value={String(activeLayerCount)}
                  accentClass="text-amber-200"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <StatusTile
                label="Service"
                value={bootstrap.version?.service ?? "unreachable"}
                detail={bootstrap.version?.version ?? "version n/a"}
              />
              <StatusTile
                label="Procedures"
                value={selectedProcedureSummary?.name ?? "none"}
                detail={
                  selectedProcedureSummary
                    ? `${selectedProcedureSummary.procedureKind.toUpperCase()} / ${selectedProcedureSummary.legs} legs`
                    : "select an airport"
                }
              />
              <StatusTile
                label="Visible Airports"
                value={String(visibleAirports.length)}
                detail={`loaded ${layers?.airports.length ?? 0} in viewport`}
              />
              <StatusTile
                label="Nav Source"
                value={procedureMetadata?.dataSource ?? "loading"}
                detail={procedureMetadata?.hasSidStar ? "SID/STAR capable" : "procedure fallback"}
              />
            </div>
          </div>

          {bootstrap.error ? <InlineError message={bootstrap.error} className="mt-4" /> : null}
          {layerError ? <InlineError message={layerError} className="mt-4" /> : null}
          {procedureError ? <InlineError message={procedureError} className="mt-4" /> : null}
        </header>

        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)_380px]">
          <aside className={`${panelClass} flex min-h-0 flex-col`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="section-kicker">Layer Control</p>
                <h2 className="section-title">Map Filters</h2>
              </div>
              <span className="rounded-full border border-cyan-400/18 bg-cyan-400/8 px-3 py-1 text-[0.72rem] uppercase tracking-[0.12em] text-cyan-100">
                live
              </span>
            </div>

            <div className="mt-4 grid gap-3">
              {layerConfig.map((layer) => (
                <LayerRow
                  key={layer.key}
                  label={layer.label}
                  colorClass={layer.colorClass}
                  helper={layerHelperText(layer.key)}
                  count={layerCountForKey(layers, layer.key)}
                  isActive={visibility[layer.key]}
                  onClick={() => toggleLayer(setVisibility, layer.key)}
                />
              ))}
            </div>

            {renderTruncationNotice(layers)}

            <hr className="panel-divider" />

            <div>
              <p className="section-kicker">Viewport Browser</p>
              <h2 className="section-title">Visible Airports</h2>
              <label className="mt-3 block text-[0.8rem] text-slate-400" htmlFor="airport-filter">
                Filter current viewport
                <input
                  id="airport-filter"
                  name="airport-filter"
                  type="search"
                  placeholder="ICAO, ident, or airport name"
                  value={airportFilter}
                  onChange={(event) => setAirportFilter(event.target.value)}
                  className="input-shell"
                />
              </label>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <MiniDataTile label="Airports" value={String(layers?.airports.length ?? 0)} />
              <MiniDataTile label="Airways" value={String(layers?.airways.length ?? 0)} />
              <MiniDataTile label="Waypoints" value={String(layers?.waypoints.length ?? 0)} />
              <MiniDataTile label="VOR / NDB" value={`${layers?.vors.length ?? 0} / ${layers?.ndbs.length ?? 0}`} />
            </div>

            <ul className="scroll-panel mt-4 grid min-h-0 flex-1 list-none gap-3 overflow-y-auto pr-1">
              {visibleAirports.slice(0, 40).map((airport) => (
                <li key={airport.id} className="m-0">
                  <button
                    className={
                      `grid w-full cursor-pointer gap-1 rounded-[18px] border px-4 py-3 text-left transition duration-200 motion-reduce:transition-none ` +
                      (airport.ident === selectedAirportIdent
                        ? "border-cyan-300/34 bg-cyan-950/45 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                        : "border-slate-700/60 bg-slate-950/52 text-slate-300 hover:border-cyan-300/24 hover:bg-slate-900/88")
                    }
                    type="button"
                    onClick={() => setSelectedAirportIdent(airport.ident)}
                    aria-label={airport.name}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <strong className="font-mono text-[0.92rem] text-amber-300">
                        {airport.ident}
                        {airport.icao ? ` | ${airport.icao}` : ""}
                      </strong>
                      <span className="rounded-full bg-slate-900/80 px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.12em] text-slate-400">
                        {airport.numApproaches} proc
                      </span>
                    </div>
                    <span className="text-[0.95rem] text-slate-100">{airport.name}</span>
                    <span className="text-[0.8rem] text-slate-500">
                      {airport.country ?? "N/A"} / RWY {airport.longestRunwayLength || "n/a"} m
                    </span>
                  </button>
                </li>
              ))}
              {visibleAirports.length === 0 ? (
                <li className="overlay-card m-0 text-sm leading-6 text-slate-300">
                  No visible airports match the current filter.
                </li>
              ) : null}
            </ul>
          </aside>

          <main className="min-h-0">
            <div className="map-shell grid h-full min-h-[620px] grid-rows-[1fr]">
              <MapView
                layers={layers}
                selectedAirportIdent={selectedAirportIdent}
                selectedProcedure={selectedProcedureGeometry}
                visibility={visibility}
                onViewportChange={setViewport}
                onAirportSelect={setSelectedAirportIdent}
              />

              <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex flex-col gap-3 p-4 md:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="overlay-card max-w-[40rem]">
                    <p className="section-kicker">Map Surface</p>
                    <h2 className="section-title mt-1">Operational Overview</h2>
                    <p className="support-copy mt-2 text-sm">
                      Leaflet with OpenStreetMap tiles, recolored into a lower-glare basemap so
                      nav layers and selected procedures read first.
                    </p>
                  </div>

                  <div className="grid gap-2 md:grid-cols-3">
                    <MapBadge label="Selected" value={selectedAirportIdent ?? "none"} />
                    <MapBadge label="Procedure" value={selectedProcedureSummary?.procedureKind ?? "idle"} />
                    <MapBadge label="Path Points" value={String(selectedPathCount)} />
                  </div>
                </div>
              </div>

              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] p-4 md:p-5">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
                  <div className="overlay-card">
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.8rem] text-slate-300">
                      <LegendItem colorClass="bg-cyan-300" label="Airways" />
                      <LegendItem colorClass="bg-sky-300" label="Waypoints" />
                      <LegendItem colorClass="bg-emerald-300" label="VOR" />
                      <LegendItem colorClass="bg-pink-300" label="NDB" />
                      <LegendItem colorClass="bg-amber-300" label="Airports" />
                      <LegendItem colorClass="bg-orange-400" label="Selected procedure" />
                    </div>
                  </div>

                  {selectedProcedureSummary ? (
                    <div className="overlay-card">
                      <p className="section-kicker">Highlighted Procedure</p>
                      <p className="mt-1 text-[1rem] font-semibold text-slate-50">
                        {selectedProcedureSummary.name}
                      </p>
                      <p className="mt-1 text-sm text-slate-300">
                        {selectedProcedureSummary.procedureKind.toUpperCase()} / {selectedProcedureSummary.procedureType}
                        {selectedProcedureSummary.runwayName ? ` / RWY ${selectedProcedureSummary.runwayName}` : ""}
                      </p>
                    </div>
                  ) : (
                    <div className="overlay-card">
                      <p className="section-kicker">Highlighted Procedure</p>
                      <p className="mt-1 text-sm text-slate-300">
                        Select an airport and procedure to fit and highlight the decoded path.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </main>

          <aside className={`${panelClass} flex min-h-0 flex-col`}>
            <div>
              <p className="section-kicker">Selection Desk</p>
              <h2 className="section-title">Airport And Procedures</h2>
            </div>

            {selectedAirport ? (
              <div className="mt-4 rounded-[22px] border border-cyan-400/14 bg-cyan-950/16 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="m-0 font-mono text-[1rem] text-amber-300">
                      {selectedAirport.ident}
                      {selectedAirport.icao ? ` | ${selectedAirport.icao}` : ""}
                    </p>
                    <p className="m-0 mt-1 text-[1.05rem] font-medium text-slate-50">
                      {selectedAirport.name}
                    </p>
                  </div>
                  <div className="rounded-full border border-cyan-300/16 bg-slate-950/80 px-3 py-1 text-[0.72rem] uppercase tracking-[0.12em] text-cyan-100">
                    active
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                  <MiniDataTile label="Lat" value={selectedAirport.location.lat.toFixed(4)} />
                  <MiniDataTile label="Lon" value={selectedAirport.location.lon.toFixed(4)} />
                  <MiniDataTile label="Procedures" value={String(visibleProcedureCount)} />
                </div>
              </div>
            ) : (
              <div className="overlay-card mt-4">
                <p className="muted-copy text-sm">
                  Move the map or click a visible airport to inspect procedures and highlight
                  geometry.
                </p>
              </div>
            )}

            <hr className="panel-divider" />

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="section-kicker">Procedure Stack</p>
                <h3 className="section-title">Decoded List</h3>
              </div>
              <span className="text-[0.76rem] uppercase tracking-[0.12em] text-slate-500">
                {visibleProcedureCount} items
              </span>
            </div>

            <div className="scroll-panel mt-4 grid min-h-0 flex-1 gap-2 overflow-y-auto pr-1">
              {(airportProcedures?.procedures ?? []).slice(0, 60).map((procedure) => (
                <ProcedureButton
                  key={procedure.id}
                  procedure={procedure}
                  isActive={procedure.id === selectedProcedureId}
                  onClick={() => setSelectedProcedureId(procedure.id)}
                />
              ))}
              {airportProcedures?.procedures.length === 0 ? (
                <div className="overlay-card">
                  <p className="muted-copy text-sm">
                    No procedures were returned for this airport.
                  </p>
                </div>
              ) : null}
            </div>

            <hr className="panel-divider" />

            <div>
              <p className="section-kicker">Interpretation</p>
              <h3 className="section-title">Current Notes</h3>
            </div>
            <p className="support-copy mt-3 text-sm">
              This source stores many procedures in the <span className="font-mono text-slate-100">approach</span>
              {" "}and <span className="font-mono text-slate-100">approach_leg</span> tables. SID and STAR labels
              are inferred from leg geometry when explicit classification is not available.
            </p>

            {selectedProcedureSummary ? (
              <div className="mt-4 rounded-[18px] border border-slate-700/60 bg-slate-950/55 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="m-0 text-[1rem] font-semibold text-slate-50">
                    {selectedProcedureSummary.name}
                  </p>
                  <ProcedureKindChip kind={selectedProcedureSummary.procedureKind} />
                </div>
                <p className="m-0 mt-2 text-sm text-slate-300">
                  {selectedProcedureSummary.procedureType}
                  {selectedProcedureSummary.runwayName ? ` / RWY ${selectedProcedureSummary.runwayName}` : ""}
                </p>
                <p className="m-0 mt-1 text-[0.82rem] text-slate-500">
                  {selectedProcedureSummary.airportIdent} / {selectedProcedureSummary.legs} legs
                </p>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}

function renderTruncationNotice(layers: MapLayersResponse | null) {
  if (!layers) {
    return null;
  }

  const truncated = Object.entries(layers.truncation)
    .filter(([, value]) => value)
    .map(([key]) => key);

  if (truncated.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 rounded-[18px] border border-amber-300/18 bg-amber-400/8 px-4 py-3 text-sm text-amber-100">
      Visible result limits were reached for: {truncated.join(", ")}. Zoom in for denser detail.
    </div>
  );
}

function toggleLayer(
  setVisibility: Dispatch<SetStateAction<LayerVisibility>>,
  key: keyof LayerVisibility,
) {
  setVisibility((current) => ({
    ...current,
    [key]: !current[key],
  }));
}

function layerHelperText(key: keyof LayerVisibility) {
  const copy: Record<keyof LayerVisibility, string> = {
    airports: "Clickable airport markers and viewport browser entries",
    waypoints: "Named fixes and route anchors at higher zoom",
    vors: "VHF navigation beacons",
    ndbs: "Low frequency beacons",
    airways: "Segment lines from the live navdata source",
  };

  return copy[key];
}

function layerCountForKey(layers: MapLayersResponse | null, key: keyof LayerVisibility) {
  if (!layers) {
    return "0";
  }

  const counts: Record<keyof LayerVisibility, string> = {
    airports: String(layers.airports.length),
    waypoints: String(layers.waypoints.length),
    vors: String(layers.vors.length),
    ndbs: String(layers.ndbs.length),
    airways: String(layers.airways.length),
  };

  return counts[key];
}

type InlineErrorProps = {
  message: string;
  className?: string;
};

function InlineError({ message, className }: InlineErrorProps) {
  return (
    <div
      className={`rounded-[18px] border border-rose-300/16 bg-rose-400/8 px-4 py-3 text-sm text-rose-100 ${className ?? ""}`}
    >
      {message}
    </div>
  );
}

type HeroMetricProps = {
  label: string;
  value: string;
  accentClass: string;
};

function HeroMetric({ label, value, accentClass }: HeroMetricProps) {
  return (
    <div className="rounded-[20px] border border-slate-700/55 bg-slate-950/48 px-4 py-3">
      <p className="stat-label">{label}</p>
      <p className={`m-0 mt-2 text-[1.15rem] font-semibold ${accentClass}`}>{value}</p>
    </div>
  );
}

type StatusTileProps = {
  label: string;
  value: string;
  detail: string;
};

function StatusTile({ label, value, detail }: StatusTileProps) {
  return (
    <div className="status-tile">
      <div>
        <p className="stat-label">{label}</p>
        <p className="m-0 mt-2 text-[1rem] font-semibold text-slate-50">{value}</p>
      </div>
      <p className="m-0 max-w-[10rem] text-right text-[0.75rem] leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

type LayerRowProps = {
  label: string;
  helper: string;
  count: string;
  colorClass: string;
  isActive: boolean;
  onClick: () => void;
};

function LayerRow({ label, helper, count, colorClass, isActive, onClick }: LayerRowProps) {
  return (
    <button
      className={
        `grid w-full cursor-pointer gap-2 rounded-[20px] border px-4 py-3 text-left transition duration-200 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400/70 ` +
        (isActive
          ? "border-cyan-300/24 bg-cyan-950/28 text-slate-50"
          : "border-slate-700/60 bg-slate-950/42 text-slate-300 hover:border-cyan-300/20 hover:bg-slate-900/84")
      }
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`legend-dot ${colorClass}`} aria-hidden="true" />
          <span className="font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[0.8rem] text-slate-400">{count}</span>
          <span
            className={
              `rounded-full px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.12em] ` +
              (isActive ? "bg-cyan-300/12 text-cyan-100" : "bg-slate-900/85 text-slate-500")
            }
          >
            {isActive ? "on" : "off"}
          </span>
        </div>
      </div>
      <span className="text-[0.8rem] leading-5 text-slate-500">{helper}</span>
    </button>
  );
}

type MiniDataTileProps = {
  label: string;
  value: string;
};

function MiniDataTile({ label, value }: MiniDataTileProps) {
  return (
    <div className="rounded-[16px] border border-slate-700/55 bg-slate-950/48 px-3 py-3">
      <p className="stat-label">{label}</p>
      <p className="m-0 mt-2 text-[0.98rem] font-semibold text-slate-50">{value}</p>
    </div>
  );
}

type MapBadgeProps = {
  label: string;
  value: string;
};

function MapBadge({ label, value }: MapBadgeProps) {
  return (
    <div className="overlay-card min-w-[120px]">
      <p className="stat-label">{label}</p>
      <p className="m-0 mt-1 font-mono text-sm text-slate-50">{value}</p>
    </div>
  );
}

type LegendItemProps = {
  colorClass: string;
  label: string;
};

function LegendItem({ colorClass, label }: LegendItemProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`legend-dot ${colorClass}`} aria-hidden="true" />
      {label}
    </span>
  );
}

type ProcedureKindChipProps = {
  kind: ProcedureSummary["procedureKind"];
};

function ProcedureKindChip({ kind }: ProcedureKindChipProps) {
  const className = {
    sid: "bg-emerald-400/10 text-emerald-200 border-emerald-300/14",
    star: "bg-sky-400/10 text-sky-200 border-sky-300/14",
    approach: "bg-amber-400/10 text-amber-200 border-amber-300/14",
    procedure: "bg-fuchsia-400/10 text-fuchsia-200 border-fuchsia-300/14",
  }[kind];

  return (
    <span className={`rounded-full border px-2.5 py-1 text-[0.7rem] uppercase tracking-[0.12em] ${className}`}>
      {kind}
    </span>
  );
}

type ProcedureButtonProps = {
  procedure: ProcedureSummary;
  isActive: boolean;
  onClick: () => void;
};

function ProcedureButton({ procedure, isActive, onClick }: ProcedureButtonProps) {
  const kindTone = {
    sid: "text-emerald-300",
    star: "text-sky-300",
    approach: "text-amber-300",
    procedure: "text-fuchsia-300",
  }[procedure.procedureKind];

  return (
    <button
      className={
        `grid w-full cursor-pointer gap-1 rounded-[18px] border px-4 py-3 text-left transition duration-200 motion-reduce:transition-none ` +
        (isActive
          ? "border-cyan-300/30 bg-cyan-950/34 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
          : "border-slate-700/60 bg-slate-950/46 text-slate-300 hover:border-cyan-300/22 hover:bg-slate-900/86")
      }
      type="button"
      onClick={onClick}
      aria-label={procedure.name}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`font-mono text-[0.92rem] ${kindTone}`}>{procedure.name}</span>
        <ProcedureKindChip kind={procedure.procedureKind} />
      </div>
      <span className="text-sm text-slate-200">
        {procedure.procedureType}
        {procedure.runwayName ? ` / RWY ${procedure.runwayName}` : ""}
      </span>
      <span className="text-xs text-slate-500">
        {procedure.airportIdent} / {procedure.legs} legs
      </span>
    </button>
  );
}
