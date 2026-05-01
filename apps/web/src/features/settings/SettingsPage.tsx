import type { FormEvent } from "react";
import { useRef, useState } from "react";
import type { EaipStatusResponse } from "../../types/api";
import { FilterChip, InlineError, MiniDataTile, WeatherDetailRow } from "../shared/PanelPrimitives";

type SettingsPageProps = {
  eaipStatus: EaipStatusResponse | null;
  eaipStatusError: string | null;
  isEaipStatusLoading: boolean;
  onEaipConfigure: (packagePath: string, password: string) => Promise<void>;
  onEaipUpload: (packageFile: File, password: string) => Promise<void>;
  onEaipUnload: () => Promise<void>;
};

type ImportMode = "upload" | "path";

export function SettingsPage({
  eaipStatus,
  eaipStatusError,
  isEaipStatusLoading,
  onEaipConfigure,
  onEaipUpload,
  onEaipUnload,
}: SettingsPageProps) {
  const [importMode, setImportMode] = useState<ImportMode>("upload");
  const [packagePath, setPackagePath] = useState("");
  const [pathPassword, setPathPassword] = useState("");
  const [uploadPassword, setUploadPassword] = useState("");
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

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
      setSubmitError(error instanceof Error ? error.message : "Failed to load eAIP package from backend path");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUploadSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    if (!selectedUploadFile) {
      setSubmitError("Choose an .aipkg or .aip package file first.");
      return;
    }

    if (!uploadPassword.trim()) {
      setSubmitError("Package password is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onEaipUpload(selectedUploadFile, uploadPassword);
      setUploadPassword("");
      setSelectedUploadFile(null);
      if (uploadInputRef.current) {
        uploadInputRef.current.value = "";
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to upload eAIP package");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUnloadClick() {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await onEaipUnload();
      setPathPassword("");
      setUploadPassword("");
      setSelectedUploadFile(null);
      if (uploadInputRef.current) {
        uploadInputRef.current.value = "";
      }
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
              Browser mode now supports direct encrypted package upload into backend memory. No chart PDF
              extraction, no temp chart files, and no persisted package password.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterChip
              label="Browser Upload"
              isActive={importMode === "upload"}
              onClick={() => setImportMode("upload")}
            />
            <FilterChip
              label="Backend Path"
              isActive={importMode === "path"}
              onClick={() => setImportMode("path")}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MiniDataTile label="Package Status" value={eaipStatus?.ready ? "ready" : "offline"} />
        <MiniDataTile label="Package File" value={eaipStatus?.packageFile ?? "none"} />
        <MiniDataTile
          label="Indexed PDFs"
          value={typeof eaipStatus?.chartCount === "number" ? String(eaipStatus.chartCount) : "0"}
        />
        <MiniDataTile label="Delivery" value={eaipStatus?.memoryOnly ? "memory-only" : "n/a"} />
        <MiniDataTile label="Source" value={eaipStatus?.source ?? "n/a"} />
      </div>

      {eaipStatusError ? <InlineError message={eaipStatusError} /> : null}
      {submitError ? <InlineError message={submitError} /> : null}
      {eaipStatus?.message ? <InlineError message={eaipStatus.message} /> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_320px]">
        <div className="grid gap-4">
          <form
            onSubmit={handleUploadSubmit}
            className={`rounded-[24px] border p-5 ${importMode === "upload" ? "border-cyan-300/26 bg-cyan-950/12" : "border-slate-700/60 bg-slate-950/55"}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-kicker">Browser Upload</p>
                <p className="m-0 mt-2 text-sm text-slate-300">
                  Recommended for current browser testing. The selected package is streamed to the backend
                  and stays in memory only.
                </p>
              </div>
              <span className="rounded-full border border-cyan-300/18 bg-cyan-400/8 px-3 py-1 text-[0.68rem] uppercase tracking-[0.12em] text-cyan-100">
                recommended
              </span>
            </div>

            <div className="mt-4 grid gap-4">
              <div className="rounded-[20px] border border-dashed border-slate-600/70 bg-slate-950/72 p-4">
                <label className="block cursor-pointer" htmlFor="eaip-upload-file">
                  <span className="block text-[0.8rem] uppercase tracking-[0.12em] text-slate-400">Package file</span>
                  <span className="mt-2 block text-sm text-slate-200">
                    {selectedUploadFile
                      ? `${selectedUploadFile.name} · ${(selectedUploadFile.size / 1024 / 1024).toFixed(1)} MB`
                      : "Choose a local .aipkg or .aip file"}
                  </span>
                  <span className="mt-1 block text-[0.8rem] text-slate-500">
                    The browser never exposes an absolute local path here, so upload mode is the secure web-compatible flow.
                  </span>
                  <input
                    ref={uploadInputRef}
                    id="eaip-upload-file"
                    type="file"
                    accept=".aipkg,.aip,application/octet-stream"
                    className="mt-4 block w-full text-sm text-slate-300 file:mr-4 file:cursor-pointer file:rounded-full file:border-0 file:bg-cyan-950/42 file:px-4 file:py-2 file:text-cyan-100 hover:file:bg-cyan-900/40"
                    onChange={(event) => setSelectedUploadFile(event.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              <label className="block text-[0.8rem] text-slate-400" htmlFor="eaip-upload-password">
                Package password
                <input
                  id="eaip-upload-password"
                  type="password"
                  value={uploadPassword}
                  onChange={(event) => setUploadPassword(event.target.value)}
                  placeholder="Used once for in-memory activation"
                  className="input-shell"
                  autoComplete="new-password"
                  spellCheck={false}
                />
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={
                    `cursor-pointer rounded-full border px-4 py-3 text-[0.76rem] uppercase tracking-[0.14em] transition duration-200 motion-reduce:transition-none ` +
                    (isSubmitting
                      ? "border-slate-700/60 bg-slate-900/80 text-slate-500"
                      : "border-cyan-300/26 bg-cyan-950/30 text-cyan-100 hover:border-cyan-200/42 hover:bg-cyan-900/36")
                  }
                >
                  {isSubmitting ? "Uploading..." : "Upload Into Memory"}
                </button>
              </div>
            </div>
          </form>

          <form
            onSubmit={handlePathSubmit}
            className={`rounded-[24px] border p-5 ${importMode === "path" ? "border-amber-300/24 bg-amber-950/10" : "border-slate-700/60 bg-slate-950/55"}`}
          >
            <p className="section-kicker">Backend Path</p>
            <p className="m-0 mt-2 text-sm text-slate-300">
              Use this when the backend process can already reach the encrypted package on local disk or a mounted drive.
            </p>

            <div className="mt-4 grid gap-4">
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
                  disabled={isSubmitting}
                  className={
                    `cursor-pointer rounded-full border px-4 py-3 text-[0.76rem] uppercase tracking-[0.14em] transition duration-200 motion-reduce:transition-none ` +
                    (isSubmitting
                      ? "border-slate-700/60 bg-slate-900/80 text-slate-500"
                      : "border-amber-300/26 bg-amber-950/20 text-amber-100 hover:border-amber-200/42 hover:bg-amber-900/26")
                  }
                >
                  {isSubmitting ? "Applying..." : "Load Backend Path"}
                </button>

                <button
                  type="button"
                  onClick={handleUnloadClick}
                  disabled={isSubmitting || !eaipStatus?.configured}
                  className={
                    `rounded-full border px-4 py-3 text-[0.76rem] uppercase tracking-[0.14em] transition duration-200 motion-reduce:transition-none ` +
                    (isSubmitting || !eaipStatus?.configured
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
              Uploaded packages are held in backend memory only, package passwords are not persisted, and
              chart previews continue to stream as no-store PDF responses.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
