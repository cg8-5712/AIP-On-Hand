import { useEffect, useMemo, useRef, useState } from "react";
import { getEaipChartContent, getEaipChartContentUrl } from "../../lib/api";
import type {
  AirportFeature,
  EaipCatalogResponse,
  EaipChartSummary,
  EaipStatusResponse,
} from "../../types/api";
import { FilterChip, InlineError, MiniDataTile } from "../shared/PanelPrimitives";
import { EaipChartList, type EaipChartGroup } from "./EaipChartList";
import { EaipPreviewPanel } from "./EaipPreviewPanel";

type ViewerScope = "airport" | "general" | "enroute";

type EaipPageProps = {
  catalog: EaipCatalogResponse | null;
  catalogError: string | null;
  isCatalogLoading: boolean;
  selectedAirport: AirportFeature | null;
  status: EaipStatusResponse | null;
  statusError: string | null;
  isStatusLoading: boolean;
};

const categoryOrder = ["ADC", "APDC", "GMC", "PARKING", "SID", "STAR", "IAC", "VAC", "AOC"];
const scopeMeta: Record<ViewerScope, { label: string; description: string }> = {
  airport: {
    label: "Airport",
    description: "Airport-specific ADC, APDC, SID, STAR, and approach charts for the current map selection.",
  },
  general: {
    label: "General",
    description: "General documentation sheets that are not tied to a single airport.",
  },
  enroute: {
    label: "ENR",
    description: "Enroute documents and area chart material from the encrypted package.",
  },
};

function categoryRank(category: string) {
  const index = categoryOrder.indexOf(category);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function groupedCharts(charts: EaipChartSummary[]) {
  const groups = new Map<string, EaipChartSummary[]>();

  for (const chart of charts) {
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
    .map(([category, grouped]) => ({
      category,
      charts: grouped,
    })) satisfies EaipChartGroup[];
}

export function EaipPage({
  catalog,
  catalogError,
  isCatalogLoading,
  selectedAirport,
  status,
  statusError,
  isStatusLoading,
}: EaipPageProps) {
  const [activeScope, setActiveScope] = useState<ViewerScope>("airport");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [chartSearch, setChartSearch] = useState("");
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

  const scopeCharts = useMemo(() => {
    if (!catalog) {
      return [] as EaipChartSummary[];
    }

    switch (activeScope) {
      case "general":
        return catalog.generalDocuments;
      case "enroute":
        return catalog.enrouteDocuments;
      case "airport":
      default:
        if (!selectedAirportCode) {
          return [];
        }
        return catalog.airportCharts.filter((chart) => chart.airportIcao === selectedAirportCode);
    }
  }, [activeScope, catalog, selectedAirportCode]);

  const availableCategories = useMemo(() => {
    return [...new Set(scopeCharts.map((chart) => chart.category))]
      .sort((left, right) => {
        const byRank = categoryRank(left) - categoryRank(right);
        if (byRank !== 0) {
          return byRank;
        }

        return left.localeCompare(right);
      });
  }, [scopeCharts]);

  const visibleCharts = useMemo(() => {
    const normalizedSearch = chartSearch.trim().toLowerCase();

    return scopeCharts.filter((chart) => {
      const categoryMatches = selectedCategory === "all" || chart.category === selectedCategory;
      const searchMatches =
        !normalizedSearch ||
        chart.title.toLowerCase().includes(normalizedSearch) ||
        chart.fileName.toLowerCase().includes(normalizedSearch) ||
        chart.category.toLowerCase().includes(normalizedSearch) ||
        chart.airportIcao?.toLowerCase().includes(normalizedSearch);

      return categoryMatches && searchMatches;
    });
  }, [chartSearch, scopeCharts, selectedCategory]);

  const chartGroups = useMemo(() => groupedCharts(visibleCharts), [visibleCharts]);

  useEffect(() => {
    setSelectedCategory("all");
    setChartSearch("");
  }, [activeScope, selectedAirportCode]);

  useEffect(() => {
    if (selectedCategory === "all") {
      return;
    }

    if (!availableCategories.includes(selectedCategory)) {
      setSelectedCategory("all");
    }
  }, [availableCategories, selectedCategory]);

  useEffect(() => {
    setSelectedChartId((current) =>
      current && visibleCharts.some((chart) => chart.chartId === current)
        ? current
        : visibleCharts[0]?.chartId ?? null,
    );
  }, [visibleCharts]);

  const selectedChart = useMemo(() => {
    return visibleCharts.find((chart) => chart.chartId === selectedChartId) ?? null;
  }, [selectedChartId, visibleCharts]);

  const selectedChartIndex = useMemo(() => {
    return visibleCharts.findIndex((chart) => chart.chartId === selectedChartId);
  }, [selectedChartId, visibleCharts]);

  const contentUrl = selectedChart ? getEaipChartContentUrl(selectedChart.chartId) : null;

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

  const selectedScopeMeta = scopeMeta[activeScope];
  const scopeDescription =
    activeScope === "airport" && !selectedAirportCode
      ? "Choose an airport on the map to unlock airport chart browsing in this scope."
      : selectedScopeMeta.description;
  const currentPositionLabel =
    selectedChartIndex >= 0 ? `${selectedChartIndex + 1} / ${visibleCharts.length}` : `0 / ${visibleCharts.length}`;

  return (
    <section className="grid gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="section-kicker">eAIP Desk</p>
          <h2 className="section-title mt-2">Encrypted Chart Viewer</h2>
          <p className="support-copy mt-2 max-w-[52rem] text-sm">
            Scope-aware chart browsing is now available for airport, general, and enroute documents.
            Search, category filtering, and sequential sheet navigation all stay inside the same secure viewer.
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
      {catalogError ? <InlineError message={catalogError} /> : null}
      {status?.message && !status.ready ? <InlineError message={status.message} /> : null}

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)] xl:items-start">
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <MiniDataTile label="Package" value={status?.packageFile ?? "not configured"} />
            <MiniDataTile label="AIRAC" value={typeof status?.cycle === "number" ? String(status.cycle) : "n/a"} />
            <MiniDataTile label="Source" value={status?.source ?? "n/a"} />
            <MiniDataTile label="Selected Airport" value={airportLabel} />
            <MiniDataTile label="Visible Sheets" value={String(visibleCharts.length)} />
          </div>

          <div className="rounded-[22px] border border-slate-700/60 bg-slate-950/55 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="section-kicker">Scope Browser</p>
                <p className="m-0 mt-2 text-sm text-slate-300">{scopeDescription}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <FilterChip
                  label="Airport"
                  isActive={activeScope === "airport"}
                  onClick={() => setActiveScope("airport")}
                />
                <FilterChip
                  label="General"
                  isActive={activeScope === "general"}
                  onClick={() => setActiveScope("general")}
                />
                <FilterChip
                  label="ENR"
                  isActive={activeScope === "enroute"}
                  onClick={() => setActiveScope("enroute")}
                />
              </div>
            </div>

            <div className="mt-4 grid gap-4">
              <label className="block text-[0.8rem] text-slate-400" htmlFor="eaip-chart-search">
                Search within current scope
                <input
                  id="eaip-chart-search"
                  type="search"
                  value={chartSearch}
                  onChange={(event) => setChartSearch(event.target.value)}
                  placeholder="Chart title, file name, category"
                  className="input-shell"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <FilterChip
                  label="All"
                  isActive={selectedCategory === "all"}
                  onClick={() => setSelectedCategory("all")}
                />
                {availableCategories.map((category) => (
                  <FilterChip
                    key={category}
                    label={category}
                    isActive={selectedCategory === category}
                    onClick={() => setSelectedCategory(category)}
                  />
                ))}
              </div>
            </div>
          </div>

          <EaipChartList
            title={`${selectedScopeMeta.label} Chart Stack`}
            description={scopeDescription}
            groups={chartGroups}
            selectedChartId={selectedChartId}
            isLoading={isStatusLoading || isCatalogLoading}
            error={activeScope === "airport" && !selectedAirportCode ? null : null}
            onChartSelect={setSelectedChartId}
          />
        </div>

        <EaipPreviewPanel
          contentUrl={contentUrl}
          currentPositionLabel={currentPositionLabel}
          hasNext={selectedChartIndex >= 0 && selectedChartIndex < visibleCharts.length - 1}
          hasPrevious={selectedChartIndex > 0}
          onNext={() => {
            if (selectedChartIndex >= 0 && selectedChartIndex < visibleCharts.length - 1) {
              setSelectedChartId(visibleCharts[selectedChartIndex + 1].chartId);
            }
          }}
          onPrevious={() => {
            if (selectedChartIndex > 0) {
              setSelectedChartId(visibleCharts[selectedChartIndex - 1].chartId);
            }
          }}
          selectedChart={selectedChart}
          previewUrl={previewUrl}
          isPreviewLoading={isPreviewLoading}
          previewError={previewError}
          airportLabel={airportLabel}
          packageFile={status?.packageFile ?? null}
          scopeLabel={selectedScopeMeta.label}
          sourceLabel={status?.source ?? "n/a"}
        />
      </div>
    </section>
  );
}
