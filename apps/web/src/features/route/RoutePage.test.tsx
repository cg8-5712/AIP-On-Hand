import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RoutePage } from "./RoutePage";
import * as api from "../../lib/api";

describe("RoutePage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("submits route planning inputs and renders candidate routes", async () => {
    const user = userEvent.setup();

    vi.spyOn(api, "planRoute").mockResolvedValue({
      departureAirport: {
        id: 1,
        ident: "ZBAA",
        icao: "ZBAA",
        name: "Capital",
        location: { lon: 116.5983, lat: 40.0733 },
      },
      arrivalAirport: {
        id: 2,
        ident: "ZSPD",
        icao: "ZSPD",
        name: "Pudong",
        location: { lon: 121.805, lat: 31.1434 },
      },
      cruiseAltitudeFt: 36000,
      notes: ["候选按程序点分组。"],
      candidates: [
        {
          totalDistanceNm: 598,
          airwayDistanceNm: 521,
          departure: {
            ident: "BOTPU",
            location: { lon: 115.475, lat: 39.9853 },
            minimumProcedureDistanceNm: 44,
            procedures: [
              {
                procedureId: 71967,
                name: "BOTP7X",
                arincName: "RW01",
                procedureType: "GPS",
                runwayName: "01",
              },
            ],
          },
          airways: [
            {
              airwayName: "A461",
              airwayType: "B",
              routeType: "R",
              direction: "N",
              minimumAltitude: 26500,
              maximumAltitude: 42000,
              fromIdent: "BOTPU",
              toIdent: "PIMOL",
              from: { lon: 115.475, lat: 39.9853 },
              to: { lon: 117.02, lat: 38.941 },
              distanceNm: 98,
            },
          ],
          arrival: {
            ident: "AND",
            location: { lon: 121.9152, lat: 31.5821 },
            minimumProcedureDistanceNm: 33,
            procedures: [
              {
                procedureId: 104624,
                name: "AND91A",
                arincName: "RW34B",
                procedureType: "GPS",
                runwayName: "34B",
              },
            ],
          },
          approaches: [
            {
              procedureId: 204001,
              name: "ILS34L",
              arincName: "ILS34L",
              procedureType: "ILS",
              runwayName: "34L",
            },
          ],
        },
      ],
    });

    render(<RoutePage />);

    await user.type(screen.getByLabelText(/departure/i), "zbaa");
    await user.type(screen.getByLabelText(/arrival/i), "zspd");
    await user.clear(screen.getByLabelText(/cruise alt/i));
    await user.type(screen.getByLabelText(/cruise alt/i), "36000");
    await user.click(screen.getByRole("button", { name: /plan route/i }));

    expect(api.planRoute).toHaveBeenCalledWith(
      expect.objectContaining({
        departure: "ZBAA",
        arrival: "ZSPD",
        cruiseAltitudeFt: 36000,
      }),
    );

    expect(await screen.findByText(/ZBAA to ZSPD at FL360/i)).toBeInTheDocument();
    expect(screen.getByText(/BOTPU A461 PIMOL/i)).toBeInTheDocument();
    expect(screen.getByText(/BOTP7X/i)).toBeInTheDocument();
    expect(screen.getByText(/AND91A/i)).toBeInTheDocument();
    expect(screen.getByText(/ILS34L/i)).toBeInTheDocument();
  });
});
