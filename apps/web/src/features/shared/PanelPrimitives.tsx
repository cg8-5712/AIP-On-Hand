import type { ProcedureKind, ProcedureSummary, SearchResultItem, TafForecastSegment } from "../../types/api";
import { forecastLabel, formatCloudLayers } from "../weather/formatters";

type InlineErrorProps = {
  message: string;
  className?: string;
};

export function InlineError({ message, className }: InlineErrorProps) {
  return (
    <div
      className={`rounded-[18px] border border-rose-300/16 bg-rose-400/8 px-4 py-3 text-sm text-rose-100 ${className ?? ""}`}
    >
      {message}
    </div>
  );
}

type HeroMetricProps = {
  label: string;
  value: string;
  accentClass: string;
};

export function HeroMetric({ label, value, accentClass }: HeroMetricProps) {
  return (
    <div className="rounded-[20px] border border-slate-700/55 bg-slate-950/48 px-4 py-3">
      <p className="stat-label">{label}</p>
      <p className={`m-0 mt-2 text-[1.15rem] font-semibold ${accentClass}`}>{value}</p>
    </div>
  );
}

type StatusTileProps = {
  label: string;
  value: string;
  detail: string;
};

export function StatusTile({ label, value, detail }: StatusTileProps) {
  return (
    <div className="status-tile">
      <div>
        <p className="stat-label">{label}</p>
        <p className="m-0 mt-2 text-[1rem] font-semibold text-slate-50">{value}</p>
      </div>
      <p className="m-0 max-w-[10rem] text-right text-[0.75rem] leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

type LayerRowProps = {
  label: string;
  helper: string;
  count: string;
  colorClass: string;
  isActive: boolean;
  onClick: () => void;
};

export function LayerRow({ label, helper, count, colorClass, isActive, onClick }: LayerRowProps) {
  return (
    <button
      className={
        `grid w-full cursor-pointer gap-2 rounded-[20px] border px-4 py-3 text-left transition duration-200 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400/70 ` +
        (isActive
          ? "border-cyan-300/24 bg-cyan-950/28 text-slate-50"
          : "border-slate-700/60 bg-slate-950/42 text-slate-300 hover:border-cyan-300/20 hover:bg-slate-900/84")
      }
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`legend-dot ${colorClass}`} aria-hidden="true" />
          <span className="font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[0.8rem] text-slate-400">{count}</span>
          <span
            className={
              `rounded-full px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.12em] ` +
              (isActive ? "bg-cyan-300/12 text-cyan-100" : "bg-slate-900/85 text-slate-500")
            }
          >
            {isActive ? "on" : "off"}
          </span>
        </div>
      </div>
      <span className="text-[0.8rem] leading-5 text-slate-500">{helper}</span>
    </button>
  );
}

type SearchResultButtonProps = {
  result: SearchResultItem;
  onClick: () => void;
};

export function SearchResultButton({ result, onClick }: SearchResultButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid w-full cursor-pointer gap-1 rounded-[16px] border border-slate-700/60 bg-slate-950/56 px-3 py-3 text-left transition duration-200 hover:border-cyan-300/24 hover:bg-slate-900/86 motion-reduce:transition-none"
      aria-label={result.ident}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-[0.92rem] text-slate-100">{result.ident}</span>
        <ProcedureKindChip kind={searchEntityToChip(result)} />
      </div>
      <span className="text-sm text-slate-300">{result.name || result.airportName || "Unnamed result"}</span>
      <span className="text-xs text-slate-500">
        {result.airportIdent ? `${result.airportIdent} / ` : ""}
        {result.entityType.toUpperCase()}
        {result.runwayName ? ` / RWY ${result.runwayName}` : ""}
      </span>
    </button>
  );
}

type MiniDataTileProps = {
  label: string;
  value: string;
};

export function MiniDataTile({ label, value }: MiniDataTileProps) {
  return (
    <div className="rounded-[16px] border border-slate-700/55 bg-slate-950/48 px-3 py-3">
      <p className="stat-label">{label}</p>
      <p className="m-0 mt-2 text-[0.98rem] font-semibold text-slate-50">{value}</p>
    </div>
  );
}

type MapBadgeProps = {
  label: string;
  value: string;
};

export function MapBadge({ label, value }: MapBadgeProps) {
  return (
    <div className="overlay-card min-w-[120px]">
      <p className="stat-label">{label}</p>
      <p className="m-0 mt-1 font-mono text-sm text-slate-50">{value}</p>
    </div>
  );
}

type LegendItemProps = {
  colorClass: string;
  label: string;
};

export function LegendItem({ colorClass, label }: LegendItemProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`legend-dot ${colorClass}`} aria-hidden="true" />
      {label}
    </span>
  );
}

type FilterChipProps = {
  label: string;
  isActive: boolean;
  onClick: () => void;
};

export function FilterChip({ label, isActive, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        `cursor-pointer rounded-full border px-3 py-2 text-[0.74rem] uppercase tracking-[0.12em] transition duration-200 motion-reduce:transition-none ` +
        (isActive
          ? "border-cyan-300/28 bg-cyan-950/34 text-cyan-100"
          : "border-slate-700/60 bg-slate-950/46 text-slate-400 hover:border-cyan-300/22 hover:text-slate-200")
      }
      aria-pressed={isActive}
    >
      {label}
    </button>
  );
}

type ProcedureKindChipProps = {
  kind: ProcedureKind;
};

export function ProcedureKindChip({ kind }: ProcedureKindChipProps) {
  const className = {
    sid: "bg-emerald-400/10 text-emerald-200 border-emerald-300/14",
    star: "bg-sky-400/10 text-sky-200 border-sky-300/14",
    approach: "bg-amber-400/10 text-amber-200 border-amber-300/14",
    procedure: "bg-fuchsia-400/10 text-fuchsia-200 border-fuchsia-300/14",
  }[kind];

  return (
    <span className={`rounded-full border px-2.5 py-1 text-[0.7rem] uppercase tracking-[0.12em] ${className}`}>
      {kind}
    </span>
  );
}

type ProcedureButtonProps = {
  procedure: ProcedureSummary;
  isActive: boolean;
  onClick: () => void;
};

export function ProcedureButton({ procedure, isActive, onClick }: ProcedureButtonProps) {
  const kindTone = {
    sid: "text-emerald-300",
    star: "text-sky-300",
    approach: "text-amber-300",
    procedure: "text-fuchsia-300",
  }[procedure.procedureKind];

  return (
    <button
      className={
        `grid w-full cursor-pointer gap-1 rounded-[18px] border px-4 py-3 text-left transition duration-200 motion-reduce:transition-none ` +
        (isActive
          ? "border-cyan-300/30 bg-cyan-950/34 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
          : "border-slate-700/60 bg-slate-950/46 text-slate-300 hover:border-cyan-300/22 hover:bg-slate-900/86")
      }
      type="button"
      onClick={onClick}
      aria-label={procedure.name}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`font-mono text-[0.92rem] ${kindTone}`}>{procedure.name}</span>
        <ProcedureKindChip kind={procedure.procedureKind} />
      </div>
      <span className="text-sm text-slate-200">
        {procedure.procedureType}
        {procedure.runwayName ? ` / RWY ${procedure.runwayName}` : ""}
      </span>
      <span className="text-xs text-slate-500">
        {procedure.airportIdent} / {procedure.legs} legs
      </span>
    </button>
  );
}

type WeatherDetailRowProps = {
  label: string;
  value: string;
  className?: string;
};

export function WeatherDetailRow({ label, value, className }: WeatherDetailRowProps) {
  return (
    <div className={`flex items-start justify-between gap-4 text-sm ${className ?? ""}`}>
      <span className="text-slate-500">{label}</span>
      <span className="text-right text-slate-200">{value}</span>
    </div>
  );
}

type WeatherTextPanelProps = {
  title: string;
  body: string;
  className?: string;
};

export function WeatherTextPanel({ title, body, className }: WeatherTextPanelProps) {
  return (
    <div className={`rounded-[18px] border border-slate-700/60 bg-slate-950/55 p-4 ${className ?? ""}`}>
      <p className="section-kicker">{title}</p>
      <p className="m-0 mt-3 whitespace-pre-wrap font-mono text-[0.82rem] leading-6 text-slate-200">{body}</p>
    </div>
  );
}

type ForecastSegmentCardProps = {
  segment: TafForecastSegment;
};

export function ForecastSegmentCard({ segment }: ForecastSegmentCardProps) {
  return (
    <div className="rounded-[16px] border border-slate-700/60 bg-slate-950/56 px-3 py-3">
      <p className="m-0 text-[0.72rem] uppercase tracking-[0.12em] text-slate-500">{forecastLabel(segment)}</p>
      <div className="mt-2 grid gap-1 text-sm text-slate-200">
        <span>
          Wind: {segment.windDirection ?? "VRB"} /{" "}
          {typeof segment.windSpeedKt === "number" ? `${segment.windSpeedKt} kt` : "n/a"}
        </span>
        <span>Visibility: {segment.visibilitySm ?? "n/a"}</span>
        <span>Weather: {segment.weather ?? "none"}</span>
        <span>Clouds: {formatCloudLayers(segment.clouds)}</span>
      </div>
    </div>
  );
}

function searchEntityToChip(result: SearchResultItem): ProcedureKind {
  switch (result.entityType) {
    case "sid":
      return "sid";
    case "star":
      return "star";
    case "approach":
      return "approach";
    default:
      return "procedure";
  }
}
