import type { AirportFeature, MapLayersResponse } from "../../types/api";
import type { LayerVisibility } from "../app/types";
import { LayerRow, MiniDataTile } from "../shared/PanelPrimitives";

const layerConfig = [
  { key: "airports", label: "Airports", colorClass: "bg-amber-300" },
  { key: "waypoints", label: "Waypoints", colorClass: "bg-sky-300" },
  { key: "vors", label: "VOR", colorClass: "bg-emerald-300" },
  { key: "ndbs", label: "NDB", colorClass: "bg-pink-300" },
  { key: "airways", label: "Airways", colorClass: "bg-cyan-300" },
] as const;

type LeftSidebarProps = {
  panelClass: string;
  layers: MapLayersResponse | null;
  visibility: LayerVisibility;
  onToggleLayer: (key: keyof LayerVisibility) => void;
  airportFilter: string;
  onAirportFilterChange: (value: string) => void;
  visibleAirports: AirportFeature[];
  selectedAirportIdent: string | null;
  onAirportSelect: (airport: AirportFeature) => void;
};

export function LeftSidebar({
  panelClass,
  layers,
  visibility,
  onToggleLayer,
  airportFilter,
  onAirportFilterChange,
  visibleAirports,
  selectedAirportIdent,
  onAirportSelect,
}: LeftSidebarProps) {
  return (
    <aside className={`${panelClass} flex min-h-0 flex-col xl:overflow-hidden`}>
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
            onClick={() => onToggleLayer(layer.key)}
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
            onChange={(event) => onAirportFilterChange(event.target.value)}
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

      <ul className="scroll-panel mt-4 grid min-h-[240px] flex-1 list-none gap-3 overflow-y-auto overscroll-contain pr-1 xl:min-h-0">
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
              onClick={() => onAirportSelect(airport)}
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
