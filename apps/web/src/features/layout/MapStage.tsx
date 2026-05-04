import { MapView } from "../map/MapView";
import { MapAirportInfoCard } from "../map/MapAirportInfoCard";
import { FilterChip, LegendItem, MapBadge } from "../shared/PanelPrimitives";
import type {
  BasemapTone,
  LayerVisibility,
  MapFocusRequest,
  RouteMapOverlay,
  RoutePlanningOverlay,
  RoutePlanningSelection,
  ViewportState,
} from "../app/types";
import type {
  AirportFeature,
  AirportWeatherOverviewResponse,
  LatLon,
  MapLayersResponse,
  ProcedureGeometryResponse,
} from "../../types/api";

type MapStageProps = {
  layers: MapLayersResponse | null;
  selectedAirportIdent: string | null;
  selectedProcedure: ProcedureGeometryResponse | null;
  routeOverlay: RouteMapOverlay | null;
  routePlanningOverlay: RoutePlanningOverlay | null;
  selectedAirwayPath: LatLon[];
  focusRequest: MapFocusRequest | null;
  basemapTone: BasemapTone;
  visibility: LayerVisibility;
  selectedAirport: AirportFeature | null;
  selectedWeatherStationId: string | null;
  airportOverview: AirportWeatherOverviewResponse | null;
  weatherError: string | null;
  isWeatherLoading: boolean;
  onViewportChange: (viewport: ViewportState) => void;
  onAirportSelect: (airportIdent: string) => void;
  onAirportInspectorClose: () => void;
  onBasemapToneChange: (tone: BasemapTone) => void;
  onFocusRequestHandled: (requestId: number) => void;
  onPlanningProcedureSelect: (selection: RoutePlanningSelection) => void;
};

export function MapStage({
  layers,
  selectedAirportIdent,
  selectedProcedure,
  routeOverlay,
  routePlanningOverlay,
  selectedAirwayPath,
  focusRequest,
  basemapTone,
  visibility,
  selectedAirport,
  selectedWeatherStationId,
  airportOverview,
  weatherError,
  isWeatherLoading,
  onViewportChange,
  onAirportSelect,
  onAirportInspectorClose,
  onBasemapToneChange,
  onFocusRequestHandled,
  onPlanningProcedureSelect,
}: MapStageProps) {
  const selectedProcedureSummary = selectedProcedure?.summary ?? null;
  const selectedPathCount = (selectedProcedure?.path.length ?? 0) + (selectedProcedure?.missedPath.length ?? 0);
  const selectedRouteLabel = routeOverlay
    ? `${routeOverlay.selection.candidate.departure.ident} -> ${routeOverlay.selection.candidate.arrival.ident}`
    : "idle";
  const hasAirportSelection = Boolean(
    selectedAirportIdent ||
      selectedAirport ||
      airportOverview?.airport ||
      airportOverview?.station ||
      airportOverview?.metar,
  );

  return (
    <main className="min-h-0 xl:overflow-hidden">
      <div className="map-shell grid min-h-[620px] grid-rows-[1fr] xl:h-full xl:min-h-0">
        <MapView
          layers={layers}
          selectedAirportIdent={selectedAirportIdent}
          selectedProcedure={selectedProcedure}
          routeOverlay={routeOverlay}
          routePlanningOverlay={routePlanningOverlay}
          selectedAirwayPath={selectedAirwayPath}
          focusRequest={focusRequest}
          basemapTone={basemapTone}
          visibility={visibility}
          onViewportChange={onViewportChange}
          onAirportSelect={onAirportSelect}
          onFocusRequestHandled={onFocusRequestHandled}
          onPlanningProcedureSelect={onPlanningProcedureSelect}
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

            <div className="grid gap-2 md:grid-cols-4">
              <MapBadge label="Selected" value={selectedAirportIdent ?? "none"} />
              <MapBadge label="Procedure" value={selectedProcedureSummary?.procedureKind ?? "idle"} />
              <MapBadge label="Path Points" value={String(selectedPathCount)} />
              <MapBadge label="Route" value={selectedRouteLabel} />
              <div className="overlay-card pointer-events-auto min-w-[240px] md:col-span-4">
                <p className="stat-label">Basemap</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <FilterChip
                    label="Classic"
                    isActive={basemapTone === "classic"}
                    onClick={() => onBasemapToneChange("classic")}
                  />
                  <FilterChip
                    label="Dark"
                    isActive={basemapTone === "dark"}
                    onClick={() => onBasemapToneChange("dark")}
                  />
                  <FilterChip
                    label="Light"
                    isActive={basemapTone === "light"}
                    onClick={() => onBasemapToneChange("light")}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {hasAirportSelection ? (
          <div className="pointer-events-none absolute right-4 top-[7.5rem] z-[520] w-[min(32rem,calc(100vw-2rem))] md:right-5 lg:top-[7rem]">
            <div className="flex justify-end">
              <div className="pointer-events-auto w-full">
                <MapAirportInfoCard
                  selectedAirport={selectedAirport}
                  selectedAirportIdent={selectedAirportIdent}
                  airportOverview={airportOverview}
                  selectedWeatherStationId={selectedWeatherStationId}
                  isWeatherLoading={isWeatherLoading}
                  weatherError={weatherError}
                  variant="compact"
                  onClose={onAirportInspectorClose}
                  className="mt-0 border-cyan-300/30 bg-slate-950/96 ring-1 ring-cyan-400/10 shadow-[0_30px_85px_rgba(0,0,0,0.52)] backdrop-blur-2xl"
                />
              </div>
            </div>
          </div>
        ) : null}

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
                <LegendItem colorClass="bg-cyan-200" label="Selected route" />
              </div>
            </div>

            {routeOverlay ? (
              <div className="overlay-card">
                <p className="section-kicker">Displayed Route</p>
                <p className="mt-1 text-[1rem] font-semibold text-slate-50">
                  {routeOverlay.selection.candidate.departure.ident} to {routeOverlay.selection.candidate.arrival.ident}
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  Airway {Math.round(routeOverlay.selection.candidate.airwayDistanceNm)} nm / Total{" "}
                  {Math.round(routeOverlay.selection.candidate.totalDistanceNm)} nm
                </p>
              </div>
            ) : selectedProcedureSummary ? (
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
