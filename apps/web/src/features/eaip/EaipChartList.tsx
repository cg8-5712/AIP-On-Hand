import type { EaipChartSummary } from "../../types/api";
import { InlineError } from "../shared/PanelPrimitives";

export type EaipChartGroup = {
  category: string;
  charts: EaipChartSummary[];
};

type EaipChartListProps = {
  description: string;
  groups: EaipChartGroup[];
  selectedChartId: string | null;
  isLoading: boolean;
  error: string | null;
  title: string;
  onChartSelect: (chartId: string) => void;
};

export function EaipChartList({
  description,
  groups,
  selectedChartId,
  isLoading,
  error,
  title,
  onChartSelect,
}: EaipChartListProps) {
  return (
    <div className="rounded-[22px] border border-slate-700/60 bg-slate-950/55 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="section-kicker">Document Stack</p>
          <p className="m-0 mt-2 text-sm text-slate-100">{title}</p>
          <p className="m-0 mt-1 text-[0.82rem] text-slate-400">{description}</p>
        </div>
        <span className="rounded-full border border-slate-700/60 bg-slate-950/80 px-3 py-1 text-[0.68rem] uppercase tracking-[0.12em] text-slate-400">
          {groups.reduce((count, group) => count + group.charts.length, 0)} sheets
        </span>
      </div>

      {error ? <InlineError message={error} className="mt-4" /> : null}

      {isLoading ? (
        <div className="overlay-card mt-4">
          <p className="muted-copy text-sm">Reading chart index from the encrypted package...</p>
        </div>
      ) : null}

      {!isLoading && !error && groups.length === 0 ? (
        <div className="overlay-card mt-4">
          <p className="muted-copy text-sm">
            No charts match the current scope and filters.
          </p>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4">
        {groups.map((group) => (
          <section key={group.category} className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <p className="m-0 text-[0.74rem] font-semibold uppercase tracking-[0.14em] text-cyan-100/84">
                {group.category}
              </p>
              <span className="text-[0.72rem] uppercase tracking-[0.12em] text-slate-500">
                {group.charts.length} charts
              </span>
            </div>

            <ul className="m-0 grid list-none gap-2 p-0">
              {group.charts.map((chart) => {
                const isActive = chart.chartId === selectedChartId;

                return (
                  <li key={chart.chartId} className="m-0">
                    <button
                      type="button"
                      onClick={() => onChartSelect(chart.chartId)}
                      className={
                        `grid w-full cursor-pointer gap-1 rounded-[18px] border px-4 py-3 text-left transition duration-200 motion-reduce:transition-none ` +
                        (isActive
                          ? "border-cyan-300/28 bg-cyan-950/34 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                          : "border-slate-700/60 bg-slate-950/52 text-slate-300 hover:border-cyan-300/24 hover:bg-slate-900/88")
                      }
                      aria-label={chart.title}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <strong className="font-mono text-[0.9rem] text-amber-300">{chart.category}</strong>
                        <span className="rounded-full bg-slate-900/80 px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.12em] text-slate-400">
                          {chart.isMerged ? "merged" : "pdf"}
                        </span>
                      </div>
                      <span className="text-[0.95rem] text-slate-100">{chart.title}</span>
                      <span className="text-[0.8rem] text-slate-500">{chart.fileName}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
