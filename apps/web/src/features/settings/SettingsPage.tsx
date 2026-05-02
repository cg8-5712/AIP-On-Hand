import type { FormEvent } from "react";
import { useState } from "react";
import type { EaipStatusResponse } from "../../types/api";
import { InlineError, MiniDataTile, WeatherDetailRow } from "../shared/PanelPrimitives";

type SettingsPageProps = {
  eaipStatus: EaipStatusResponse | null;
  eaipStatusError: string | null;
  isEaipStatusLoading: boolean;
  onEaipPickPackage: () => Promise<string | null>;
  onEaipConfigure: (packagePath: string, password: string) => Promise<void>;
  onEaipUnload: () => Promise<void>;
};

export function SettingsPage({
  eaipStatus,
  eaipStatusError,
  isEaipStatusLoading,
  onEaipPickPackage,
  onEaipConfigure,
  onEaipUnload,
}: SettingsPageProps) {
  const [packagePath, setPackagePath] = useState("");
  const [pathPassword, setPathPassword] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPickingPackage, setIsPickingPackage] = useState(false);

  async function handlePathSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const normalizedPath = packagePath.trim();
    if (!normalizedPath) {
      setSubmitError("Package path is required.");
      return;
    }

    if (!pathPassword.trim()) {
      setSubmitError("Package password is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onEaipConfigure(normalizedPath, pathPassword);
      setPathPassword("");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to load eAIP package from local path");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePickPackageClick() {
    setSubmitError(null);
    setIsPickingPackage(true);

    try {
      const selectedPath = await onEaipPickPackage();
      if (selectedPath) {
        setPackagePath(selectedPath);
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to open the local package picker");
    } finally {
      setIsPickingPackage(false);
    }
  }

  async function handleUnloadClick() {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await onEaipUnload();
      setPathPassword("");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to unload eAIP package");
    } finally {
      setIsSubmitting(false);
    }
  }

  const statusTone = eaipStatus?.ready ? "text-emerald-300" : "text-amber-200";

  return (
    <section className="grid gap-4">
      <div className="rounded-[22px] border border-slate-700/60 bg-slate-950/55 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="section-kicker">Settings</p>
            <h2 className="section-title mt-1">eAIP Runtime Configuration</h2>
            <p className="support-copy mt-3 max-w-[48rem] text-sm">
              Local mode uses a native package picker. The backend reads the encrypted package
              directly from disk, with no PDF extraction, no temp chart files, and no persisted
              package password.
            </p>
          </div>
          <span className="rounded-full border border-amber-300/18 bg-amber-400/8 px-3 py-1 text-[0.68rem] uppercase tracking-[0.12em] text-amber-100">
            local workflow
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <MiniDataTile label="Package Status" value={eaipStatus?.ready ? "ready" : "offline"} />
        <MiniDataTile label="Package File" value={eaipStatus?.packageFile ?? "none"} />
        <MiniDataTile
          label="Indexed PDFs"
          value={typeof eaipStatus?.chartCount === "number" ? String(eaipStatus.chartCount) : "0"}
        />
        <MiniDataTile label="Access" value="local-path" />
        <MiniDataTile label="Source" value={eaipStatus?.source ?? "n/a"} />
      </div>

      {eaipStatusError ? <InlineError message={eaipStatusError} /> : null}
      {submitError ? <InlineError message={submitError} /> : null}
      {eaipStatus?.message ? <InlineError message={eaipStatus.message} /> : null}

      <div className="grid gap-4">
        <div className="grid gap-4">
          <form
            onSubmit={handlePathSubmit}
            className="rounded-[24px] border border-amber-300/24 bg-amber-950/10 p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-kicker">Local Package</p>
                <p className="m-0 mt-2 text-sm text-slate-300">
                  Choose the encrypted `.aipkg` or `.aip` package on this computer, then provide the
                  runtime password for activation.
                </p>
              </div>
              <span className="rounded-full border border-amber-300/18 bg-amber-400/8 px-3 py-1 text-[0.68rem] uppercase tracking-[0.12em] text-amber-100">
                recommended
              </span>
            </div>

            <div className="mt-4 grid gap-4">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-end">
                <label className="block text-[0.8rem] text-slate-400" htmlFor="eaip-package-path">
                  Package path
                  <input
                    id="eaip-package-path"
                    type="text"
                    value={packagePath}
                    onChange={(event) => setPackagePath(event.target.value)}
                    placeholder="D:\\secure\\EAIP2026-04.aipkg"
                    className="input-shell"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>

                <button
                  type="button"
                  onClick={handlePickPackageClick}
                  disabled={isSubmitting || isPickingPackage}
                  className={
                    `rounded-full border px-4 py-3 text-[0.76rem] uppercase tracking-[0.14em] transition duration-200 motion-reduce:transition-none ` +
                    (isSubmitting || isPickingPackage
                      ? "cursor-not-allowed border-slate-700/60 bg-slate-900/80 text-slate-500"
                      : "cursor-pointer border-cyan-300/26 bg-cyan-950/28 text-cyan-100 hover:border-cyan-200/42 hover:bg-cyan-900/34")
                  }
                >
                  {isPickingPackage ? "Choosing..." : "Choose Package"}
                </button>
              </div>

              <label className="block text-[0.8rem] text-slate-400" htmlFor="eaip-path-password">
                Package password
                <input
                  id="eaip-path-password"
                  type="password"
                  value={pathPassword}
                  onChange={(event) => setPathPassword(event.target.value)}
                  placeholder="Runtime only"
                  className="input-shell"
                  autoComplete="new-password"
                  spellCheck={false}
                />
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting || isPickingPackage}
                  className={
                    `cursor-pointer rounded-full border px-4 py-3 text-[0.76rem] uppercase tracking-[0.14em] transition duration-200 motion-reduce:transition-none ` +
                    (isSubmitting
                      ? "border-slate-700/60 bg-slate-900/80 text-slate-500"
                      : "border-amber-300/26 bg-amber-950/20 text-amber-100 hover:border-amber-200/42 hover:bg-amber-900/26")
                  }
                >
                  {isSubmitting ? "Applying..." : "Load Local Package"}
                </button>

                <button
                  type="button"
                  onClick={handleUnloadClick}
                  disabled={isSubmitting || isPickingPackage || !eaipStatus?.configured}
                  className={
                    `rounded-full border px-4 py-3 text-[0.76rem] uppercase tracking-[0.14em] transition duration-200 motion-reduce:transition-none ` +
                    (isSubmitting || isPickingPackage || !eaipStatus?.configured
                      ? "cursor-not-allowed border-slate-700/60 bg-slate-900/80 text-slate-500"
                      : "cursor-pointer border-rose-300/20 bg-rose-950/18 text-rose-100 hover:border-rose-200/38 hover:bg-rose-900/22")
                  }
                >
                  Unload Package
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="grid content-start gap-4">
          <div className="rounded-[22px] border border-slate-700/60 bg-slate-950/55 p-5">
            <p className="section-kicker">Runtime State</p>
            <p className={`m-0 mt-3 text-[1rem] font-semibold ${statusTone}`}>
              {isEaipStatusLoading ? "Loading status..." : eaipStatus?.ready ? "Package active" : "No active package"}
            </p>

            <div className="mt-4 grid gap-2">
              <WeatherDetailRow label="AIRAC" value={typeof eaipStatus?.cycle === "number" ? String(eaipStatus.cycle) : "n/a"} />
              <WeatherDetailRow label="Airport Sets" value={typeof eaipStatus?.airportCount === "number" ? String(eaipStatus.airportCount) : "0"} />
              <WeatherDetailRow
                label="General Docs"
                value={typeof eaipStatus?.generalDocumentCount === "number" ? String(eaipStatus.generalDocumentCount) : "0"}
              />
              <WeatherDetailRow
                label="ENR Docs"
                value={typeof eaipStatus?.enrouteDocumentCount === "number" ? String(eaipStatus.enrouteDocumentCount) : "0"}
              />
            </div>
          </div>

          <div className="rounded-[22px] border border-slate-700/60 bg-slate-950/55 p-5">
            <p className="section-kicker">Security Rules</p>
            <p className="m-0 mt-3 text-sm leading-6 text-slate-300">
              The local package stays encrypted on disk, passwords are not persisted, and chart previews
              continue to stream as no-store PDF responses.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
