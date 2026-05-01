import type { EaipChartSummary } from "../../types/api";
import { InlineError, WeatherDetailRow } from "../shared/PanelPrimitives";

type EaipPreviewPanelProps = {
  selectedChart: EaipChartSummary | null;
  previewUrl: string | null;
  isPreviewLoading: boolean;
  previewError: string | null;
  airportLabel: string;
  packageFile: string | null;
};

export function EaipPreviewPanel({
  selectedChart,
  previewUrl,
  isPreviewLoading,
  previewError,
  airportLabel,
  packageFile,
}: EaipPreviewPanelProps) {
  return (
    <div className="rounded-[22px] border border-slate-700/60 bg-slate-950/55 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="section-kicker">Preview Surface</p>
          <h3 className="section-title mt-2">
            {selectedChart ? selectedChart.title : "Awaiting chart selection"}
          </h3>
          <p className="muted-copy mt-2 text-sm">
            PDF bytes are decrypted and streamed from memory only. No chart file is written to disk by
            this viewer flow.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (previewUrl) {
              window.open(previewUrl, "_blank", "noopener,noreferrer");
            }
          }}
          disabled={!previewUrl}
          className={
            `rounded-full border px-3 py-2 text-[0.72rem] uppercase tracking-[0.12em] transition duration-200 motion-reduce:transition-none ` +
            (previewUrl
              ? "cursor-pointer border-cyan-300/26 bg-cyan-950/28 text-cyan-100 hover:border-cyan-200/42 hover:bg-cyan-900/34"
              : "cursor-not-allowed border-slate-700/60 bg-slate-950/70 text-slate-500")
          }
        >
          Open Tab
        </button>
      </div>

      {previewError ? <InlineError message={previewError} className="mt-4" /> : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="overflow-hidden rounded-[26px] border border-slate-300/12 bg-slate-900/80">
          {isPreviewLoading ? (
            <div className="flex min-h-[560px] items-center justify-center px-6 py-10">
              <p className="muted-copy text-sm">Decrypting and streaming the selected PDF chart...</p>
            </div>
          ) : null}

          {!isPreviewLoading && previewUrl ? (
            <object
              data={previewUrl}
              type="application/pdf"
              className="h-[72vh] min-h-[560px] w-full bg-white"
              aria-label={selectedChart?.title ?? "Selected eAIP chart"}
            >
              <div className="flex min-h-[560px] items-center justify-center px-6 py-10">
                <p className="muted-copy max-w-[30rem] text-center text-sm">
                  The browser did not render the PDF inline. Use the open button to view this chart in a
                  separate tab backed by the same in-memory object URL.
                </p>
              </div>
            </object>
          ) : null}

          {!isPreviewLoading && !previewUrl ? (
            <div className="flex min-h-[560px] items-center justify-center px-6 py-10">
              <p className="muted-copy max-w-[30rem] text-center text-sm">
                Choose a chart from the left stack to start an inline preview.
              </p>
            </div>
          ) : null}
        </div>

        <div className="grid content-start gap-4">
          <div className="rounded-[18px] border border-slate-700/60 bg-slate-950/56 p-4">
            <p className="section-kicker">Sheet Meta</p>
            <div className="mt-4 grid gap-2">
              <WeatherDetailRow label="Airport" value={airportLabel || "n/a"} />
              <WeatherDetailRow label="Category" value={selectedChart?.category ?? "n/a"} />
              <WeatherDetailRow label="File" value={selectedChart?.fileName ?? "n/a"} />
              <WeatherDetailRow label="Merged" value={selectedChart?.isMerged ? "Yes" : "No"} />
              <WeatherDetailRow label="Package" value={packageFile ?? "n/a"} />
            </div>
          </div>

          <div className="rounded-[18px] border border-slate-700/60 bg-slate-950/56 p-4">
            <p className="section-kicker">Handling Rules</p>
            <p className="m-0 mt-3 text-sm leading-6 text-slate-300">
              Passwords stay server-side, chart bytes are loaded on demand, and object URLs are revoked
              when a new chart replaces the current preview.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
