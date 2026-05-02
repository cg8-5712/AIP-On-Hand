import type {
  AirportCommunication,
  AirportFeature,
  AirportWeatherOverviewResponse,
} from "../../types/api";
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

type CommunicationGroup = {
  serviceType: string;
  label: string;
  entries: AirportCommunication[];
};

const communicationPriority: Record<string, number> = {
  atis: 0,
  app: 1,
  dep: 2,
  clr: 3,
  twr: 4,
  gnd: 5,
  rmp: 6,
  ops: 7,
};

function buildCommunicationGroups(communications: AirportCommunication[]): CommunicationGroup[] {
  const grouped = new Map<string, CommunicationGroup>();

  for (const entry of communications) {
    const existing = grouped.get(entry.serviceType);
    if (existing) {
      existing.entries.push(entry);
      continue;
    }

    grouped.set(entry.serviceType, {
      serviceType: entry.serviceType,
      label: entry.label,
      entries: [entry],
    });
  }

  return [...grouped.values()].sort((left, right) => {
    const leftPriority = communicationPriority[left.serviceType] ?? 99;
    const rightPriority = communicationPriority[right.serviceType] ?? 99;

    return leftPriority - rightPriority || left.label.localeCompare(right.label);
  });
}

function formatFrequencyMhz(frequencyMhz?: number | null) {
  if (typeof frequencyMhz !== "number" || Number.isNaN(frequencyMhz)) {
    return "n/a";
  }

  return frequencyMhz.toFixed(3);
}

function formatCommunicationEntryName(entry: AirportCommunication, index: number, total: number) {
  const trimmedName = entry.name?.trim();
  if (trimmedName) {
    return trimmedName;
  }

  return total > 1 ? `${entry.label} ${index + 1}` : entry.label;
}

export function AirportInfoPage({
  selectedAirport,
  selectedWeatherStationId,
  airportOverview,
  isLoading,
  error,
  stationTypes,
}: AirportInfoPageProps) {
  const communications = airportOverview?.communications ?? [];
  const communicationGroups = buildCommunicationGroups(communications);

  return (
    <section className="grid gap-4">
      <div>
        <p className="section-kicker">Airport Info</p>
        <h2 className="section-title">Airport And Station Reference</h2>
        <p className="support-copy mt-2 max-w-[48rem] text-sm">
          Static airport data, station metadata, and the complete communication frequency list for the
          currently selected airport.
        </p>
      </div>

      {selectedWeatherStationId ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MiniDataTile label="Station" value={selectedWeatherStationId} />
            <MiniDataTile label="Airport" value={selectedAirport?.name ?? "n/a"} />
            <MiniDataTile
              label="ICAO / Ident"
              value={compactValues([selectedAirport?.icao, selectedAirport?.ident])}
            />
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
                  <WeatherDetailRow
                    label="Name"
                    value={airportOverview.airport?.name ?? selectedAirport?.name ?? "n/a"}
                  />
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
                    value={compactValues([
                      airportOverview.airport?.state,
                      airportOverview.airport?.country,
                    ])}
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
                    value={formatElevation(
                      airportOverview.airport?.elevationFt,
                      airportOverview.station?.elevationM,
                    )}
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
                    value={compactValues([
                      airportOverview.station?.state,
                      airportOverview.station?.country,
                    ])}
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

              {communicationGroups.length > 0 ? (
                <div className="rounded-[18px] border border-slate-700/60 bg-slate-950/55 p-4 xl:col-span-2">
                  <p className="section-kicker">Communications</p>
                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    {communicationGroups.map((group) => (
                      <div
                        key={group.serviceType}
                        className="rounded-[16px] border border-slate-700/50 bg-slate-950/42 p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="m-0 text-[0.82rem] font-semibold uppercase tracking-[0.12em] text-cyan-100">
                            {group.label}
                          </p>
                          <span className="rounded-full bg-slate-900/85 px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.12em] text-slate-400">
                            {group.entries.length}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-2">
                          {group.entries.map((entry, index) => (
                            <WeatherDetailRow
                              key={`${group.serviceType}-${entry.frequencyMhz}-${entry.name ?? "unnamed"}-${index}`}
                              label={formatCommunicationEntryName(entry, index, group.entries.length)}
                              value={formatFrequencyMhz(entry.frequencyMhz)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
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
