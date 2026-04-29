import type { AirportFeature, AirportWeatherOverviewResponse } from "../../types/api";
import { MiniDataTile, WeatherDetailRow } from "../shared/PanelPrimitives";
import { compactValues, formatElevation } from "../weather/formatters";

type AirportInfoPageProps = {
  selectedAirport: AirportFeature | null;
  selectedWeatherStationId: string | null;
  airportOverview: AirportWeatherOverviewResponse | null;
  isLoading: boolean;
  error: string | null;
  stationTypes: string;
};

export function AirportInfoPage({
  selectedAirport,
  selectedWeatherStationId,
  airportOverview,
  isLoading,
  error,
  stationTypes,
}: AirportInfoPageProps) {
  return (
    <section className="grid gap-4">
      <div>
        <p className="section-kicker">Airport Info Page</p>
        <h2 className="section-title">Airport And Observation Station Profile</h2>
        <p className="support-copy mt-2 max-w-[48rem] text-sm">
          This page is scoped to static and semi-static airport data: identifiers, source, elevation,
          runway count, station capabilities, and observation site metadata.
        </p>
      </div>

      {selectedWeatherStationId ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MiniDataTile label="Station" value={selectedWeatherStationId} />
            <MiniDataTile label="Airport" value={selectedAirport?.name ?? "n/a"} />
            <MiniDataTile label="ICAO / Ident" value={compactValues([selectedAirport?.icao, selectedAirport?.ident])} />
            <MiniDataTile label="Station Types" value={stationTypes} />
          </div>

          {error ? (
            <div className="mt-4 rounded-[18px] border border-rose-300/16 bg-rose-400/8 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          {isLoading ? (
            <div className="overlay-card mt-4">
              <p className="muted-copy text-sm">Loading airport and station reference data...</p>
            </div>
          ) : null}

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
                  <WeatherDetailRow label="Source" value={airportOverview.airport?.source ?? "n/a"} />
                  <WeatherDetailRow label="Type" value={airportOverview.airport?.airportType ?? "n/a"} />
                  <WeatherDetailRow
                    label="Coordinates"
                    value={compactValues([
                      typeof airportOverview.airport?.latitude === "number"
                        ? airportOverview.airport.latitude.toFixed(4)
                        : undefined,
                      typeof airportOverview.airport?.longitude === "number"
                        ? airportOverview.airport.longitude.toFixed(4)
                        : undefined,
                    ])}
                  />
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
                  <WeatherDetailRow
                    label="Magnetic Declination"
                    value={airportOverview.airport?.magneticDeclination ?? "n/a"}
                  />
                  <WeatherDetailRow label="Owner" value={airportOverview.airport?.owner ?? "n/a"} />
                </div>
              </div>

              <div className="rounded-[18px] border border-slate-700/60 bg-slate-950/55 p-4">
                <p className="section-kicker">Station Record</p>
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
                  <WeatherDetailRow
                    label="Region"
                    value={compactValues([airportOverview.station?.state, airportOverview.station?.country])}
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
                  <WeatherDetailRow
                    label="Elevation"
                    value={formatElevation(undefined, airportOverview.station?.elevationM)}
                  />
                  <WeatherDetailRow
                    label="Priority"
                    value={
                      typeof airportOverview.station?.priority === "number"
                        ? String(airportOverview.station.priority)
                        : "n/a"
                    }
                  />
                  <WeatherDetailRow label="Site Types" value={stationTypes} />
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="overlay-card mt-5">
          <p className="muted-copy text-sm">
            Select an airport from the map page to inspect airport and station reference data.
          </p>
        </div>
      )}
    </section>
  );
}
