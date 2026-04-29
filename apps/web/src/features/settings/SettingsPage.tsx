export function SettingsPage() {
  return (
    <section className="grid gap-4">
      <div className="rounded-[22px] border border-slate-700/60 bg-slate-950/55 p-5">
        <p className="section-kicker">Settings</p>
        <h2 className="section-title mt-1">Display And Source Controls</h2>
        <p className="support-copy mt-3 text-sm">
          This page will hold map defaults, weather source preferences, local data paths, and
          desktop-specific settings. It is intentionally stubbed for now so the workbench layout
          matches the long-term product shape.
        </p>
      </div>
    </section>
  );
}
