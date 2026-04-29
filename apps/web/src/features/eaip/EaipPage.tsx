import type { AirportFeature, AirportWeatherOverviewResponse } from "../../types/api";
import { InlineError, MiniDataTile, WeatherDetailRow } from "../shared/PanelPrimitives";
import { compactValues, formatElevation } from "../weather/formatters";

type EaipPageProps = {
  selectedAirport: AirportFeature | null;
  selectedWeatherStationId: string | null;
  airportOverview: AirportWeatherOverviewResponse | null;
  isLoading: boolean;
  error: string | null;
  stationTypes: string;
};

const documentSections = [
  { title: "Airport Charts", detail: "ADC / GND / Parking" },
  { title: "Instrument Departures", detail: "SID / RNAV / text" },
  { title: "Arrivals And Approaches", detail: "STAR / IAC / minima" },
  { title: "Local Notes", detail: "Noise / restrictions / remarks" },
];

export function EaipPage({
  selectedAirport,
  selectedWeatherStationId,
  airportOverview,
  isLoading,
  error,
  stationTypes,
}: EaipPageProps) {
  return (
    <section className="grid gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="section-kicker">eAIP Desk</p>
          <h2 className="section-title">Chart Viewer And Airport Record</h2>
          <p className="support-copy mt-2 max-w-[48rem] text-sm">
            This workspace is reserved for your encrypted eAIP package, chart navigation, and airport
            reference context. The viewer surface is wired as a product shell now so the final chart
            loader can drop into a stable layout.
          </p>
        </div>
        <div className="rounded-full border border-amber-300/18 bg-amber-400/8 px-3 py-2 text-[0.72rem] uppercase tracking-[0.12em] text-amber-100">
          encrypted pack pending
        </div>
      </div>

      {selectedWeatherStationId ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MiniDataTile label="Airport" value={selectedAirport?.name ?? "n/a"} />
            <MiniDataTile label="ICAO / Ident" value={compactValues([selectedAirport?.icao, selectedAirport?.ident])} />
            <MiniDataTile label="Station" value={selectedWeatherStationId} />
            <MiniDataTile label="Document Set" value="preview shell" />
          </div>

          {error ? <InlineError message={error} className="mt-4" /> : null}
          {isLoading ? (
            <div className="overlay-card mt-4">
              <p className="muted-copy text-sm">Loading airport reference context for the eAIP desk...</p>
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
            <div className="rounded-[22px] border border-slate-700/60 bg-slate-950/55 p-4">
              <p className="section-kicker">Document Stack</p>
              <div className="mt-4 grid gap-2">
                {documentSections.map((section) => (
                  <button
                    key={section.title}
                    type="button"
                    className="grid cursor-pointer gap-1 rounded-[16px] border border-slate-700/60 bg-slate-950/56 px-3 py-3 text-left transition duration-200 hover:border-cyan-300/24 hover:bg-slate-900/84 motion-reduce:transition-none"
                  >
                    <span className="text-sm font-semibold text-slate-100">{section.title}</span>
                    <span className="text-[0.8rem] text-slate-500">{section.detail}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[22px] border border-slate-700/60 bg-slate-950/55 p-4">
              <p className="section-kicker">Preview Surface</p>
              <div className="mt-4 rounded-[28px] border border-slate-300/20 bg-[#ede9df] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.34)]">
                <div className="rounded-[24px] border border-black/6 bg-[#f5f2e9] p-5 shadow-[0_16px_32px_rgba(15,23,42,0.14)]">
                  <div className="flex items-center justify-between gap-3 border-b border-black/8 pb-3 text-[#2f3640]">
                    <div>
                      <p className="m-0 text-[0.72rem] uppercase tracking-[0.16em] text-slate-500">Viewer Mock</p>
                      <p className="m-0 mt-1 text-[1rem] font-semibold">
                        {selectedAirport?.ident ?? "No Airport"} Ground Chart
                      </p>
                    </div>
                    <span className="rounded-full border border-black/8 bg-white/60 px-3 py-1 text-[0.68rem] uppercase tracking-[0.12em] text-slate-600">
                      chart sheet
                    </span>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
                    <div className="grid gap-4">
                      <div className="relative aspect-[1.18] overflow-hidden rounded-[20px] border border-black/8 bg-white/65">
                        <div className="absolute inset-x-5 top-5 h-8 rounded-full bg-slate-300/38" />
                        <div className="absolute left-6 top-16 h-[60%] w-[45%] rounded-[22px] border border-slate-400/20 bg-slate-300/24" />
                        <div className="absolute right-6 top-16 h-[22%] w-[34%] rounded-[18px] border border-slate-400/20 bg-sky-100/45" />
                        <div className="absolute bottom-6 left-6 h-[24%] w-[72%] rounded-[18px] border border-slate-400/20 bg-slate-300/20" />
                        <div className="absolute left-[18%] top-[40%] h-2 w-[46%] rotate-[-18deg] rounded-full bg-slate-500/36" />
                        <div className="absolute left-[31%] top-[51%] h-2 w-[42%] rotate-[12deg] rounded-full bg-slate-500/36" />
                        <div className="absolute left-[24%] top-[62%] h-2 w-[52%] rotate-[29deg] rounded-full bg-slate-500/36" />
                      </div>
                    </div>

                    <div className="grid gap-4">
                      <div className="rounded-[18px] border border-black/8 bg-white/56 p-4">
                        <p className="m-0 text-[0.72rem] uppercase tracking-[0.16em] text-slate-500">Legend Strip</p>
                        <div className="mt-3 grid gap-2 text-[0.84rem] text-slate-700">
                          <span>Taxiway labels can be promoted here later.</span>
                          <span>Surface markings and stands can be layered separately.</span>
                          <span>Viewer zoom and page fit controls will attach to this block.</span>
                        </div>
                      </div>
                      <div className="rounded-[18px] border border-black/8 bg-white/56 p-4">
                        <p className="m-0 text-[0.72rem] uppercase tracking-[0.16em] text-slate-500">Import State</p>
                        <p className="m-0 mt-3 text-sm leading-6 text-slate-700">
                          Waiting for encrypted chart package integration. The layout is already sized for
                          a document canvas, thumbnail stack, and airport-specific chart set switching.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {airportOverview ? (
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <div className="rounded-[18px] border border-slate-700/60 bg-slate-950/55 p-4">
                <p className="section-kicker">Airport Record</p>
                <div className="mt-4 grid gap-2">
                  <WeatherDetailRow label="Name" value={airportOverview.airport?.name ?? selectedAirport?.name ?? "n/a"} />
                  <WeatherDetailRow
                    label="ICAO / IATA / FAA"
                    value={compactValues([
                      airportOverview.airport?.icaoId,
                      airportOverview.airport?.iataId,
                      airportOverview.airport?.faaId,
                    ])}
                  />
                  <WeatherDetailRow
                    label="Region"
                    value={compactValues([airportOverview.airport?.state, airportOverview.airport?.country])}
                  />
                  <WeatherDetailRow label="Type" value={airportOverview.airport?.airportType ?? "n/a"} />
                  <WeatherDetailRow
                    label="Elevation"
                    value={formatElevation(airportOverview.airport?.elevationFt, airportOverview.station?.elevationM)}
                  />
                  <WeatherDetailRow
                    label="Runway Count"
                    value={
                      typeof airportOverview.airport?.runwayCount === "number"
                        ? String(airportOverview.airport.runwayCount)
                        : "n/a"
                    }
                  />
                </div>
              </div>

              <div className="rounded-[18px] border border-slate-700/60 bg-slate-950/55 p-4">
                <p className="section-kicker">Observation Station</p>
                <div className="mt-4 grid gap-2">
                  <WeatherDetailRow label="Site" value={airportOverview.station?.site ?? "n/a"} />
                  <WeatherDetailRow
                    label="ICAO / IATA / FAA"
                    value={compactValues([
                      airportOverview.station?.icaoId,
                      airportOverview.station?.iataId,
                      airportOverview.station?.faaId,
                    ])}
                  />
                  <WeatherDetailRow label="Site Types" value={stationTypes} />
                  <WeatherDetailRow
                    label="Priority"
                    value={
                      typeof airportOverview.station?.priority === "number"
                        ? String(airportOverview.station.priority)
                        : "n/a"
                    }
                  />
                  <WeatherDetailRow
                    label="Coordinates"
                    value={compactValues([
                      typeof airportOverview.station?.latitude === "number"
                        ? airportOverview.station.latitude.toFixed(4)
                        : undefined,
                      typeof airportOverview.station?.longitude === "number"
                        ? airportOverview.station.longitude.toFixed(4)
                        : undefined,
                    ])}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="overlay-card mt-5">
          <p className="muted-copy text-sm">
            Select an airport from the map page to preload airport reference context for the eAIP desk.
          </p>
        </div>
      )}
    </section>
  );
}
