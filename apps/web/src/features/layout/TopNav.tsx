type AppPage = "map" | "weather" | "airport-info";

type TopNavProps = {
  activePage: AppPage;
  onPageChange: (page: AppPage) => void;
};

const pages: Array<{ key: AppPage; label: string }> = [
  { key: "map", label: "Map" },
  { key: "weather", label: "Weather" },
  { key: "airport-info", label: "Airport Info" },
];

export function TopNav({ activePage, onPageChange }: TopNavProps) {
  return (
    <nav className="layout-panel px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        {pages.map((page) => (
          <button
            key={page.key}
            type="button"
            onClick={() => onPageChange(page.key)}
            className={
              `cursor-pointer rounded-full border px-4 py-2 text-[0.74rem] uppercase tracking-[0.12em] transition duration-200 motion-reduce:transition-none ` +
              (activePage === page.key
                ? "border-cyan-300/28 bg-cyan-950/34 text-cyan-100"
                : "border-slate-700/60 bg-slate-950/46 text-slate-400 hover:border-cyan-300/22 hover:text-slate-200")
            }
            aria-pressed={activePage === page.key}
          >
            {page.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
