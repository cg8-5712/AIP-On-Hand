import type { MapLayersResponse } from "../../types/api";
import type { LayerVisibility } from "../app/types";
import { LayerRow, MiniDataTile } from "../shared/PanelPrimitives";

const layerConfig = [
  { key: "airports", label: "Airports", colorClass: "bg-amber-300" },
  { key: "waypointsEnroute", label: "Enroute WPT", colorClass: "bg-sky-300" },
  { key: "waypointsTerminal", label: "Airport WPT", colorClass: "bg-sky-400" },
  { key: "vors", label: "VOR", colorClass: "bg-emerald-300" },
  { key: "ndbs", label: "NDB", colorClass: "bg-pink-300" },
  { key: "airways", label: "Airways", colorClass: "bg-cyan-300" },
] as const;

type LeftSidebarProps = {
  panelClass: string;
  layers: MapLayersResponse | null;
  visibility: LayerVisibility;
  onToggleLayer: (key: keyof LayerVisibility) => void;
};

export function LeftSidebar({
  panelClass,
  layers,
  visibility,
  onToggleLayer,
}: LeftSidebarProps) {
  return (
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
            onClick={() => onToggleLayer(layer.key)}
          />
        ))}
      </div>

      {renderTruncationNotice(layers)}

      <hr className="panel-divider" />

      <div>
        <p className="section-kicker">Viewport Snapshot</p>
        <h2 className="section-title">Live map counts</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Airport browsing now stays on the map canvas and global search. This panel keeps only layer controls and
          current viewport totals.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <MiniDataTile label="Airports" value={String(layers?.airports.length ?? 0)} />
        <MiniDataTile label="Airways" value={String(layers?.airways.length ?? 0)} />
        <MiniDataTile label="Waypoints" value={String(layers?.waypoints.length ?? 0)} />
        <MiniDataTile label="VOR / NDB" value={`${layers?.vors.length ?? 0} / ${layers?.ndbs.length ?? 0}`} />
      </div>

      <div className="mt-4 rounded-[18px] border border-slate-700/60 bg-slate-950/52 px-4 py-4 text-sm leading-6 text-slate-300">
        Click airports directly on the map to inspect procedures, or use the header search when you need to jump by
        ICAO, ident, or name.
      </div>
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
    waypointsEnroute: "Public fixes and airway anchors without airport association",
    waypointsTerminal: "Airport-associated fixes identified by airport_id",
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
    waypointsEnroute: String(layers.waypoints.filter((waypoint) => !waypoint.isAirportWaypoint).length),
    waypointsTerminal: String(layers.waypoints.filter((waypoint) => waypoint.isAirportWaypoint).length),
    vors: String(layers.vors.length),
    ndbs: String(layers.ndbs.length),
    airways: String(layers.airways.length),
  };

  return counts[key];
}
