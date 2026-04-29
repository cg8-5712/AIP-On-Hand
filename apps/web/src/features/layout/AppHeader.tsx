import type { ProcedureSummary, SearchResultItem } from "../../types/api";
import { HeroMetric, InlineError, SearchResultButton, StatusTile } from "../shared/PanelPrimitives";

type AppHeaderProps = {
  searchQuery: string;
  deferredSearchQuery: string;
  isSearching: boolean;
  searchError: string | null;
  searchResults: SearchResultItem[];
  onSearchQueryChange: (query: string) => void;
  onSearchSelection: (result: SearchResultItem) => void;
  backendStatus: string;
  serviceName: string;
  serviceVersion: string;
  airacCycle: string;
  viewportSummary: string;
  activeLayerCount: number;
  selectedProcedureSummary: ProcedureSummary | null;
  weatherFlightCategory: string;
  weatherObservedAt: string;
  stationTypes: string;
  selectedWeatherStationId: string | null;
  bootstrapError?: string;
  layerError?: string | null;
  procedureError?: string | null;
};

export function AppHeader({
  searchQuery,
  deferredSearchQuery,
  isSearching,
  searchError,
  searchResults,
  onSearchQueryChange,
  onSearchSelection,
  backendStatus,
  serviceName,
  serviceVersion,
  airacCycle,
  viewportSummary,
  activeLayerCount,
  selectedProcedureSummary,
  weatherFlightCategory,
  weatherObservedAt,
  stationTypes,
  selectedWeatherStationId,
  bootstrapError,
  layerError,
  procedureError,
}: AppHeaderProps) {
  return (
    <header className="layout-panel overflow-hidden px-5 py-5 sm:px-6 lg:px-7">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)]">
        <div className="flex flex-col gap-4">
          <div>
            <p className="section-kicker">Web Flight Planning Surface</p>
            <h1 className="hero-title">AIP On Hand</h1>
          </div>

          <p className="support-copy max-w-[56rem] text-[1.03rem]">
            Real navdata is now driving the map. Airport selection now also fans out into live
            weather, airport basics, and NOAA text products through the backend service boundary.
          </p>

          <div className="max-w-[58rem]">
            <label className="block text-[0.8rem] text-slate-400" htmlFor="global-search">
              Search all navdata
              <input
                id="global-search"
                name="global-search"
                type="search"
                placeholder="Airport, waypoint, airway, SID, STAR, approach"
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                className="input-shell"
              />
            </label>

            {(isSearching || searchError || searchResults.length > 0 || deferredSearchQuery.trim().length >= 2) && (
              <div className="scroll-panel mt-3 max-h-[18rem] overflow-y-auto rounded-[20px] border border-slate-700/60 bg-slate-950/80 p-2">
                {isSearching ? (
                  <p className="m-0 px-3 py-2 text-sm text-slate-400">Searching navdata...</p>
                ) : null}
                {searchError ? <InlineError message={searchError} /> : null}
                {!isSearching && !searchError && searchResults.length === 0 ? (
                  <p className="m-0 px-3 py-2 text-sm text-slate-400">No matching navdata results.</p>
                ) : null}
                <div className="grid gap-2">
                  {searchResults.map((result) => (
                    <SearchResultButton
                      key={result.id}
                      result={result}
                      onClick={() => onSearchSelection(result)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <HeroMetric
              label="Backend"
              value={backendStatus}
              accentClass={backendStatus === "ok" ? "text-emerald-300" : "text-amber-200"}
            />
            <HeroMetric label="AIRAC" value={airacCycle} accentClass="text-cyan-200" />
            <HeroMetric label="Viewport" value={viewportSummary} accentClass="text-slate-100" />
            <HeroMetric
              label="Active Layers"
              value={String(activeLayerCount)}
              accentClass="text-amber-200"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <StatusTile label="Service" value={serviceName} detail={serviceVersion} />
          <StatusTile
            label="Procedure"
            value={selectedProcedureSummary?.name ?? "none"}
            detail={
              selectedProcedureSummary
                ? `${selectedProcedureSummary.procedureKind.toUpperCase()} / ${selectedProcedureSummary.legs} legs`
                : "select an airport"
            }
          />
          <StatusTile
            label="Flight Category"
            value={weatherFlightCategory}
            detail={weatherObservedAt === "n/a" ? "weather idle" : `obs ${weatherObservedAt}`}
          />
          <StatusTile
            label="Station Types"
            value={stationTypes}
            detail={selectedWeatherStationId ?? "no station"}
          />
        </div>
      </div>

      {bootstrapError ? <InlineError message={bootstrapError} className="mt-4" /> : null}
      {layerError ? <InlineError message={layerError} className="mt-4" /> : null}
      {procedureError ? <InlineError message={procedureError} className="mt-4" /> : null}
    </header>
  );
}
