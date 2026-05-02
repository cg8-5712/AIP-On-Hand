import type {
  AirportFeature,
  MapLayersResponse,
  ProcedureGeometryResponse,
  ProcedureSummary,
} from "../../types/api";
import type { LayerVisibility, ProcedureFilter } from "../app/types";
import { panelClass } from "../app/types";
import { LeftSidebar } from "../layout/LeftSidebar";
import { ProcedurePanel } from "../procedures/ProcedurePanel";

type MapDetailPageProps = {
  layers: MapLayersResponse | null;
  visibility: LayerVisibility;
  onToggleLayer: (key: keyof LayerVisibility) => void;
  airportFilter: string;
  onAirportFilterChange: (value: string) => void;
  visibleAirports: AirportFeature[];
  selectedAirportIdent: string | null;
  onAirportSelect: (airport: AirportFeature) => void;
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

export function MapDetailPage({
  layers,
  visibility,
  onToggleLayer,
  airportFilter,
  onAirportFilterChange,
  visibleAirports,
  selectedAirportIdent,
  onAirportSelect,
  selectedAirport,
  totalProcedureCount,
  visibleProcedureCount,
  filteredProcedures,
  selectedProcedureId,
  onProcedureSelect,
  procedureFilter,
  onProcedureFilterChange,
  selectedProcedureSummary,
}: MapDetailPageProps) {
  return (
    <div className="grid gap-4">
      <LeftSidebar
        panelClass={panelClass}
        layers={layers}
        visibility={visibility}
        onToggleLayer={onToggleLayer}
        airportFilter={airportFilter}
        onAirportFilterChange={onAirportFilterChange}
        visibleAirports={visibleAirports}
        selectedAirportIdent={selectedAirportIdent}
        onAirportSelect={onAirportSelect}
      />

      <section className={`${panelClass} flex min-h-0 flex-col xl:overflow-hidden`}>
        <div className="px-5 pt-5">
          <p className="section-kicker">Procedure Desk</p>
          <h2 className="section-title">Selected Airport Procedures</h2>
        </div>

        <div className="scroll-panel min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          <ProcedurePanel
            selectedAirport={selectedAirport}
            totalProcedureCount={totalProcedureCount}
            visibleProcedureCount={visibleProcedureCount}
            filteredProcedures={filteredProcedures}
            selectedProcedureId={selectedProcedureId}
            onProcedureSelect={onProcedureSelect}
            procedureFilter={procedureFilter}
            onProcedureFilterChange={onProcedureFilterChange}
            selectedProcedureSummary={selectedProcedureSummary}
          />
        </div>
      </section>
    </div>
  );
}
