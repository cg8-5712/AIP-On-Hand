import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import * as api from "./lib/api";
import type {
  AirportProceduresResponse,
  MapLayersResponse,
  ProcedureGeometryResponse,
  SearchResponse,
} from "./types/api";

vi.mock("./features/map/MapView", async () => {
  const React = await import("react");

  return {
    MapView: ({
      layers,
      selectedAirportIdent,
      selectedProcedure,
      focusRequest,
      onViewportChange,
    }: {
      layers: MapLayersResponse | null;
      selectedAirportIdent: string | null;
      selectedProcedure: ProcedureGeometryResponse | null;
      focusRequest: { requestId: number; kind: string } | null;
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
          <span data-testid="map-focus-request">{focusRequest?.kind ?? "none"}</span>
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

const daxingProceduresResponse: AirportProceduresResponse = {
  airport: {
    id: 17000,
    ident: "ZBAD",
    icao: null,
    name: "Daxing",
    location: { lon: 116.4108, lat: 39.5098 },
  },
  procedures: [
    {
      id: 82001,
      airportIdent: "ZBAD",
      airportName: "Daxing",
      name: "DAXI1A",
      arincName: "RW01L",
      procedureType: "RNAV",
      procedureKind: "sid",
      runwayName: "01L",
      legs: 7,
    },
  ],
};

const daxingProcedureGeometryResponse: ProcedureGeometryResponse = {
  airport: daxingProceduresResponse.airport,
  summary: daxingProceduresResponse.procedures[0],
  path: [
    {
      ident: "DAX01",
      legType: "DF",
      position: { lon: 116.401, lat: 39.5112 },
    },
    {
      ident: "DAXEN",
      legType: "TF",
      position: { lon: 116.118, lat: 39.822 },
    },
  ],
  missedPath: [],
};

const searchResponse: SearchResponse = {
  query: "idke",
  results: [
    {
      id: "procedure:71985",
      entityType: "sid",
      ident: "IDKE2G",
      name: "RW18L",
      airportIdent: "ZBAA",
      airportName: "Capital",
      procedureId: 71985,
      procedureKind: "sid",
      procedureType: "GPS",
      runwayName: "18L",
      location: { lon: 116.5983, lat: 40.0733 },
    },
  ],
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
    vi.spyOn(api, "searchNavdata").mockResolvedValue(searchResponse);
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

  it("does not auto-select a procedure when the visible airport list refreshes", async () => {
    const view = render(<App />);

    await view.findByText("AIP On Hand");
    await vi.waitFor(() => {
      expect(view.getByTestId("map-selected-airport")).toHaveTextContent("ZBAA");
    });

    expect(view.getByTestId("map-selected-procedure")).toHaveTextContent("none");
    expect(api.getProcedureGeometry).not.toHaveBeenCalled();
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

  it("keeps a searched procedure selection while switching to another airport", async () => {
    const user = userEvent.setup();

    vi.spyOn(api, "getAirportProcedures").mockImplementation(async (airportIdent) => {
      return airportIdent === "ZBAD" ? daxingProceduresResponse : airportProceduresResponse;
    });
    vi.spyOn(api, "getProcedureGeometry").mockImplementation(async (procedureId) => {
      return procedureId === 82001 ? daxingProcedureGeometryResponse : procedureGeometryResponse;
    });
    vi.spyOn(api, "searchNavdata").mockResolvedValue({
      query: "daxi",
      results: [
        {
          id: "procedure:82001",
          entityType: "sid",
          ident: "DAXI1A",
          name: "RW01L",
          airportIdent: "ZBAD",
          airportName: "Daxing",
          procedureId: 82001,
          procedureKind: "sid",
          procedureType: "RNAV",
          runwayName: "01L",
          location: { lon: 116.4108, lat: 39.5098 },
        },
      ],
    });

    const view = render(<App />);

    const globalSearch = await view.findByRole("searchbox", {
      name: /search navdata and procedures/i,
    });

    await user.type(globalSearch, "daxi");
    await user.click(await view.findByRole("button", { name: "DAXI1A" }));

    await vi.waitFor(() => {
      expect(view.getByTestId("map-selected-airport")).toHaveTextContent("ZBAD");
      expect(view.getByTestId("map-selected-procedure")).toHaveTextContent("DAXI1A");
    });
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

  it("filters procedure list by selected procedure type", async () => {
    const user = userEvent.setup();

    const view = render(<App />);
    await view.findByText("IDKE2G");

    await user.click(view.getByRole("button", { name: "Approach" }));

    expect(view.queryByRole("button", { name: "IDKE2G" })).not.toBeInTheDocument();
    expect(view.getByRole("button", { name: "I01-Y" })).toBeInTheDocument();
  });
});
