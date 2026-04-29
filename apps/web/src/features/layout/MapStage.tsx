import { MapView } from "../map/MapView";
import { LegendItem, MapBadge } from "../shared/PanelPrimitives";
import type { LayerVisibility, ViewportState } from "../app/types";
import type { MapLayersResponse, ProcedureGeometryResponse } from "../../types/api";

type MapStageProps = {
  layers: MapLayersResponse | null;
  selectedAirportIdent: string | null;
  selectedProcedure: ProcedureGeometryResponse | null;
  visibility: LayerVisibility;
  onViewportChange: (viewport: ViewportState) => void;
  onAirportSelect: (airportIdent: string) => void;
};

export function MapStage({
  layers,
  selectedAirportIdent,
  selectedProcedure,
  visibility,
  onViewportChange,
  onAirportSelect,
}: MapStageProps) {
  const selectedProcedureSummary = selectedProcedure?.summary ?? null;
  const selectedPathCount = (selectedProcedure?.path.length ?? 0) + (selectedProcedure?.missedPath.length ?? 0);

  return (
    <main className="min-h-0 xl:overflow-hidden">
      <div className="map-shell grid min-h-[620px] grid-rows-[1fr] xl:h-full xl:min-h-0">
        <MapView
          layers={layers}
          selectedAirportIdent={selectedAirportIdent}
          selectedProcedure={selectedProcedure}
          visibility={visibility}
          onViewportChange={onViewportChange}
          onAirportSelect={onAirportSelect}
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex flex-col gap-3 p-4 md:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="overlay-card max-w-[40rem]">
              <p className="section-kicker">Map Surface</p>
              <h2 className="section-title mt-1">Operational Overview</h2>
              <p className="support-copy mt-2 text-sm">
                Search can now target airports, waypoints, navaids, airways, SID, STAR, and
                approaches separately. Procedure classification now prefers database signals before
                geometry inference.
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
                  Select a procedure search result or airport procedure entry to highlight its path.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
