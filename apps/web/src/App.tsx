import { useDeferredValue, useEffect, useState } from "react";
import { MapView } from "./features/map/MapView";
import { getHealth, getSampleAirports, getVersion } from "./lib/api";
import type { AirportSummary, HealthResponse, VersionResponse } from "./types/api";

type BootstrapState = {
  health?: HealthResponse;
  version?: VersionResponse;
  airports: AirportSummary[];
  error?: string;
};

const initialState: BootstrapState = {
  airports: [],
};

const panelClass =
  "rounded-[18px] border border-slate-300/12 bg-slate-950/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur";

const sectionTitleClass = "m-0 text-[0.95rem] font-bold text-slate-50";

const statusCardBaseClass =
  "flex items-center justify-between rounded-[14px] border border-slate-300/12 px-4 py-3";

export default function App() {
  const [state, setState] = useState<BootstrapState>(initialState);
  const [query, setQuery] = useState("");
  const [showAirports, setShowAirports] = useState(true);
  const [showRoute, setShowRoute] = useState(true);
  const [selectedAirportId, setSelectedAirportId] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [health, version, airports] = await Promise.all([
          getHealth(),
          getVersion(),
          getSampleAirports(),
        ]);

        if (!active) {
          return;
        }

        setState({
          health,
          version,
          airports,
        });
      } catch (error) {
        if (!active) {
          return;
        }

        const message = error instanceof Error ? error.message : "Unknown bootstrap failure";
        setState({
          airports: [],
          error: message,
        });
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  const normalizedQuery = deferredQuery.trim().toLowerCase();

  const filteredAirports = state.airports.filter((airport) => {
    if (!normalizedQuery) {
      return true;
    }

    return (
      airport.icao.toLowerCase().includes(normalizedQuery) ||
      airport.name.toLowerCase().includes(normalizedQuery)
    );
  });

  const activeAirportId =
    filteredAirports.some((airport) => airport.id === selectedAirportId)
      ? selectedAirportId
      : filteredAirports[0]?.id ?? null;

  const routePreview = filteredAirports.map((airport) => airport.icao).join("  ->  ");

  return (
    <div className="grid min-h-screen md:grid-cols-[minmax(300px,360px)_1fr]">
      <aside className="flex flex-col gap-4 border-b border-slate-300/18 bg-slate-950/85 p-5 backdrop-blur md:border-r md:border-b-0">
        <div className={`${panelClass} pt-[1.1rem]`}>
          <p className="mb-1 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-sky-200">
            Phase 0 Skeleton
          </p>
          <h1 className="m-0 text-[2rem] font-bold text-slate-50">AIP On Hand</h1>
          <p className="m-0 mt-2 leading-6 text-slate-300">
            Browser-first aviation planning shell with a Rust service boundary and a Leaflet map
            surface.
          </p>
        </div>

        <div className={panelClass}>
          <p className={sectionTitleClass}>Fixture Filter</p>
          <label className="mt-3 grid gap-2 text-[0.82rem] text-slate-400" htmlFor="airport-filter">
            <span>Search fixtures</span>
            <input
              id="airport-filter"
              name="airport-filter"
              type="search"
              placeholder="ICAO or airport name"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full rounded-[14px] border border-slate-300/20 bg-slate-950/90 px-4 py-3 text-slate-50 outline-none transition duration-200 placeholder:text-slate-500 focus-visible:border-emerald-500/70 focus-visible:ring-[3px] focus-visible:ring-emerald-500/15 motion-reduce:transition-none"
            />
          </label>
        </div>

        <div className={panelClass}>
          <p className={sectionTitleClass}>Backend Link</p>
          <div className="mt-3 grid gap-3">
            <StatusCard
              label="Health"
              value={state.health ? state.health.status : "pending"}
              tone={state.health?.status === "ok" ? "good" : "muted"}
            />
            <StatusCard
              label="Service"
              value={state.version?.service ?? "unreachable"}
              tone={state.version ? "good" : "muted"}
            />
            <StatusCard
              label="Version"
              value={state.version?.version ?? "n/a"}
              tone={state.version ? "good" : "muted"}
            />
            <StatusCard
              label="Visible airports"
              value={String(filteredAirports.length)}
              tone={filteredAirports.length > 0 ? "good" : "muted"}
            />
          </div>
          {state.error ? <p className="mt-3 leading-6 text-rose-300">{state.error}</p> : null}
        </div>

        <div className={panelClass}>
          <div className="flex items-baseline justify-between gap-3">
            <p className={sectionTitleClass}>Layers</p>
            <span className="text-[0.78rem] uppercase tracking-[0.08em] text-slate-500">
              Phase 0 toggles
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <LayerToggle
              label="Airports"
              isActive={showAirports}
              onClick={() => setShowAirports((value) => !value)}
            />
            <LayerToggle
              label="Route"
              isActive={showRoute}
              onClick={() => setShowRoute((value) => !value)}
            />
          </div>
        </div>

        <div className={panelClass}>
          <p className={sectionTitleClass}>Map Fixture</p>
          <ul className="mt-3 grid list-none gap-3 p-0">
            {filteredAirports.map((airport) => (
              <li key={airport.id} className="m-0">
                <button
                  className={
                    `grid w-full cursor-pointer gap-1 rounded-[14px] border px-4 py-3 text-left transition duration-200 motion-reduce:transition-none ` +
                    (airport.id === activeAirportId
                      ? "border-emerald-500/55 bg-emerald-950/60 text-slate-100"
                      : "border-slate-300/12 bg-sky-950/45 text-slate-300 hover:border-cyan-300/35 hover:bg-sky-950/75")
                  }
                  type="button"
                  onClick={() => setSelectedAirportId(airport.id)}
                  aria-label={airport.name}
                >
                  <strong className="font-mono text-[0.92rem] text-amber-300">{airport.icao}</strong>
                  <span>{airport.name}</span>
                </button>
              </li>
            ))}
            {filteredAirports.length === 0 ? (
              <li className="m-0 leading-6 text-slate-300">
                No fixture airports match the current filter.
              </li>
            ) : null}
          </ul>
        </div>

        <div className={panelClass}>
          <div className="flex items-baseline justify-between gap-3">
            <p className={sectionTitleClass}>Route Strip</p>
            <span className="text-[0.78rem] uppercase tracking-[0.08em] text-slate-500">
              Preview
            </span>
          </div>
          <p className="mt-3 break-words font-mono leading-7 text-cyan-300">
            {routePreview || "Waiting for route fixture data."}
          </p>
        </div>

        <div className={panelClass}>
          <p className={sectionTitleClass}>Immediate Next Slice</p>
          <p className="m-0 mt-3 leading-6 text-slate-300">
            Replace the fixture endpoint with canonical airport and waypoint DTOs, then move the
            filter into a Rust search endpoint with map-driven highlight state.
          </p>
        </div>
      </aside>

      <main className="grid gap-4 p-5 pt-0 md:grid-rows-[auto_1fr] md:pt-5">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-1 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-sky-200">
              Leaflet + OpenStreetMap Basemap
            </p>
            <h2 className="m-0 text-2xl font-bold text-slate-50">Map Surface</h2>
          </div>
          <p className="m-0 max-w-[28rem] leading-6 text-slate-300 md:text-right">
            The basemap stays generic. Aviation entities render as separate overlays from the Rust
            API.
          </p>
        </div>

        <MapView
          airports={filteredAirports}
          highlightedAirportId={activeAirportId}
          showAirports={showAirports}
          showRoute={showRoute}
        />
      </main>
    </div>
  );
}

type StatusCardProps = {
  label: string;
  value: string;
  tone: "good" | "muted";
};

function StatusCard({ label, value, tone }: StatusCardProps) {
  const toneClass =
    tone === "good" ? "bg-cyan-950/45" : "bg-slate-900/75";

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
