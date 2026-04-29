import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import * as api from "./lib/api";

vi.mock("./features/map/MapView", () => ({
  MapView: ({
    airports,
    highlightedAirportId,
    showAirports,
    showRoute,
  }: {
    airports: Array<{ icao: string }>;
    highlightedAirportId: string | null;
    showAirports: boolean;
    showRoute: boolean;
  }) => (
    <div data-testid="map-view">
      <span data-testid="map-airport-count">{airports.length}</span>
      <span data-testid="map-highlighted-airport">{highlightedAirportId ?? "none"}</span>
      <span data-testid="map-airports-visible">{String(showAirports)}</span>
      <span data-testid="map-route-visible">{String(showRoute)}</span>
    </div>
  ),
}));

const sampleAirports = [
  {
    id: "airport:zbaa",
    icao: "ZBAA",
    name: "Beijing Capital",
    location: { lat: 40.0801, lon: 116.5846 },
  },
  {
    id: "airport:zspd",
    icao: "ZSPD",
    name: "Shanghai Pudong",
    location: { lat: 31.1434, lon: 121.8052 },
  },
  {
    id: "airport:zggg",
    icao: "ZGGG",
    name: "Guangzhou Baiyun",
    location: { lat: 23.3924, lon: 113.2988 },
  },
];

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
    vi.spyOn(api, "getSampleAirports").mockResolvedValue(sampleAirports);
  });

  it("renders backend status and the default highlighted airport", async () => {
    render(<App />);

    await screen.findByText("AIP On Hand");
    await screen.findByText("ok");
    await screen.findByText("aip-api");

    expect(screen.getByTestId("map-airport-count")).toHaveTextContent("3");
    expect(screen.getByTestId("map-highlighted-airport")).toHaveTextContent("airport:zbaa");
    expect(screen.getByText("ZBAA  ->  ZSPD  ->  ZGGG")).toBeInTheDocument();
  });

  it("filters airports and updates the map shell props", async () => {
    const user = userEvent.setup();

    render(<App />);

    const filterInput = await screen.findByRole("searchbox", {
      name: /search fixtures/i,
    });

    await user.type(filterInput, "shanghai");

    await waitFor(() => {
      expect(screen.getByTestId("map-airport-count")).toHaveTextContent("1");
    });

    expect(screen.getByText("ZSPD")).toBeInTheDocument();
    expect(screen.queryByText("ZBAA")).not.toBeInTheDocument();
    expect(screen.getByTestId("map-highlighted-airport")).toHaveTextContent("airport:zspd");
  });

  it("allows layer toggles and airport selection to drive map state", async () => {
    const user = userEvent.setup();

    render(<App />);

    await screen.findByText("ZBAA");

    await user.click(screen.getByRole("button", { name: "Route" }));
    await user.click(screen.getByRole("button", { name: "Shanghai Pudong" }));

    expect(screen.getByTestId("map-route-visible")).toHaveTextContent("false");
    expect(screen.getByTestId("map-highlighted-airport")).toHaveTextContent("airport:zspd");
  });

  it("shows an error note when bootstrap fails", async () => {
    vi.spyOn(api, "getHealth").mockRejectedValueOnce(new Error("backend offline"));

    render(<App />);

    await screen.findByText("backend offline");
    expect(screen.getByTestId("map-airport-count")).toHaveTextContent("0");
  });
});
