import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RoutePage } from "./RoutePage";
import * as api from "../../lib/api";

describe("RoutePage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("plans a route, exposes runway-first planning, and accepts map-driven procedure selection", async () => {
    const user = userEvent.setup();
    const previewSpy = vi.fn();

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
      notes: ["Candidates are grouped by procedure point."],
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
                arincName: "RW34L",
                procedureType: "GPS",
                runwayName: "34L",
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

    vi.spyOn(api, "getAirportProcedures").mockImplementation(async (airportIdent) => {
      if (airportIdent === "ZBAA") {
        return {
          airport: {
            id: 1,
            ident: "ZBAA",
            icao: "ZBAA",
            name: "Capital",
            location: { lon: 116.5983, lat: 40.0733 },
          },
          procedures: [
            {
              id: 71967,
              airportIdent: "ZBAA",
              airportName: "Capital",
              name: "BOTP7X",
              arincName: "RW01",
              procedureType: "SID",
              procedureKind: "sid",
              runwayName: "01",
              legs: 6,
            },
            {
              id: 71968,
              airportIdent: "ZBAA",
              airportName: "Capital",
              name: "BOTP9Y",
              arincName: "RW19",
              procedureType: "SID",
              procedureKind: "sid",
              runwayName: "19",
              legs: 5,
            },
          ],
        };
      }

      return {
        airport: {
          id: 2,
          ident: "ZSPD",
          icao: "ZSPD",
          name: "Pudong",
          location: { lon: 121.805, lat: 31.1434 },
        },
        procedures: [
          {
            id: 104624,
            airportIdent: "ZSPD",
            airportName: "Pudong",
            name: "AND91A",
            arincName: "RW34L",
            procedureType: "STAR",
            procedureKind: "star",
            runwayName: "34L",
            legs: 7,
          },
          {
            id: 204001,
            airportIdent: "ZSPD",
            airportName: "Pudong",
            name: "ILS34L",
            arincName: "ILS34L",
            procedureType: "ILS",
            procedureKind: "approach",
            runwayName: "34L",
            legs: 8,
          },
        ],
      };
    });

    vi.spyOn(api, "getAirportRunwayEnds").mockImplementation(async (airportIdent) => {
      if (airportIdent === "ZBAA") {
        return [
          {
            runwayName: "01",
            reciprocalRunwayName: "19",
            headingDeg: 10,
            lengthFt: 12468,
            widthFt: 197,
            surface: "ASP",
            isTakeoff: true,
            isLanding: true,
            ilsIdent: null,
            location: { lon: 116.5983, lat: 40.0733 },
          },
          {
            runwayName: "19",
            reciprocalRunwayName: "01",
            headingDeg: 190,
            lengthFt: 12468,
            widthFt: 197,
            surface: "ASP",
            isTakeoff: true,
            isLanding: true,
            ilsIdent: null,
            location: { lon: 116.61, lat: 40.06 },
          },
        ];
      }

      return [
        {
          runwayName: "34L",
          reciprocalRunwayName: "16R",
          headingDeg: 340,
          lengthFt: 13123,
          widthFt: 197,
          surface: "CON",
          isTakeoff: true,
          isLanding: true,
          ilsIdent: "ISPD",
          location: { lon: 121.805, lat: 31.1434 },
        },
      ];
    });

    const { rerender } = render(<RoutePage onRoutePreviewChange={previewSpy} />);

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
    expect(screen.getByText(/published approach option/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /show on map/i }));

    await waitFor(() => {
      expect(previewSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          departureProcedureId: null,
          arrivalProcedureId: null,
          approachProcedureId: null,
        }),
        expect.objectContaining({
          activeStage: "departure",
          selectedDepartureRunwayName: null,
          selectedArrivalRunwayName: null,
        }),
      );
    });

    await user.click(await screen.findByRole("button", { name: "RWY 01" }));

    await waitFor(() => {
      expect(previewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          departureProcedureId: null,
          arrivalProcedureId: null,
          approachProcedureId: null,
        }),
        expect.objectContaining({
          selectedDepartureRunwayName: "01",
          departure: expect.objectContaining({
            runwayName: "01",
            displayedProcedureIds: [71967],
            selectedProcedureId: null,
          }),
        }),
      );
    });

    rerender(<RoutePage onRoutePreviewChange={previewSpy} planningProcedureSelectionId={71967} />);

    await waitFor(() => {
      expect(previewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          departureProcedureId: 71967,
          arrivalProcedureId: null,
          approachProcedureId: null,
        }),
        expect.objectContaining({
          selectedDepartureRunwayName: "01",
          departure: expect.objectContaining({
            selectedProcedureId: 71967,
          }),
        }),
      );
    });
  });

  it("matches runway-both procedures from arinc names when runway_name is missing", async () => {
    const user = userEvent.setup();
    const previewSpy = vi.fn();

    vi.spyOn(api, "planRoute").mockResolvedValue({
      departureAirport: {
        id: 10,
        ident: "ZBAD",
        icao: "ZBAD",
        name: "Daxing",
        location: { lon: 116.4106, lat: 39.5098 },
      },
      arrivalAirport: {
        id: 11,
        ident: "ZBAD",
        icao: "ZBAD",
        name: "Daxing",
        location: { lon: 116.4106, lat: 39.5098 },
      },
      cruiseAltitudeFt: 12000,
      notes: [],
      candidates: [
        {
          totalDistanceNm: 88,
          airwayDistanceNm: 40,
          departure: {
            ident: "OMDEK",
            location: { lon: 116.1, lat: 39.7 },
            minimumProcedureDistanceNm: 18,
            procedures: [],
          },
          airways: [
            {
              airwayName: "W37",
              airwayType: "B",
              routeType: "R",
              direction: "N",
              minimumAltitude: 0,
              maximumAltitude: 99999,
              fromIdent: "OMDEK",
              toIdent: "ENVIP",
              from: { lon: 116.1, lat: 39.7 },
              to: { lon: 116.7, lat: 39.2 },
              distanceNm: 40,
            },
          ],
          arrival: {
            ident: "ENVIP",
            location: { lon: 116.7, lat: 39.2 },
            minimumProcedureDistanceNm: 29,
            procedures: [],
          },
          approaches: [],
        },
      ],
    });

    vi.spyOn(api, "getAirportProcedures").mockResolvedValue({
      airport: {
        id: 10,
        ident: "ZBAD",
        icao: "ZBAD",
        name: "Daxing",
        location: { lon: 116.4106, lat: 39.5098 },
      },
      procedures: [
        {
          id: 103220,
          airportIdent: "ZBAD",
          airportName: "Daxing",
          name: "BELA6M",
          arincName: "RWY01L",
          procedureType: "STAR",
          procedureKind: "star",
          runwayName: "01L",
          legs: 8,
        },
        {
          id: 103221,
          airportIdent: "ZBAD",
          airportName: "Daxing",
          name: "BELA6M",
          arincName: "RW35B",
          procedureType: "STAR",
          procedureKind: "star",
          runwayName: null,
          legs: 8,
        },
      ],
    });

    vi.spyOn(api, "getAirportRunwayEnds").mockResolvedValue([
      {
        runwayName: "35L",
        reciprocalRunwayName: "17R",
        headingDeg: 350,
        lengthFt: 12467,
        widthFt: 197,
        surface: "CON",
        isTakeoff: true,
        isLanding: true,
        ilsIdent: null,
        location: { lon: 116.401, lat: 39.52 },
      },
      {
        runwayName: "35R",
        reciprocalRunwayName: "17L",
        headingDeg: 350,
        lengthFt: 12467,
        widthFt: 197,
        surface: "CON",
        isTakeoff: true,
        isLanding: true,
        ilsIdent: null,
        location: { lon: 116.421, lat: 39.52 },
      },
    ]);

    const { container } = render(<RoutePage onRoutePreviewChange={previewSpy} />);
    const routeSection = container.querySelector("section");
    expect(routeSection).not.toBeNull();
    const scope = within(routeSection as HTMLElement);

    await user.type(scope.getByLabelText(/departure/i), "zbad");
    await user.type(scope.getByLabelText(/arrival/i), "zbad");
    await user.clear(scope.getByLabelText(/cruise alt/i));
    await user.type(scope.getByLabelText(/cruise alt/i), "12000");
    await user.click(scope.getByRole("button", { name: /plan route/i }));
    await user.click(await scope.findByRole("button", { name: /show on map/i }));

    const runway35lButtons = await scope.findAllByRole("button", { name: "RWY 35L" });
    await user.click(runway35lButtons[runway35lButtons.length - 1]);

    await waitFor(() => {
      expect(previewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          arrivalProcedureId: null,
        }),
        expect.objectContaining({
          selectedArrivalRunwayName: "35L",
          arrivalStar: expect.objectContaining({
            displayedProcedureIds: [103221],
          }),
        }),
      );
    });
  });
});
