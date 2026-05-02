import type { AirportFeature, AirportWeatherOverviewResponse } from "../../types/api";
import { MiniDataTile, WeatherDetailRow, WeatherTextPanel } from "../shared/PanelPrimitives";
import {
  compactValues,
  formatElevation,
  formatHpa,
  formatMetarWind,
  formatTemperaturePair,
  formatUnixUtc,
} from "../weather/formatters";

type MapAirportInfoCardProps = {
  selectedAirport: AirportFeature | null;
  selectedAirportIdent?: string | null;
  airportOverview: AirportWeatherOverviewResponse | null;
  selectedWeatherStationId: string | null;
  isWeatherLoading: boolean;
  weatherError: string | null;
  variant?: "full" | "compact";
  className?: string;
  onClose?: () => void;
};

function formatCoordinates(latitude?: number | null, longitude?: number | null) {
  return compactValues([
    typeof latitude === "number" ? latitude.toFixed(4) : undefined,
    typeof longitude === "number" ? longitude.toFixed(4) : undefined,
  ]);
}

function formatRunwaySummary(overview: AirportWeatherOverviewResponse | null, airport: AirportFeature | null) {
  const explicitCount = overview?.airport?.runwayCount;
  if (typeof explicitCount === "number" && explicitCount > 0) {
    return String(explicitCount);
  }

  if (airport?.longestRunwayLength) {
    return `1+ / longest ${airport.longestRunwayLength} m`;
  }

  return "n/a";
}

export function MapAirportInfoCard({
  selectedAirport,
  selectedAirportIdent,
  airportOverview,
  selectedWeatherStationId,
  isWeatherLoading,
  weatherError,
  variant = "full",
  className,
  onClose,
}: MapAirportInfoCardProps) {
  const airportRecord = airportOverview?.airport ?? null;
  const stationRecord = airportOverview?.station ?? null;
  const metar = airportOverview?.metar ?? null;
  const stationTypes = stationRecord?.siteTypes?.length ? stationRecord.siteTypes.join(" / ") : "n/a";
  const displayIdent =
    selectedAirport?.ident ??
    airportRecord?.icaoId ??
    stationRecord?.icaoId ??
    selectedAirportIdent ??
    selectedWeatherStationId;
  const displayIcao =
    selectedAirport?.icao ??
    airportRecord?.icaoId ??
    stationRecord?.icaoId ??
    null;
  const displayName =
    airportRecord?.name ??
    selectedAirport?.name ??
    stationRecord?.site ??
    "Selected airport";
  const displayLatitude =
    airportRecord?.latitude ??
    stationRecord?.latitude ??
    selectedAirport?.location.lat;
  const displayLongitude =
    airportRecord?.longitude ??
    stationRecord?.longitude ??
    selectedAirport?.location.lon;
  const hasSelectionContext = Boolean(displayIdent || airportRecord || stationRecord || metar);

  if (!hasSelectionContext) {
    return (
      <div className={`overlay-card mt-4 ${className ?? ""}`.trim()}>
        <p className="muted-copy text-sm">
          Click an airport on the map or in the viewport list to inspect airport information, METAR,
          coordinates, runway data, and station details.
        </p>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div
        className={`mt-4 rounded-[24px] border p-4 ${className ?? ""}`.trim()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="section-kicker">Airport Inspector</p>
            <p className="m-0 mt-1 font-mono text-[1.05rem] text-amber-300">
              {displayIdent ?? "n/a"}
              {displayIcao && displayIcao !== displayIdent ? ` | ${displayIcao}` : ""}
            </p>
            <p className="m-0 mt-1 text-[1.1rem] font-semibold text-slate-50">{displayName}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[0.72rem] uppercase tracking-[0.12em] text-cyan-100">
              {metar?.flightCategory ?? "info"}
            </div>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-600/80 bg-slate-950/88 text-lg leading-none text-slate-200 transition duration-200 hover:border-cyan-300/36 hover:text-white motion-reduce:transition-none"
                aria-label="Close airport inspector"
              >
                ×
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <MiniDataTile label="Station" value={selectedWeatherStationId ?? "n/a"} />
          <MiniDataTile
            label="Coordinates"
            value={formatCoordinates(displayLatitude, displayLongitude)}
          />
          <MiniDataTile
            label="Runways"
            value={formatRunwaySummary(airportOverview, selectedAirport)}
          />
          <MiniDataTile label="ATIS" value="n/a" />
        </div>

        {weatherError ? (
          <div className="mt-4 rounded-[18px] border border-rose-300/16 bg-rose-400/8 px-4 py-3 text-sm text-rose-100">
            {weatherError}
          </div>
        ) : null}

        {isWeatherLoading ? (
          <div className="overlay-card mt-4">
            <p className="muted-copy text-sm">Loading airport information and current observation...</p>
          </div>
        ) : null}

        <div className="mt-4 grid gap-2">
          <WeatherDetailRow label="METAR" value={metar?.rawText ?? "n/a"} />
          <WeatherDetailRow label="Wind" value={formatMetarWind(metar)} />
          <WeatherDetailRow label="Visibility" value={metar?.visibilitySm ?? "n/a"} />
          <WeatherDetailRow label="QNH" value={formatHpa(metar?.altimeterHpa)} />
          <WeatherDetailRow label="Observed" value={metar ? formatUnixUtc(metar.observedAtUnix) : "n/a"} />
          <WeatherDetailRow label="Station Types" value={stationTypes} />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`mt-4 rounded-[22px] border border-cyan-400/14 bg-cyan-950/16 p-4 ${className ?? ""}`.trim()}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="m-0 font-mono text-[1rem] text-amber-300">
            {displayIdent ?? "n/a"}
            {displayIcao && displayIcao !== displayIdent ? ` | ${displayIcao}` : ""}
          </p>
          <p className="m-0 mt-1 text-[1.05rem] font-medium text-slate-50">
            {displayName}
          </p>
        </div>
        <div className="rounded-full border border-cyan-300/16 bg-slate-950/80 px-3 py-1 text-[0.72rem] uppercase tracking-[0.12em] text-cyan-100">
          active
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <MiniDataTile label="Station" value={selectedWeatherStationId ?? "n/a"} />
        <MiniDataTile label="Flight Cat" value={metar?.flightCategory ?? "n/a"} />
        <MiniDataTile
          label="Observed"
          value={metar ? formatUnixUtc(metar.observedAtUnix) : "n/a"}
        />
        <MiniDataTile
          label="Runways"
          value={formatRunwaySummary(airportOverview, selectedAirport)}
        />
      </div>

      {weatherError ? (
        <div className="mt-4 rounded-[18px] border border-rose-300/16 bg-rose-400/8 px-4 py-3 text-sm text-rose-100">
          {weatherError}
        </div>
      ) : null}

      {isWeatherLoading ? (
        <div className="overlay-card mt-4">
          <p className="muted-copy text-sm">Loading airport information and current observation...</p>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-1 2xl:grid-cols-2">
        <div className="rounded-[18px] border border-slate-700/60 bg-slate-950/55 p-4">
          <p className="section-kicker">Airport Record</p>
          <div className="mt-4 grid gap-2">
            <WeatherDetailRow
              label="ICAO / IATA / FAA"
              value={compactValues([
                airportRecord?.icaoId ?? displayIcao,
                airportRecord?.iataId,
                airportRecord?.faaId,
              ])}
            />
            <WeatherDetailRow
              label="Coordinates"
              value={formatCoordinates(
                displayLatitude,
                displayLongitude,
              )}
            />
            <WeatherDetailRow
              label="Elevation"
              value={formatElevation(airportRecord?.elevationFt, stationRecord?.elevationM)}
            />
            <WeatherDetailRow
              label="Longest Runway"
              value={selectedAirport?.longestRunwayLength ? `${selectedAirport.longestRunwayLength} m` : "n/a"}
            />
            <WeatherDetailRow
              label="Runway Count"
              value={
                typeof airportRecord?.runwayCount === "number"
                  ? String(airportRecord.runwayCount)
                  : "n/a"
              }
            />
            <WeatherDetailRow label="ATIS" value="n/a" />
          </div>
        </div>

        <div className="rounded-[18px] border border-slate-700/60 bg-slate-950/55 p-4">
          <p className="section-kicker">Current METAR</p>
          <div className="mt-4 grid gap-2">
            <WeatherDetailRow label="Wind" value={formatMetarWind(metar)} />
            <WeatherDetailRow label="Visibility" value={metar?.visibilitySm ?? "n/a"} />
            <WeatherDetailRow
              label="Temp / Dew"
              value={formatTemperaturePair(metar?.temperatureC, metar?.dewpointC)}
            />
            <WeatherDetailRow label="QNH" value={formatHpa(metar?.altimeterHpa)} />
            <WeatherDetailRow label="Weather" value={metar?.weather ?? "n/a"} />
            <WeatherDetailRow label="Station Types" value={stationTypes} />
          </div>
        </div>
      </div>

      {metar?.rawText ? (
        <WeatherTextPanel title="Raw METAR" body={metar.rawText} className="mt-4" />
      ) : null}
    </div>
  );
}
