export function RoutePage() {
  return (
    <section className="grid gap-4">
      <div className="rounded-[22px] border border-slate-700/60 bg-slate-950/55 p-5">
        <p className="section-kicker">Route Planner</p>
        <h2 className="section-title mt-1">Reserved For Route Construction</h2>
        <p className="support-copy mt-3 text-sm">
          This page is the next target for airway-aware construction, SID/STAR linking, legality
          diagnostics, and export preparation. The map stays live on the right while route tools
          move into this center workspace.
        </p>
      </div>
    </section>
  );
}
