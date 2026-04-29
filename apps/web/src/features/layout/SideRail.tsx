import type { AppPage } from "../app/types";

type SideRailProps = {
  activePage: AppPage;
  onPageChange: (page: AppPage) => void;
};

const items: Array<{ key: AppPage; label: string; shortLabel: string }> = [
  { key: "map", label: "Map", shortLabel: "MAP" },
  { key: "weather", label: "Weather", shortLabel: "WX" },
  { key: "route", label: "Route", shortLabel: "RTE" },
  { key: "airport-info", label: "Airport Info", shortLabel: "APT" },
  { key: "settings", label: "Settings", shortLabel: "SET" },
];

export function SideRail({ activePage, onPageChange }: SideRailProps) {
  return (
    <aside className="layout-panel flex min-h-[620px] flex-col items-center gap-3 px-2 py-3 xl:min-h-0">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onPageChange(item.key)}
          className={
            `group flex w-full flex-col items-center gap-2 rounded-[18px] border px-2 py-3 text-center transition duration-200 motion-reduce:transition-none ` +
            (activePage === item.key
              ? "border-cyan-300/28 bg-cyan-950/38 text-cyan-100"
              : "border-slate-700/60 bg-slate-950/42 text-slate-400 hover:border-cyan-300/18 hover:bg-slate-900/86 hover:text-slate-200")
          }
          aria-pressed={activePage === item.key}
          title={item.label}
        >
          <span className="font-mono text-[0.78rem] tracking-[0.18em]">{item.shortLabel}</span>
          <span className="text-[0.6rem] uppercase tracking-[0.16em] leading-4">{item.label}</span>
        </button>
      ))}
    </aside>
  );
}
