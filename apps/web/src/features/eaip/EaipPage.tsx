import { useEffect, useMemo, useRef, useState } from "react";
import type { AirportFeature, EaipAirportChartsResponse, EaipChartSummary, EaipStatusResponse } from "../../types/api";
import { getEaipAirportCharts, getEaipChartContent, getEaipStatus } from "../../lib/api";
import { InlineError, MiniDataTile } from "../shared/PanelPrimitives";
import { EaipChartList, type EaipChartGroup } from "./EaipChartList";
import { EaipPreviewPanel } from "./EaipPreviewPanel";

type EaipPageProps = {
  selectedAirport: AirportFeature | null;
};

const categoryOrder = ["ADC", "APDC", "GMC", "PARKING", "SID", "STAR", "IAC", "VAC", "AOC"];

function categoryRank(category: string) {
  const index = categoryOrder.indexOf(category);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

export function EaipPage({ selectedAirport }: EaipPageProps) {
  const [status, setStatus] = useState<EaipStatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isStatusLoading, setIsStatusLoading] = useState(true);
  const [airportCharts, setAirportCharts] = useState<EaipAirportChartsResponse | null>(null);
  const [chartsError, setChartsError] = useState<string | null>(null);
  const [isChartsLoading, setIsChartsLoading] = useState(false);
  const [selectedChartId, setSelectedChartId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const previewUrlRef = useRef<string | null>(null);

  const selectedAirportCode = useMemo(() => {
    if (selectedAirport?.icao?.trim()) {
      return selectedAirport.icao.trim().toUpperCase();
    }

    if (selectedAirport?.ident?.trim()) {
      return selectedAirport.ident.trim().toUpperCase();
    }

    return null;
  }, [selectedAirport]);

  const airportLabel = selectedAirport
    ? `${selectedAirport.ident}${selectedAirport.icao ? ` / ${selectedAirport.icao}` : ""}`
    : "n/a";

  useEffect(() => {
    const controller = new AbortController();
    setStatusError(null);
    setIsStatusLoading(true);

    getEaipStatus({ signal: controller.signal })
      .then((response) => {
        setStatus(response);
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        setStatus(null);
        setStatusError(error instanceof Error ? error.message : "Failed to load eAIP status");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsStatusLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!selectedAirportCode) {
      setAirportCharts(null);
      setChartsError(null);
      setIsChartsLoading(false);
      setSelectedChartId(null);
      return;
    }

    if (isStatusLoading) {
      return;
    }

    if (status && !status.ready) {
      setAirportCharts(null);
      setChartsError(status.message ?? "The encrypted eAIP package is not ready.");
      setIsChartsLoading(false);
      setSelectedChartId(null);
      return;
    }

    const controller = new AbortController();
    setChartsError(null);
    setIsChartsLoading(true);

    getEaipAirportCharts(selectedAirportCode, { signal: controller.signal })
      .then((response) => {
        setAirportCharts(response);
        setSelectedChartId((current) =>
          current && response.charts.some((chart) => chart.chartId === current)
            ? current
            : response.charts[0]?.chartId ?? null,
        );
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        setAirportCharts(null);
        setSelectedChartId(null);
        setChartsError(error instanceof Error ? error.message : "Failed to load airport charts");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsChartsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [isStatusLoading, selectedAirportCode, status]);

  const selectedChart = useMemo(() => {
    return airportCharts?.charts.find((chart) => chart.chartId === selectedChartId) ?? null;
  }, [airportCharts, selectedChartId]);

  useEffect(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);

    if (!selectedChartId) {
      setPreviewError(null);
      setIsPreviewLoading(false);
      return;
    }

    const controller = new AbortController();
    setPreviewError(null);
    setIsPreviewLoading(true);

    getEaipChartContent(selectedChartId, { signal: controller.signal })
      .then((blob) => {
        const nextPreviewUrl = URL.createObjectURL(blob);
        previewUrlRef.current = nextPreviewUrl;
        setPreviewUrl(nextPreviewUrl);
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        setPreviewUrl(null);
        setPreviewError(error instanceof Error ? error.message : "Failed to load chart preview");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsPreviewLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [selectedChartId]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const groupedCharts = useMemo<EaipChartGroup[]>(() => {
    const groups = new Map<string, EaipChartSummary[]>();

    for (const chart of airportCharts?.charts ?? []) {
      const group = groups.get(chart.category) ?? [];
      group.push(chart);
      groups.set(chart.category, group);
    }

    return [...groups.entries()]
      .sort((left, right) => {
        const byRank = categoryRank(left[0]) - categoryRank(right[0]);
        if (byRank !== 0) {
          return byRank;
        }

        return left[0].localeCompare(right[0]);
      })
      .map(([category, charts]) => ({
        category,
        charts,
      }));
  }, [airportCharts]);

  return (
    <section className="grid gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="section-kicker">eAIP Desk</p>
          <h2 className="section-title mt-2">Encrypted Chart Viewer</h2>
          <p className="support-copy mt-2 max-w-[52rem] text-sm">
            Airport chart access is now wired to the encrypted package backend. The browser only
            receives metadata and on-demand PDF bytes for the selected sheet.
          </p>
        </div>
        <div
          className={
            `rounded-full border px-3 py-2 text-[0.72rem] uppercase tracking-[0.12em] ` +
            (status?.ready
              ? "border-emerald-300/18 bg-emerald-400/8 text-emerald-100"
              : "border-amber-300/18 bg-amber-400/8 text-amber-100")
          }
        >
          {status?.ready ? "memory-only ready" : "package offline"}
        </div>
      </div>

      {statusError ? <InlineError message={statusError} /> : null}
      {status?.message && !status.ready ? <InlineError message={status.message} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MiniDataTile label="Package" value={status?.packageFile ?? "not configured"} />
        <MiniDataTile label="AIRAC" value={typeof status?.cycle === "number" ? String(status.cycle) : "n/a"} />
        <MiniDataTile label="Indexed PDFs" value={typeof status?.chartCount === "number" ? String(status.chartCount) : "0"} />
        <MiniDataTile label="Delivery" value={status?.memoryOnly ? "memory-only" : "n/a"} />
      </div>

      {!selectedAirportCode ? (
        <div className="overlay-card mt-2">
          <p className="muted-copy text-sm">
            Select an airport from the map page to load its airport chart collection into the eAIP desk.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MiniDataTile label="Selected Airport" value={airportLabel} />
            <MiniDataTile label="Resolved ICAO" value={airportCharts?.resolvedAirportIcao ?? selectedAirportCode} />
            <MiniDataTile
              label="Airport Sheets"
              value={typeof airportCharts?.charts.length === "number" ? String(airportCharts.charts.length) : "0"}
            />
            <MiniDataTile label="Viewer State" value={selectedChart ? selectedChart.category : "idle"} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
            <EaipChartList
              groups={groupedCharts}
              selectedChartId={selectedChartId}
              isLoading={isChartsLoading}
              error={chartsError}
              airportCode={airportCharts?.resolvedAirportIcao ?? selectedAirportCode}
              onChartSelect={setSelectedChartId}
            />

            <EaipPreviewPanel
              selectedChart={selectedChart}
              previewUrl={previewUrl}
              isPreviewLoading={isPreviewLoading}
              previewError={previewError}
              airportLabel={airportLabel}
              packageFile={status?.packageFile ?? null}
            />
          </div>
        </>
      )}
    </section>
  );
}
