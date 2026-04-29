import type { AppPage } from "../app/types";
import type { SearchResultItem } from "../../types/api";
import { HeroMetric, InlineError, SearchResultButton, StatusTile } from "../shared/PanelPrimitives";

type DetailHeaderProps = {
  activePage: AppPage;
  searchQuery: string;
  deferredSearchQuery: string;
  isSearching: boolean;
  searchError: string | null;
  searchResults: SearchResultItem[];
  onSearchQueryChange: (query: string) => void;
  onSearchSelection: (result: SearchResultItem) => void;
  backendStatus: string;
  airacCycle: string;
  selectedAirportLabel: string;
  selectedProcedureLabel: string;
  weatherFlightCategory: string;
  stationTypes: string;
  bootstrapError?: string;
  layerError?: string | null;
  procedureError?: string | null;
};

const pageCopy: Record<AppPage, { title: string; description: string }> = {
  map: {
    title: "Map Detail",
    description: "Layer controls, viewport airport browser, and procedure inspection stay beside the live map.",
  },
  weather: {
    title: "Weather Detail",
    description: "METAR, TAF, NOAA decoded text, and rolling cycle history for the currently selected airport.",
  },
  route: {
    title: "Route Detail",
    description: "This panel is reserved for route construction, legality checks, and export workflow.",
  },
  "airport-info": {
    title: "Airport Detail",
    description: "Airport and station reference data stay visible while the map remains active on the right.",
  },
  settings: {
    title: "Settings Detail",
    description: "Display, source, and local-environment controls will live here.",
  },
};

export function DetailHeader({
  activePage,
  searchQuery,
  deferredSearchQuery,
  isSearching,
  searchError,
  searchResults,
  onSearchQueryChange,
  onSearchSelection,
  backendStatus,
  airacCycle,
  selectedAirportLabel,
  selectedProcedureLabel,
  weatherFlightCategory,
  stationTypes,
  bootstrapError,
  layerError,
  procedureError,
}: DetailHeaderProps) {
  const copy = pageCopy[activePage];

  return (
    <div className="sticky top-0 z-10 border-b border-slate-700/60 bg-slate-950/88 px-5 py-5 backdrop-blur-xl">
      <div className="flex flex-col gap-5">
        <div>
          <p className="section-kicker">Workbench</p>
          <h1 className="hero-title text-[1.7rem] sm:text-[2rem]">{copy.title}</h1>
          <p className="support-copy mt-2 max-w-[48rem] text-sm">{copy.description}</p>
        </div>

        <div>
          <label className="block text-[0.8rem] text-slate-400" htmlFor="global-search">
            Search navdata and procedures
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
            <div className="scroll-panel mt-3 max-h-[16rem] overflow-y-auto rounded-[20px] border border-slate-700/60 bg-slate-950/80 p-2">
              {isSearching ? <p className="m-0 px-3 py-2 text-sm text-slate-400">Searching navdata...</p> : null}
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

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <HeroMetric
            label="Backend"
            value={backendStatus}
            accentClass={backendStatus === "ok" ? "text-emerald-300" : "text-amber-200"}
          />
          <HeroMetric label="AIRAC" value={airacCycle} accentClass="text-cyan-200" />
          <HeroMetric label="Flight Cat" value={weatherFlightCategory} accentClass="text-amber-200" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <StatusTile label="Selected Airport" value={selectedAirportLabel} detail={stationTypes} />
          <StatusTile label="Procedure" value={selectedProcedureLabel} detail="active map selection" />
          <StatusTile label="Current Page" value={copy.title} detail="right-side map remains visible" />
        </div>

        {bootstrapError ? <InlineError message={bootstrapError} /> : null}
        {layerError ? <InlineError message={layerError} /> : null}
        {procedureError ? <InlineError message={procedureError} /> : null}
      </div>
    </div>
  );
}
