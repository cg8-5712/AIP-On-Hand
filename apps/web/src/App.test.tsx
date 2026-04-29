import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import * as api from "./lib/api";
import type {
  AirportProceduresResponse,
  MapLayersResponse,
  ProcedureGeometryResponse,
} from "./types/api";

vi.mock("./features/map/MapView", async () => {
  const React = await import("react");

  return {
    MapView: ({
      layers,
      selectedAirportIdent,
      selectedProcedure,
      onViewportChange,
    }: {
      layers: MapLayersResponse | null;
      selectedAirportIdent: string | null;
      selectedProcedure: ProcedureGeometryResponse | null;
      onViewportChange: (viewport: {
        bounds: { west: number; south: number; east: number; north: number };
        zoom: number;
      }) => void;
    }) => {
      React.useEffect(() => {
        onViewportChange({
          bounds: {
            west: 115,
            south: 39,
            east: 117,
            north: 41,
          },
          zoom: 6,
        });
      }, [onViewportChange]);

      return (
        <div data-testid="map-view">
          <span data-testid="map-airport-count">{layers?.airports.length ?? 0}</span>
          <span data-testid="map-selected-airport">{selectedAirportIdent ?? "none"}</span>
          <span data-testid="map-selected-procedure">
            {selectedProcedure?.summary.name ?? "none"}
          </span>
        </div>
      );
    },
  };
});

const mapLayersResponse: MapLayersResponse = {
  metadata: {
    airacCycle: "2512",
    validThrough: "2711251225",
    dataSource: "NAVIGRAPH",
    hasSidStar: true,
  },
  airports: [
    {
      id: 16999,
      ident: "ZBAA",
      icao: null,
      name: "Capital",
      country: "CHN",
      numApproaches: 50,
      longestRunwayLength: 3800,
      location: { lon: 116.5983, lat: 40.0733 },
    },
    {
      id: 17000,
      ident: "ZBAD",
      icao: null,
      name: "Daxing",
      country: "CHN",
      numApproaches: 32,
      longestRunwayLength: 3800,
      location: { lon: 116.4108, lat: 39.5098 },
    },
  ],
  waypoints: [
    {
      id: 1,
      ident: "IDKEX",
      name: null,
      waypointType: "WAYPOINT",
      arincType: "WN",
      airportIdent: null,
      location: { lon: 116.5667, lat: 40.7778 },
    },
  ],
  vors: [],
  ndbs: [],
  airways: [],
  truncation: {
    airports: false,
    waypoints: false,
    vors: false,
    ndbs: false,
    airways: false,
  },
};

const airportProceduresResponse: AirportProceduresResponse = {
  airport: {
    id: 16999,
    ident: "ZBAA",
    icao: null,
    name: "Capital",
    location: { lon: 116.5983, lat: 40.0733 },
  },
  procedures: [
    {
      id: 71985,
      airportIdent: "ZBAA",
      airportName: "Capital",
      name: "IDKE2G",
      arincName: "RW18L",
      procedureType: "GPS",
      procedureKind: "sid",
      runwayName: "18L",
      legs: 8,
    },
    {
      id: 30483,
      airportIdent: "ZBAA",
      airportName: "Capital",
      name: "I01-Y",
      arincName: "I01-Y",
      procedureType: "ILS",
      procedureKind: "approach",
      runwayName: "01",
      legs: 6,
    },
  ],
};

const procedureGeometryResponse: ProcedureGeometryResponse = {
  airport: airportProceduresResponse.airport,
  summary: airportProceduresResponse.procedures[0],
  path: [
    {
      ident: "DE18L",
      legType: "DF",
      position: { lon: 116.6002, lat: 40.0555 },
    },
    {
      ident: "IDKEX",
      legType: "TF",
      position: { lon: 116.5667, lat: 40.7778 },
    },
  ],
  missedPath: [],
};

describe("App", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, "getHealth").mockResolvedValue({
      service: "aip-on-hand-api",
      status: "ok",
    });
    vi.spyOn(api, "getVersion").mockResolvedValue({
      service: "aip-api",
      version: "0.1.0",
    });
    vi.spyOn(api, "getMapLayers").mockResolvedValue(mapLayersResponse);
    vi.spyOn(api, "getAirportProcedures").mockResolvedValue(airportProceduresResponse);
    vi.spyOn(api, "getProcedureGeometry").mockResolvedValue(procedureGeometryResponse);
  });

  it("loads live layer metadata and selects the first visible airport", async () => {
    const view = render(<App />);

    await view.findByText("AIP On Hand");
    await view.findByText("2512");

    expect(view.getByTestId("map-airport-count")).toHaveTextContent("2");
    await vi.waitFor(() => {
      expect(view.getByTestId("map-selected-airport")).toHaveTextContent("ZBAA");
    });
    expect(view.getByText("IDKE2G")).toBeInTheDocument();
  });

  it("filters the visible airport list", async () => {
    const user = userEvent.setup();

    const view = render(<App />);

    const input = await view.findByRole("searchbox", {
      name: /filter current viewport/i,
    });

    await user.type(input, "dax");

    expect(view.getByRole("button", { name: "Daxing" })).toBeInTheDocument();
    expect(view.queryByRole("button", { name: "Capital" })).not.toBeInTheDocument();
  });

  it("updates the selected procedure highlight when another procedure is chosen", async () => {
    const user = userEvent.setup();

    vi.spyOn(api, "getProcedureGeometry").mockImplementation(async (procedureId) => {
      return {
        ...procedureGeometryResponse,
        summary:
          procedureId === 30483
            ? airportProceduresResponse.procedures[1]
            : airportProceduresResponse.procedures[0],
      };
    });

    const view = render(<App />);

    await view.findByText("IDKE2G");
    await user.click(view.getByRole("button", { name: "I01-Y" }));

    await vi.waitFor(() => {
      expect(view.getByTestId("map-selected-procedure")).toHaveTextContent("I01-Y");
    });
  });

  it("re-requests layers when a hidden layer is toggled on", async () => {
    const user = userEvent.setup();

    const view = render(<App />);
    await view.findByText("Airways");

    await user.click(view.getByRole("button", { name: "Waypoints" }));

    await vi.waitFor(() => {
      expect(api.getMapLayers).toHaveBeenCalled();
    });

    const lastCall = vi.mocked(api.getMapLayers).mock.calls.at(-1);
    expect(lastCall?.[1].waypoints).toBe(true);
  });
});
