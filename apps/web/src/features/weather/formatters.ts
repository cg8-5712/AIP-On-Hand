import type { MetarObservation, ProcedureKind, TafForecastSegment, WeatherCloudLayer } from "../../types/api";

export function formatUnixUtc(epochSeconds?: number | null) {
  if (typeof epochSeconds !== "number" || Number.isNaN(epochSeconds)) {
    return "n/a";
  }

  return new Date(epochSeconds * 1000).toISOString().replace(".000Z", "Z");
}

export function formatTemperaturePair(temp?: number | null, dew?: number | null) {
  const tempText = formatDecimal(temp, 1);
  const dewText = formatDecimal(dew, 1);
  return `${tempText} / ${dewText}`;
}

export function formatHpa(value?: number | null) {
  if (typeof value !== "number") {
    return "n/a";
  }

  return `${value.toFixed(1)} hPa`;
}

export function formatMetarWind(metar?: MetarObservation | null) {
  if (!metar) {
    return "n/a";
  }

  const direction = metar.windDirection ?? "VRB";
  const speed = typeof metar.windSpeedKt === "number" ? `${metar.windSpeedKt} kt` : "n/a";
  const gust = typeof metar.windGustKt === "number" ? ` G${metar.windGustKt}` : "";

  return `${direction} / ${speed}${gust}`;
}

export function formatCloudLayers(clouds: WeatherCloudLayer[]) {
  if (clouds.length === 0) {
    return "none";
  }

  return clouds
    .map((cloud) => {
      const top = typeof cloud.topFt === "number" ? `-${cloud.topFt}` : "";
      const base = typeof cloud.baseFt === "number" ? `${cloud.baseFt}` : "n/a";
      return `${cloud.cover} ${base}${top} ft`;
    })
    .join(", ");
}

export function formatDecimal(value?: number | null, digits = 0) {
  if (typeof value !== "number") {
    return "n/a";
  }

  return value.toFixed(digits);
}

export function compactValues(values: Array<string | null | undefined>) {
  const filtered = values.map((value) => value?.trim()).filter(Boolean) as string[];
  return filtered.length > 0 ? filtered.join(" / ") : "n/a";
}

export function formatElevation(elevationFt?: number | null, elevationM?: number | null) {
  const feet = typeof elevationFt === "number" ? `${elevationFt.toFixed(0)} ft` : null;
  const meters = typeof elevationM === "number" ? `${elevationM.toFixed(0)} m` : null;

  return compactValues([feet, meters]);
}

export function forecastLabel(segment: TafForecastSegment) {
  const change = segment.changeType ?? "BASE";
  const from = formatUnixUtc(segment.validFromUnix);
  const to = formatUnixUtc(segment.validToUnix);
  return `${change} / ${from} to ${to}`;
}

export function metarFlightCategoryToChip(metar?: MetarObservation | null): ProcedureKind {
  switch (metar?.flightCategory?.toUpperCase()) {
    case "VFR":
      return "sid";
    case "MVFR":
      return "star";
    case "IFR":
    case "LIFR":
      return "approach";
    default:
      return "procedure";
  }
}
