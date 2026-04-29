import type { AirportFeature, AirportWeatherOverviewResponse } from "../../types/api";
import {
  ForecastSegmentCard,
  InlineError,
  MiniDataTile,
  ProcedureKindChip,
  WeatherDetailRow,
  WeatherTextPanel,
} from "../shared/PanelPrimitives";
import {
  formatCloudLayers,
  formatHpa,
  formatMetarWind,
  formatTemperaturePair,
  formatUnixUtc,
  metarFlightCategoryToChip,
} from "./formatters";

type WeatherPageProps = {
  selectedAirport: AirportFeature | null;
  selectedWeatherStationId: string | null;
  airportOverview: AirportWeatherOverviewResponse | null;
  weatherError: string | null;
  isWeatherLoading: boolean;
  weatherHistoryHours: number;
  weatherFlightCategory: string;
  weatherObservedAt: string;
  onToggleWeatherHistory: () => void;
};

export function WeatherPage({
  selectedAirport,
  selectedWeatherStationId,
  airportOverview,
  weatherError,
  isWeatherLoading,
  weatherHistoryHours,
  weatherFlightCategory,
  weatherObservedAt,
  onToggleWeatherHistory,
}: WeatherPageProps) {
  return (
    <section className="grid gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="section-kicker">Weather Page</p>
          <h2 className="section-title">METAR, TAF, And NOAA Text</h2>
          <p className="support-copy mt-2 max-w-[48rem] text-sm">
            This page is isolated from the map workflow. It follows the current selected airport but
            owns weather-centric presentation, source fallbacks, and NOAA cycle inspection.
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleWeatherHistory}
          className="cursor-pointer rounded-full border border-cyan-300/24 bg-cyan-950/28 px-3 py-2 text-[0.72rem] uppercase tracking-[0.12em] text-cyan-100 transition duration-200 hover:border-cyan-300/40 hover:bg-cyan-950/46 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
          disabled={!selectedWeatherStationId || isWeatherLoading}
        >
          {weatherHistoryHours === 24 ? "Hide NOAA 24h" : "Load NOAA 24h"}
        </button>
      </div>

      {selectedWeatherStationId ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MiniDataTile label="Station" value={selectedWeatherStationId} />
            <MiniDataTile label="Airport" value={selectedAirport?.name ?? "n/a"} />
            <MiniDataTile label="Flight Cat" value={weatherFlightCategory} />
            <MiniDataTile label="Obs UTC" value={weatherObservedAt} />
          </div>

          {weatherError ? <InlineError message={weatherError} className="mt-4" /> : null}
          {isWeatherLoading ? (
            <div className="overlay-card mt-4">
              <p className="muted-copy text-sm">Loading airport conditions and source fallbacks...</p>
            </div>
          ) : null}

          {airportOverview ? (
            <>
              {airportOverview.warnings.length > 0 ? (
                <div className="mt-4 rounded-[18px] border border-amber-300/18 bg-amber-400/8 px-4 py-3 text-sm text-amber-100">
                  {airportOverview.warnings.join(" ")}
                </div>
              ) : null}

              {airportOverview.metar ? (
                <div className="mt-4 rounded-[18px] border border-slate-700/60 bg-slate-950/55 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="section-kicker">Latest METAR</p>
                      <p className="m-0 mt-1 text-[1rem] font-semibold text-slate-50">
                        {airportOverview.metar.icaoId}
                      </p>
                    </div>
                    <ProcedureKindChip kind={metarFlightCategoryToChip(airportOverview.metar)} />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <MiniDataTile label="Wind" value={formatMetarWind(airportOverview.metar)} />
                    <MiniDataTile label="Visibility" value={airportOverview.metar.visibilitySm ?? "n/a"} />
                    <MiniDataTile
                      label="Temp / Dew"
                      value={formatTemperaturePair(
                        airportOverview.metar.temperatureC,
                        airportOverview.metar.dewpointC,
                      )}
                    />
                    <MiniDataTile label="QNH" value={formatHpa(airportOverview.metar.altimeterHpa)} />
                  </div>
                  <div className="mt-4 grid gap-2">
                    <WeatherDetailRow label="Weather" value={airportOverview.metar.weather ?? "none"} />
                    <WeatherDetailRow label="Clouds" value={formatCloudLayers(airportOverview.metar.clouds)} />
                  </div>
                  <WeatherTextPanel
                    title="Raw observation"
                    body={airportOverview.metar.rawText}
                    className="mt-4"
                  />
                </div>
              ) : null}

              {airportOverview.noaa.currentDecoded ? (
                <WeatherTextPanel
                  title={`NOAA decoded METAR${airportOverview.noaa.currentDecoded.issuedAt ? ` / ${airportOverview.noaa.currentDecoded.issuedAt}` : ""}`}
                  body={airportOverview.noaa.currentDecoded.text}
                  className="mt-4"
                />
              ) : null}

              {airportOverview.noaa.currentRaw ? (
                <WeatherTextPanel
                  title={`NOAA raw METAR${airportOverview.noaa.currentRaw.issuedAt ? ` / ${airportOverview.noaa.currentRaw.issuedAt}` : ""}`}
                  body={airportOverview.noaa.currentRaw.text}
                  className="mt-4"
                />
              ) : null}

              {airportOverview.taf ? (
                <div className="mt-4 rounded-[18px] border border-slate-700/60 bg-slate-950/55 p-4">
                  <p className="section-kicker">Latest TAF</p>
                  <p className="m-0 mt-1 text-[1rem] font-semibold text-slate-50">
                    {airportOverview.taf.icaoId}
                  </p>
                  <p className="m-0 mt-1 text-xs text-slate-500">
                    Valid {formatUnixUtc(airportOverview.taf.validFromUnix)} to{" "}
                    {formatUnixUtc(airportOverview.taf.validToUnix)}
                  </p>
                  <WeatherTextPanel title="Raw forecast" body={airportOverview.taf.rawText} className="mt-4" />
                  {airportOverview.taf.forecastSegments.length > 0 ? (
                    <div className="mt-4 grid gap-2 xl:grid-cols-2">
                      {airportOverview.taf.forecastSegments.slice(0, 6).map((segment, index) => (
                        <ForecastSegmentCard
                          key={`${segment.validFromUnix ?? index}-${segment.changeType ?? "base"}`}
                          segment={segment}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {weatherHistoryHours > 0 ? (
                <div className="mt-4 rounded-[18px] border border-slate-700/60 bg-slate-950/55 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="section-kicker">NOAA Rolling Cycles</p>
                      <p className="m-0 mt-1 text-sm text-slate-300">Recent raw METAR lines by UTC cycle.</p>
                    </div>
                    <span className="rounded-full bg-slate-900/85 px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.12em] text-slate-400">
                      {airportOverview.noaa.recentCycles.length}
                    </span>
                  </div>
                  <div className="scroll-panel mt-4 max-h-[18rem] overflow-y-auto pr-1">
                    {airportOverview.noaa.recentCycles.length > 0 ? (
                      <div className="grid gap-2">
                        {airportOverview.noaa.recentCycles.map((entry) => (
                          <div
                            key={`${entry.cycleLabel}-${entry.rawText}`}
                            className="rounded-[16px] border border-slate-700/60 bg-slate-950/56 px-3 py-3"
                          >
                            <p className="m-0 text-[0.72rem] uppercase tracking-[0.12em] text-slate-500">
                              {entry.cycleLabel}
                            </p>
                            <p className="m-0 mt-2 font-mono text-[0.82rem] leading-6 text-slate-200">
                              {entry.rawText}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="m-0 text-sm text-slate-400">
                        No rolling NOAA cycle entries were found for this station.
                      </p>
                    )}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </>
      ) : (
        <div className="overlay-card mt-5">
          <p className="muted-copy text-sm">Select an airport from the map page to load weather and station details.</p>
        </div>
      )}
    </section>
  );
}
