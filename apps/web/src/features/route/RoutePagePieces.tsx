import type { RoutePlanCandidate } from "../../types/api";
import type { RouteSelectionTone, WorkflowStep } from "./RoutePage.types";
import { formatAirwaySequence, formatAltitudeBand, formatDirection, formatDistance } from "./routePlanning";

type CandidateCardProps = {
  candidate: RoutePlanCandidate;
  index: number;
  isActive: boolean;
  onActivate: () => void;
  departureSelectionLabel?: string | null;
  arrivalSelectionLabel?: string | null;
  transitionSelectionLabel?: string | null;
  approachSelectionLabel?: string | null;
  approachStatusText?: string | null;
  approachCountText?: string | null;
};

export function ProcedureChip({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/35 ${
        isActive
          ? "border-slate-100/80 bg-slate-100/20 text-slate-50 shadow-[0_10px_24px_rgba(255,255,255,0.06)]"
          : "border-slate-300/18 bg-slate-300/8 text-slate-200 hover:border-slate-200/40 hover:bg-slate-200/12"
      }`}
    >
      {label}
    </button>
  );
}

export function WorkflowStepCard({ step, label, isActive, isComplete }: WorkflowStep) {
  return (
    <div
      className={`min-w-0 rounded-[18px] border px-3 py-3 transition ${
        isActive
          ? "border-cyan-300/45 bg-cyan-300/10 shadow-[0_16px_36px_rgba(56,189,248,0.12)]"
          : isComplete
            ? "border-emerald-300/24 bg-emerald-300/8"
            : "border-slate-700/65 bg-slate-950/45"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[0.72rem] font-semibold ${
            isActive
              ? "border-cyan-200/45 bg-cyan-300/18 text-cyan-50"
              : isComplete
                ? "border-emerald-200/30 bg-emerald-300/14 text-emerald-50"
                : "border-slate-300/18 bg-slate-300/8 text-slate-300"
          }`}
        >
          {step}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={`m-0 truncate text-[0.68rem] uppercase tracking-[0.16em] ${
              isActive ? "text-cyan-100" : isComplete ? "text-emerald-100" : "text-slate-400"
            }`}
          >
            {label}
          </p>
          <p
            className={`mt-1 text-[0.72rem] font-medium ${
              isActive ? "text-cyan-50" : isComplete ? "text-emerald-50" : "text-slate-400"
            }`}
          >
            {isActive ? "Current" : isComplete ? "Ready" : "Pending"}
          </p>
        </div>
      </div>
    </div>
  );
}

export function SelectionSnapshotField({
  label,
  value,
  hint,
  tone = "slate",
}: {
  label: string;
  value: string;
  hint?: string | null;
  tone?: RouteSelectionTone;
}) {
  const toneClasses =
    tone === "emerald"
      ? { label: "text-emerald-200/75", value: "text-emerald-50", border: "border-emerald-300/14 bg-emerald-300/6" }
      : tone === "amber"
        ? { label: "text-amber-200/75", value: "text-amber-50", border: "border-amber-300/14 bg-amber-300/6" }
        : tone === "orange"
          ? { label: "text-orange-200/75", value: "text-orange-50", border: "border-orange-300/14 bg-orange-300/6" }
          : tone === "fuchsia"
            ? { label: "text-fuchsia-200/75", value: "text-fuchsia-50", border: "border-fuchsia-300/14 bg-fuchsia-300/6" }
            : tone === "sky"
              ? { label: "text-sky-200/75", value: "text-sky-50", border: "border-sky-300/14 bg-sky-300/6" }
              : { label: "text-slate-400", value: "text-slate-100", border: "border-slate-700/60 bg-slate-950/45" };

  return (
    <div className={`rounded-[18px] border px-4 py-3 ${toneClasses.border}`}>
      <p className={`m-0 text-[0.68rem] uppercase tracking-[0.22em] ${toneClasses.label}`}>{label}</p>
      <p className={`mt-2 break-words font-mono text-sm ${toneClasses.value}`}>{value}</p>
      {hint ? <p className="mt-2 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function SetupFlowRow({
  label,
  value,
  hint,
  tone = "slate",
  actionLabel,
  onAction,
}: {
  label: string;
  value: string;
  hint?: string | null;
  tone?: Exclude<RouteSelectionTone, "sky">;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const toneClasses =
    tone === "emerald"
      ? {
          border: "border-emerald-300/16 bg-emerald-300/7",
          label: "text-emerald-200/75",
          value: "text-emerald-50",
          button:
            "border-emerald-300/30 bg-emerald-300/10 text-emerald-100 hover:border-emerald-200/60 hover:bg-emerald-300/18",
        }
      : tone === "amber"
        ? {
            border: "border-amber-300/16 bg-amber-300/7",
            label: "text-amber-200/75",
            value: "text-amber-50",
            button:
              "border-amber-300/30 bg-amber-300/10 text-amber-100 hover:border-amber-200/60 hover:bg-amber-300/18",
          }
        : tone === "orange"
          ? {
              border: "border-orange-300/16 bg-orange-300/7",
              label: "text-orange-200/75",
              value: "text-orange-50",
              button:
                "border-orange-300/30 bg-orange-300/10 text-orange-100 hover:border-orange-200/60 hover:bg-orange-300/18",
            }
          : tone === "fuchsia"
            ? {
                border: "border-fuchsia-300/16 bg-fuchsia-300/7",
                label: "text-fuchsia-200/75",
                value: "text-fuchsia-50",
                button:
                  "border-fuchsia-300/30 bg-fuchsia-300/10 text-fuchsia-100 hover:border-fuchsia-200/60 hover:bg-fuchsia-300/18",
              }
            : {
                border: "border-slate-700/60 bg-slate-950/45",
                label: "text-slate-400",
                value: "text-slate-100",
                button:
                  "border-slate-300/18 bg-slate-300/8 text-slate-200 hover:border-slate-200/40 hover:bg-slate-200/12",
              };

  return (
    <div className={`rounded-[18px] border px-4 py-3 ${toneClasses.border}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={`m-0 text-[0.68rem] uppercase tracking-[0.22em] ${toneClasses.label}`}>{label}</p>
          <p className={`mt-2 break-words font-mono text-base ${toneClasses.value}`}>{value}</p>
          {hint ? <p className="mt-2 text-sm leading-6 text-slate-400">{hint}</p> : null}
        </div>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/35 ${toneClasses.button}`}
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function CandidateCard({
  candidate,
  index,
  isActive,
  onActivate,
  departureSelectionLabel,
  arrivalSelectionLabel,
  transitionSelectionLabel,
  approachSelectionLabel,
  approachStatusText,
  approachCountText,
}: CandidateCardProps) {
  return (
    <article
      className={`min-w-0 rounded-[24px] border p-5 transition ${
        isActive
          ? "border-sky-300/60 bg-slate-950/70 shadow-[0_0_0_1px_rgba(125,211,252,0.18)]"
          : "border-slate-700/70 bg-slate-950/60"
      }`}
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="section-kicker">Candidate {index + 1}</p>
            <span
              className={`rounded-full border px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.18em] ${
                isActive
                  ? "border-cyan-200/45 bg-cyan-300/16 text-cyan-50"
                  : "border-slate-300/18 bg-slate-300/8 text-slate-300"
              }`}
            >
              {isActive ? "Pinned" : "Preview"}
            </span>
          </div>
          <h3 className="section-title mt-1 break-words text-[1.15rem]">{formatAirwaySequence(candidate.airways)}</h3>
          <p className="mt-2 text-sm text-slate-300">
            Select this candidate first. Then choose departure runway and SID, followed by arrival runway, STAR,
            transition, and approach.
          </p>
        </div>
        <div className="grid w-full gap-3 sm:w-auto sm:min-w-[210px]">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[18px] border border-slate-700/60 bg-slate-950/48 px-4 py-3 text-left">
              <p className="m-0 text-[0.72rem] uppercase tracking-[0.28em] text-slate-500">Total</p>
              <p className="m-0 mt-1 font-mono text-[1.1rem] text-slate-100">{formatDistance(candidate.totalDistanceNm)}</p>
            </div>
            <div className="rounded-[18px] border border-slate-700/60 bg-slate-950/48 px-4 py-3 text-left">
              <p className="m-0 text-[0.72rem] uppercase tracking-[0.28em] text-slate-500">Airway</p>
              <p className="m-0 mt-1 font-mono text-sm text-slate-300">{formatDistance(candidate.airwayDistanceNm)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onActivate}
            className={`cursor-pointer rounded-2xl border px-4 py-2 text-sm font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/35 ${
              isActive
                ? "border-sky-200/70 bg-sky-300/20 text-sky-50"
                : "border-sky-300/30 bg-sky-300/10 text-sky-100 hover:border-sky-200/60 hover:bg-sky-300/18"
            }`}
          >
            {isActive ? "Displayed on map" : "Show on map"}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 2xl:grid-cols-[1fr_1.15fr_1fr]">
        <section className="rounded-[20px] border border-emerald-400/16 bg-emerald-400/6 p-4">
          <p className="m-0 text-[0.72rem] uppercase tracking-[0.28em] text-emerald-200/80">Departure</p>
          <p className="mt-2 font-mono text-lg text-emerald-100">{candidate.departure.ident}</p>
          {departureSelectionLabel ? (
            <div className="mt-3 rounded-2xl border border-emerald-300/18 bg-slate-950/45 px-4 py-3">
              <p className="m-0 text-[0.68rem] uppercase tracking-[0.24em] text-emerald-200/70">Selected SID</p>
              <p className="mt-2 break-words font-mono text-base text-emerald-50">{departureSelectionLabel}</p>
            </div>
          ) : (
            <p className="mt-1 text-sm text-slate-300">
              SID shortest path {formatDistance(candidate.departure.minimumProcedureDistanceNm)}. Detailed runway and SID
              selection starts after this route is displayed.
            </p>
          )}
        </section>

        <section className="rounded-[20px] border border-sky-400/16 bg-sky-400/6 p-4">
          <p className="m-0 text-[0.72rem] uppercase tracking-[0.28em] text-sky-200/80">Airway</p>
          <div className="scroll-panel mt-2 grid max-h-[24rem] gap-2 overflow-y-auto pr-1">
            {candidate.airways.map((segment, segmentIndex) => (
              <div
                key={`${segment.airwayName}-${segmentIndex}-${segment.fromIdent}-${segment.toIdent}`}
                className="rounded-2xl border border-slate-700/70 bg-slate-950/55 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="m-0 font-mono text-sm text-slate-100">
                    {segment.fromIdent} <span className="text-sky-300">{segment.airwayName}</span>{" "}
                    {segment.toIdent}
                  </p>
                  <p className="m-0 font-mono text-xs text-slate-400">{formatDistance(segment.distanceNm)}</p>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  {segment.airwayType} / {formatDirection(segment.direction)} / {formatAltitudeBand(segment)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[20px] border border-amber-400/16 bg-amber-400/6 p-4">
          <p className="m-0 text-[0.72rem] uppercase tracking-[0.28em] text-amber-200/80">Arrival</p>
          <p className="mt-2 font-mono text-lg text-amber-100">{candidate.arrival.ident}</p>
          {arrivalSelectionLabel ? (
            <div className="mt-3 rounded-2xl border border-amber-300/18 bg-slate-950/45 px-4 py-3">
              <p className="m-0 text-[0.68rem] uppercase tracking-[0.24em] text-amber-200/70">Selected STAR</p>
              <p className="mt-2 break-words font-mono text-base text-amber-50">{arrivalSelectionLabel}</p>
            </div>
          ) : (
            <p className="mt-1 text-sm text-slate-300">
              STAR shortest path {formatDistance(candidate.arrival.minimumProcedureDistanceNm)}. Arrival runway, STAR,
              transition, and approach are selected after this route is displayed.
            </p>
          )}
        </section>
      </div>

      <section className="mt-4 rounded-[20px] border border-fuchsia-400/16 bg-fuchsia-400/6 p-4">
        <p className="m-0 text-[0.72rem] uppercase tracking-[0.28em] text-fuchsia-200/80">Approach</p>
        {transitionSelectionLabel ? (
          <div className="mt-3 rounded-2xl border border-orange-300/18 bg-slate-950/45 px-4 py-3">
            <p className="m-0 text-[0.68rem] uppercase tracking-[0.24em] text-orange-200/70">Selected Transition</p>
            <p className="mt-2 break-words font-mono text-base text-orange-50">{transitionSelectionLabel}</p>
          </div>
        ) : null}
        {approachSelectionLabel ? (
          <div className="mt-3 rounded-2xl border border-fuchsia-300/18 bg-slate-950/45 px-4 py-3">
            <p className="m-0 text-[0.68rem] uppercase tracking-[0.24em] text-fuchsia-200/70">Selected Approach</p>
            <p className="mt-2 break-words font-mono text-base text-fuchsia-50">{approachSelectionLabel}</p>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-300">
              {approachStatusText ??
                "Published approach candidates stay available, but exact approach selection moves to the runway-first arrival workflow."}
            </p>
            <p className="mt-3 text-sm text-slate-400">
              {approachCountText ??
                (candidate.approaches.length > 0
                  ? `${candidate.approaches.length} published approach option(s) available after arrival runway selection.`
                  : "No published approach candidates were resolved.")}
            </p>
          </>
        )}
      </section>
    </article>
  );
}
