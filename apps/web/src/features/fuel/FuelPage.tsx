import type { AirportFeature, ProcedureGeometryResponse } from "../../types/api";
import { MiniDataTile } from "../shared/PanelPrimitives";

type FuelPageProps = {
  selectedAirport: AirportFeature | null;
  selectedProcedureSummary: ProcedureGeometryResponse["summary"] | null;
};

export function FuelPage({ selectedAirport, selectedProcedureSummary }: FuelPageProps) {
  return (
    <section className="grid gap-4">
      <div>
        <p className="section-kicker">Fuel Desk</p>
        <h2 className="section-title">Trip Fuel, Reserve Logic, And Dispatch Hooks</h2>
        <p className="support-copy mt-2 max-w-[48rem] text-sm">
          This module is shaped for taxi, trip, contingency, alternate, and final reserve planning.
          It will later connect route geometry, airport constraints, and aircraft performance data.
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MiniDataTile label="Airport" value={selectedAirport?.ident ?? "n/a"} />
        <MiniDataTile label="Procedure" value={selectedProcedureSummary?.name ?? "none"} />
        <MiniDataTile label="State" value="planning shell" />
        <MiniDataTile label="Sync" value="manual for now" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-[22px] border border-slate-700/60 bg-slate-950/55 p-5">
          <p className="section-kicker">Fuel Breakdown</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {["Taxi", "Trip", "Contingency", "Alternate", "Final Reserve", "Extra"].map((label) => (
              <div
                key={label}
                className="rounded-[18px] border border-slate-700/55 bg-slate-950/52 px-4 py-4"
              >
                <p className="stat-label">{label}</p>
                <p className="m-0 mt-2 text-[1rem] font-semibold text-slate-50">pending</p>
                <p className="m-0 mt-1 text-[0.8rem] text-slate-500">Awaiting aircraft and route profile inputs.</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[22px] border border-slate-700/60 bg-slate-950/55 p-5">
          <p className="section-kicker">Next Integration</p>
          <div className="mt-4 grid gap-3 text-sm text-slate-300">
            <div className="rounded-[18px] border border-cyan-300/14 bg-cyan-950/16 px-4 py-3">
              Connect route distance, level profile, and alternate airport selection.
            </div>
            <div className="rounded-[18px] border border-slate-700/55 bg-slate-950/52 px-4 py-3">
              Add aircraft-specific burn model and reserve policy presets.
            </div>
            <div className="rounded-[18px] border border-slate-700/55 bg-slate-950/52 px-4 py-3">
              Support export to dispatch sheet and briefing package later.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
