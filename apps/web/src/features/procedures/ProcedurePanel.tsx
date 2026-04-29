import type { ProcedureFilter } from "../app/types";
import type { AirportFeature, ProcedureGeometryResponse, ProcedureSummary } from "../../types/api";
import { procedureFilterOptions } from "../app/types";
import { FilterChip, MiniDataTile, ProcedureButton, ProcedureKindChip } from "../shared/PanelPrimitives";

type ProcedurePanelProps = {
  selectedAirport: AirportFeature | null;
  totalProcedureCount: number;
  visibleProcedureCount: number;
  filteredProcedures: ProcedureSummary[];
  selectedProcedureId: number | null;
  onProcedureSelect: (procedureId: number) => void;
  procedureFilter: ProcedureFilter;
  onProcedureFilterChange: (filter: ProcedureFilter) => void;
  selectedProcedureSummary: ProcedureGeometryResponse["summary"] | null;
};

export function ProcedurePanel({
  selectedAirport,
  totalProcedureCount,
  visibleProcedureCount,
  filteredProcedures,
  selectedProcedureId,
  onProcedureSelect,
  procedureFilter,
  onProcedureFilterChange,
  selectedProcedureSummary,
}: ProcedurePanelProps) {
  return (
    <>
      {selectedAirport ? (
        <div className="mt-4 rounded-[22px] border border-cyan-400/14 bg-cyan-950/16 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="m-0 font-mono text-[1rem] text-amber-300">
                {selectedAirport.ident}
                {selectedAirport.icao ? ` | ${selectedAirport.icao}` : ""}
              </p>
              <p className="m-0 mt-1 text-[1.05rem] font-medium text-slate-50">{selectedAirport.name}</p>
            </div>
            <div className="rounded-full border border-cyan-300/16 bg-slate-950/80 px-3 py-1 text-[0.72rem] uppercase tracking-[0.12em] text-cyan-100">
              active
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
            <MiniDataTile label="Lat" value={selectedAirport.location.lat.toFixed(4)} />
            <MiniDataTile label="Lon" value={selectedAirport.location.lon.toFixed(4)} />
            <MiniDataTile label="Procedures" value={String(totalProcedureCount)} />
          </div>
        </div>
      ) : (
        <div className="overlay-card mt-4">
          <p className="muted-copy text-sm">
            Move the map, search globally, or click a visible airport to inspect procedures.
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
          {visibleProcedureCount} / {totalProcedureCount}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {procedureFilterOptions.map((option) => (
          <FilterChip
            key={option.key}
            label={option.label}
            isActive={procedureFilter === option.key}
            onClick={() => onProcedureFilterChange(option.key)}
          />
        ))}
      </div>

      <div className="mt-4 grid gap-2 pr-1">
        {filteredProcedures.slice(0, 80).map((procedure) => (
          <ProcedureButton
            key={procedure.id}
            procedure={procedure}
            isActive={procedure.id === selectedProcedureId}
            onClick={() => onProcedureSelect(procedure.id)}
          />
        ))}
        {filteredProcedures.length === 0 ? (
          <div className="overlay-card">
            <p className="muted-copy text-sm">No procedures match the current filter.</p>
          </div>
        ) : null}
      </div>

      <hr className="panel-divider" />

      <div>
        <p className="section-kicker">Interpretation</p>
        <h3 className="section-title">Current Notes</h3>
      </div>
      <p className="support-copy mt-3 text-sm">
        Procedure classification now prefers explicit database suffix values where present:
        <span className="font-mono text-slate-100"> D</span> for SID and
        <span className="font-mono text-slate-100"> A</span> for STAR, with geometry-based
        fallback only when the source does not expose that distinction directly.
      </p>

      {selectedProcedureSummary ? (
        <div className="mt-4 rounded-[18px] border border-slate-700/60 bg-slate-950/55 p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="m-0 text-[1rem] font-semibold text-slate-50">{selectedProcedureSummary.name}</p>
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
    </>
  );
}
