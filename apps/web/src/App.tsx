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

const panelClass =
  "rounded-[18px] border border-slate-300/12 bg-slate-950/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur";

const sectionTitleClass = "m-0 text-[0.95rem] font-bold text-slate-50";

const statusCardBaseClass =
  "flex items-center justify-between rounded-[14px] border border-slate-300/12 px-4 py-3";

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

  return (
    <div className="grid min-h-screen md:grid-cols-[minmax(340px,420px)_1fr]">
      <aside className="flex flex-col gap-4 border-b border-slate-300/18 bg-slate-950/85 p-5 backdrop-blur md:border-r md:border-b-0">
        <div className={`${panelClass} pt-[1.1rem]`}>
          <p className="mb-1 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-sky-200">
            Live Navdata Shell
          </p>
          <h1 className="m-0 text-[2rem] font-bold text-slate-50">AIP On Hand</h1>
          <p className="m-0 mt-2 leading-6 text-slate-300">
            SQLite-backed map layers from Little Navmap Navigraph data, with airport procedure
            selection and highlight flow.
          </p>
        </div>

        <div className={panelClass}>
          <p className={sectionTitleClass}>Backend Link</p>
          <div className="mt-3 grid gap-3">
            <StatusCard
              label="Health"
              value={bootstrap.health ? bootstrap.health.status : "pending"}
              tone={bootstrap.health?.status === "ok" ? "good" : "muted"}
            />
            <StatusCard
              label="Service"
              value={bootstrap.version?.service ?? "unreachable"}
              tone={bootstrap.version ? "good" : "muted"}
            />
            <StatusCard
              label="Version"
              value={bootstrap.version?.version ?? "n/a"}
              tone={bootstrap.version ? "good" : "muted"}
            />
            <StatusCard
              label="AIRAC"
              value={procedureMetadata?.airacCycle ?? "loading"}
              tone={procedureMetadata ? "good" : "muted"}
            />
          </div>
          {bootstrap.error ? <p className="mt-3 leading-6 text-rose-300">{bootstrap.error}</p> : null}
          {layerError ? <p className="mt-3 leading-6 text-rose-300">{layerError}</p> : null}
        </div>

        <div className={panelClass}>
          <div className="flex items-baseline justify-between gap-3">
            <p className={sectionTitleClass}>Layers</p>
            <span className="text-[0.78rem] uppercase tracking-[0.08em] text-slate-500">
              Visible toggles
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <LayerToggle
              label="Airports"
              isActive={visibility.airports}
              onClick={() => toggleLayer(setVisibility, "airports")}
            />
            <LayerToggle
              label="Waypoints"
              isActive={visibility.waypoints}
              onClick={() => toggleLayer(setVisibility, "waypoints")}
            />
            <LayerToggle
              label="VOR"
              isActive={visibility.vors}
              onClick={() => toggleLayer(setVisibility, "vors")}
            />
            <LayerToggle
              label="NDB"
              isActive={visibility.ndbs}
              onClick={() => toggleLayer(setVisibility, "ndbs")}
            />
            <LayerToggle
              label="Airways"
              isActive={visibility.airways}
              onClick={() => toggleLayer(setVisibility, "airways")}
            />
          </div>
        </div>

        <div className={panelClass}>
          <div className="flex items-baseline justify-between gap-3">
            <p className={sectionTitleClass}>Visible Data</p>
            <span className="text-[0.78rem] uppercase tracking-[0.08em] text-slate-500">
              Current viewport
            </span>
          </div>
          <div className="mt-3 grid gap-3">
            <StatusCard label="Airports" value={String(layers?.airports.length ?? 0)} tone="good" />
            <StatusCard label="Waypoints" value={String(layers?.waypoints.length ?? 0)} tone="muted" />
            <StatusCard label="VOR" value={String(layers?.vors.length ?? 0)} tone="muted" />
            <StatusCard label="NDB" value={String(layers?.ndbs.length ?? 0)} tone="muted" />
            <StatusCard label="Airways" value={String(layers?.airways.length ?? 0)} tone="muted" />
          </div>
          {renderTruncationNotice(layers)}
        </div>

        <div className={panelClass}>
          <p className={sectionTitleClass}>Visible Airports</p>
          <label className="mt-3 grid gap-2 text-[0.82rem] text-slate-400" htmlFor="airport-filter">
            <span>Filter current viewport</span>
            <input
              id="airport-filter"
              name="airport-filter"
              type="search"
              placeholder="ICAO, ident, or airport name"
              value={airportFilter}
              onChange={(event) => setAirportFilter(event.target.value)}
              className="w-full rounded-[14px] border border-slate-300/20 bg-slate-950/90 px-4 py-3 text-slate-50 outline-none transition duration-200 placeholder:text-slate-500 focus-visible:border-emerald-500/70 focus-visible:ring-[3px] focus-visible:ring-emerald-500/15 motion-reduce:transition-none"
            />
          </label>
          <ul className="mt-3 grid max-h-[20rem] list-none gap-3 overflow-y-auto pr-1">
            {visibleAirports.slice(0, 40).map((airport) => (
              <li key={airport.id} className="m-0">
                <button
                  className={
                    `grid w-full cursor-pointer gap-1 rounded-[14px] border px-4 py-3 text-left transition duration-200 motion-reduce:transition-none ` +
                    (airport.ident === selectedAirportIdent
                      ? "border-emerald-500/55 bg-emerald-950/60 text-slate-100"
                      : "border-slate-300/12 bg-sky-950/45 text-slate-300 hover:border-cyan-300/35 hover:bg-sky-950/75")
                  }
                  type="button"
                  onClick={() => setSelectedAirportIdent(airport.ident)}
                  aria-label={airport.name}
                >
                  <strong className="font-mono text-[0.92rem] text-amber-300">
                    {airport.ident}
                    {airport.icao ? ` | ${airport.icao}` : ""}
                  </strong>
                  <span>{airport.name}</span>
                </button>
              </li>
            ))}
            {visibleAirports.length === 0 ? (
              <li className="m-0 leading-6 text-slate-300">No visible airports match the current filter.</li>
            ) : null}
          </ul>
        </div>

        <div className={panelClass}>
          <div className="flex items-baseline justify-between gap-3">
            <p className={sectionTitleClass}>Selected Airport</p>
            <span className="text-[0.78rem] uppercase tracking-[0.08em] text-slate-500">
              Procedures
            </span>
          </div>
          {selectedAirport ? (
            <div className="mt-3 grid gap-3">
              <div className="rounded-[14px] border border-slate-300/12 bg-slate-900/80 px-4 py-3">
                <p className="m-0 font-mono text-sm text-amber-300">
                  {selectedAirport.ident}
                  {selectedAirport.icao ? ` | ${selectedAirport.icao}` : ""}
                </p>
                <p className="m-0 mt-1 text-slate-100">{selectedAirport.name}</p>
                <p className="m-0 mt-1 text-sm text-slate-400">
                  {selectedAirport.location.lat.toFixed(4)}, {selectedAirport.location.lon.toFixed(4)}
                </p>
              </div>

              <div className="grid gap-2">
                {(airportProcedures?.procedures ?? []).slice(0, 60).map((procedure) => (
                  <ProcedureButton
                    key={procedure.id}
                    procedure={procedure}
                    isActive={procedure.id === selectedProcedureId}
                    onClick={() => setSelectedProcedureId(procedure.id)}
                  />
                ))}
                {airportProcedures?.procedures.length === 0 ? (
                  <p className="m-0 leading-6 text-slate-300">No procedures were returned for this airport.</p>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="mt-3 m-0 leading-6 text-slate-300">Move the map or select a visible airport to inspect procedures.</p>
          )}
          {procedureError ? <p className="mt-3 leading-6 text-rose-300">{procedureError}</p> : null}
        </div>

        <div className={panelClass}>
          <p className={sectionTitleClass}>Highlight Notes</p>
          <p className="m-0 mt-3 leading-6 text-slate-300">
            This database stores many procedures inside the <span className="font-mono text-slate-100">approach</span> and
            <span className="font-mono text-slate-100"> approach_leg</span> tables. SID/STAR labels are inferred from leg
            geometry when explicit classification is not available in the schema.
          </p>
          {selectedProcedureSummary ? (
            <div className="mt-3 rounded-[14px] border border-slate-300/12 bg-slate-900/80 px-4 py-3">
              <p className="m-0 text-slate-100">
                <span className="font-semibold">{selectedProcedureSummary.name}</span>
                {" | "}
                {selectedProcedureSummary.procedureKind.toUpperCase()}
              </p>
              <p className="m-0 mt-1 text-sm text-slate-400">
                {selectedProcedureSummary.procedureType}
                {selectedProcedureSummary.runwayName
                  ? ` | RWY ${selectedProcedureSummary.runwayName}`
                  : ""}
                {` | ${selectedProcedureSummary.legs} legs`}
              </p>
            </div>
          ) : null}
        </div>
      </aside>

      <main className="grid gap-4 p-5 pt-0 md:grid-rows-[auto_1fr] md:pt-5">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-1 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-sky-200">
              Leaflet + SQLite Navigraph
            </p>
            <h2 className="m-0 text-2xl font-bold text-slate-50">Operational Map Surface</h2>
          </div>
          <p className="m-0 max-w-[36rem] leading-6 text-slate-300 md:text-right">
            Airports, airways, waypoints, VOR, and NDB now load from the real SQLite navdata file.
            Procedure selection highlights the decoded geometry path on top of the live map.
          </p>
        </div>

        <MapView
          layers={layers}
          selectedAirportIdent={selectedAirportIdent}
          selectedProcedure={selectedProcedureGeometry}
          visibility={visibility}
          onViewportChange={setViewport}
          onAirportSelect={setSelectedAirportIdent}
        />
      </main>
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
    <p className="mt-3 m-0 leading-6 text-amber-200">
      Visible result limits were reached for: {truncated.join(", ")}. Zoom in for denser detail.
    </p>
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

type StatusCardProps = {
  label: string;
  value: string;
  tone: "good" | "muted";
};

function StatusCard({ label, value, tone }: StatusCardProps) {
  const toneClass = tone === "good" ? "bg-cyan-950/45" : "bg-slate-900/75";

  return (
    <div className={`${statusCardBaseClass} ${toneClass}`}>
      <span className="text-[0.85rem] text-slate-400">{label}</span>
      <strong className="text-[0.95rem] text-slate-100">{value}</strong>
    </div>
  );
}

type LayerToggleProps = {
  label: string;
  isActive: boolean;
  onClick: () => void;
};

function LayerToggle({ label, isActive, onClick }: LayerToggleProps) {
  return (
    <button
      className={
        `cursor-pointer rounded-full border px-4 py-2.5 transition duration-200 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500/75 ` +
        (isActive
          ? "border-emerald-500/45 bg-emerald-950/60 text-slate-50"
          : "border-slate-300/16 bg-slate-900/80 text-slate-300 hover:border-cyan-300/35")
      }
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
    >
      {label}
    </button>
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
        `grid w-full cursor-pointer gap-1 rounded-[14px] border px-4 py-3 text-left transition duration-200 motion-reduce:transition-none ` +
        (isActive
          ? "border-cyan-300/45 bg-cyan-950/50 text-slate-100"
          : "border-slate-300/12 bg-slate-900/80 text-slate-300 hover:border-cyan-300/35 hover:bg-slate-900")
      }
      type="button"
      onClick={onClick}
      aria-label={procedure.name}
    >
      <span className={`font-mono text-[0.9rem] ${kindTone}`}>{procedure.name}</span>
      <span className="text-sm text-slate-200">
        {procedure.procedureKind.toUpperCase()} | {procedure.procedureType}
        {procedure.runwayName ? ` | RWY ${procedure.runwayName}` : ""}
      </span>
      <span className="text-xs text-slate-500">
        {procedure.airportIdent} | {procedure.legs} legs
      </span>
    </button>
  );
}
