import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RoutePage } from "./RoutePage";
import * as api from "../../lib/api";

describe("RoutePage", () => {
  beforeEach(() => {
    cleanup();
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
    vi.spyOn(api, "getAirportTransitions").mockResolvedValue({
      airport: {
        id: 2,
        ident: "ZSPD",
        icao: "ZSPD",
        name: "Pudong",
        location: { lon: 121.805, lat: 31.1434 },
      },
      transitions: [],
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
          arrivalTransitionId: null,
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
          arrivalTransitionId: null,
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

    rerender(<RoutePage onRoutePreviewChange={previewSpy} planningSelection={{ kind: "procedure", id: 71967 }} />);

    await waitFor(() => {
      expect(previewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          departureProcedureId: 71967,
          arrivalProcedureId: null,
          arrivalTransitionId: null,
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

  it("collapses departure SID previews after confirmation and restores them when unconfirmed", async () => {
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
      notes: [],
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
                procedureType: "SID",
                runwayName: "01",
              },
              {
                procedureId: 71969,
                name: "DAGA8A",
                arincName: "RW01",
                procedureType: "SID",
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
            procedures: [],
          },
          approaches: [],
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
              id: 71969,
              airportIdent: "ZBAA",
              airportName: "Capital",
              name: "DAGA8A",
              arincName: "RW01",
              procedureType: "SID",
              procedureKind: "sid",
              runwayName: "01",
              legs: 5,
            },
            {
              id: 71970,
              airportIdent: "ZBAA",
              airportName: "Capital",
              name: "EXTRA1A",
              arincName: "RW01",
              procedureType: "SID",
              procedureKind: "sid",
              runwayName: "01",
              legs: 4,
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
    vi.spyOn(api, "getAirportTransitions").mockResolvedValue({
      airport: {
        id: 2,
        ident: "ZSPD",
        icao: "ZSPD",
        name: "Pudong",
        location: { lon: 121.805, lat: 31.1434 },
      },
      transitions: [],
    });

    const { rerender } = render(<RoutePage onRoutePreviewChange={previewSpy} />);

    await user.type(screen.getByLabelText(/departure/i), "zbaa");
    await user.type(screen.getByLabelText(/arrival/i), "zspd");
    await user.clear(screen.getByLabelText(/cruise alt/i));
    await user.type(screen.getByLabelText(/cruise alt/i), "36000");
    await user.click(screen.getByRole("button", { name: /plan route/i }));
    await user.click(await screen.findByRole("button", { name: /show on map/i }));
    await user.click(await screen.findByRole("button", { name: "RWY 01" }));

    await waitFor(() => {
      expect(previewSpy).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          departure: expect.objectContaining({
            displayedProcedureIds: [71967, 71969],
            selectedProcedureId: null,
          }),
        }),
      );
    });

    rerender(<RoutePage onRoutePreviewChange={previewSpy} planningSelection={{ kind: "procedure", id: 71967 }} />);

    await waitFor(() => {
      expect(previewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          departureProcedureId: 71967,
        }),
        expect.objectContaining({
          departure: expect.objectContaining({
            displayedProcedureIds: [71967, 71969],
            selectedProcedureId: 71967,
          }),
        }),
      );
    });

    await user.click(screen.getByRole("button", { name: /confirm sid/i }));

    await waitFor(() => {
      expect(previewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          departureProcedureId: 71967,
        }),
        expect.objectContaining({
          departure: expect.objectContaining({
            displayedProcedureIds: [71967],
            selectedProcedureId: 71967,
          }),
        }),
      );
    });

    await user.click(screen.getByRole("button", { name: /sid confirmed/i }));

    await waitFor(() => {
      expect(previewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          departureProcedureId: 71967,
        }),
        expect.objectContaining({
          departure: expect.objectContaining({
            displayedProcedureIds: [71967, 71969],
            selectedProcedureId: 71967,
          }),
        }),
      );
    });
  });

  it("collapses arrival STAR previews after confirmation and restores them when unconfirmed", async () => {
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
      notes: [],
      candidates: [
        {
          totalDistanceNm: 598,
          airwayDistanceNm: 521,
          departure: {
            ident: "BOTPU",
            location: { lon: 115.475, lat: 39.9853 },
            minimumProcedureDistanceNm: 44,
            procedures: [],
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
                procedureType: "STAR",
                runwayName: "34L",
              },
              {
                procedureId: 104625,
                name: "PUDU8A",
                arincName: "RW34L",
                procedureType: "STAR",
                runwayName: "34L",
              },
            ],
          },
          approaches: [],
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
            id: 104625,
            airportIdent: "ZSPD",
            airportName: "Pudong",
            name: "PUDU8A",
            arincName: "RW34L",
            procedureType: "STAR",
            procedureKind: "star",
            runwayName: "34L",
            legs: 6,
          },
          {
            id: 104626,
            airportIdent: "ZSPD",
            airportName: "Pudong",
            name: "EXTRA3A",
            arincName: "RW34L",
            procedureType: "STAR",
            procedureKind: "star",
            runwayName: "34L",
            legs: 6,
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
    vi.spyOn(api, "getAirportTransitions").mockResolvedValue({
      airport: {
        id: 2,
        ident: "ZSPD",
        icao: "ZSPD",
        name: "Pudong",
        location: { lon: 121.805, lat: 31.1434 },
      },
      transitions: [],
    });

    const { rerender } = render(<RoutePage onRoutePreviewChange={previewSpy} />);

    await user.type(screen.getByLabelText(/departure/i), "zbaa");
    await user.type(screen.getByLabelText(/arrival/i), "zspd");
    await user.clear(screen.getByLabelText(/cruise alt/i));
    await user.type(screen.getByLabelText(/cruise alt/i), "36000");
    await user.click(screen.getByRole("button", { name: /plan route/i }));
    await user.click(await screen.findByRole("button", { name: /show on map/i }));
    await user.click(await screen.findByRole("button", { name: "RWY 34L" }));

    await waitFor(() => {
      expect(previewSpy).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          arrivalStar: expect.objectContaining({
            displayedProcedureIds: [104624, 104625],
            selectedProcedureId: null,
          }),
        }),
      );
    });

    rerender(<RoutePage onRoutePreviewChange={previewSpy} planningSelection={{ kind: "procedure", id: 104624 }} />);

    await waitFor(() => {
      expect(previewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          arrivalProcedureId: 104624,
        }),
        expect.objectContaining({
          arrivalStar: expect.objectContaining({
            displayedProcedureIds: [104624, 104625],
            selectedProcedureId: 104624,
          }),
        }),
      );
    });

    await user.click(screen.getByRole("button", { name: /confirm star/i }));

    await waitFor(() => {
      expect(previewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          arrivalProcedureId: 104624,
        }),
        expect.objectContaining({
          arrivalStar: expect.objectContaining({
            displayedProcedureIds: [104624],
            selectedProcedureId: 104624,
          }),
        }),
      );
    });

    await user.click(screen.getByRole("button", { name: /star confirmed/i }));

    await waitFor(() => {
      expect(previewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          arrivalProcedureId: 104624,
        }),
        expect.objectContaining({
          arrivalStar: expect.objectContaining({
            displayedProcedureIds: [104624, 104625],
            selectedProcedureId: 104624,
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
            procedures: [
              {
                procedureId: 103220,
                name: "BELA6M",
                arincName: "RWY01L",
                procedureType: "STAR",
                runwayName: "01L",
              },
              {
                procedureId: 103221,
                name: "BELA6M",
                arincName: "RW35B",
                procedureType: "STAR",
                runwayName: null,
              },
            ],
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
    vi.spyOn(api, "getAirportTransitions").mockResolvedValue({
      airport: {
        id: 10,
        ident: "ZBAD",
        icao: "ZBAD",
        name: "Daxing",
        location: { lon: 116.4106, lat: 39.5098 },
      },
      transitions: [],
    });

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

  it("compresses consecutive airway segments with the same airway name in the candidate title", async () => {
    const user = userEvent.setup();

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
        ident: "ZSPD",
        icao: "ZSPD",
        name: "Pudong",
        location: { lon: 121.805, lat: 31.1434 },
      },
      cruiseAltitudeFt: 32000,
      notes: [],
      candidates: [
        {
          totalDistanceNm: 888,
          airwayDistanceNm: 777,
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
              toIdent: "ATPIR",
              from: { lon: 116.1, lat: 39.7 },
              to: { lon: 116.3, lat: 39.6 },
              distanceNm: 12,
            },
            {
              airwayName: "W37",
              airwayType: "B",
              routeType: "R",
              direction: "N",
              minimumAltitude: 0,
              maximumAltitude: 99999,
              fromIdent: "ATPIR",
              toIdent: "IGMUD",
              from: { lon: 116.3, lat: 39.6 },
              to: { lon: 116.5, lat: 39.4 },
              distanceNm: 14,
            },
            {
              airwayName: "W37",
              airwayType: "B",
              routeType: "R",
              direction: "N",
              minimumAltitude: 0,
              maximumAltitude: 99999,
              fromIdent: "IGMUD",
              toIdent: "GUSIV",
              from: { lon: 116.5, lat: 39.4 },
              to: { lon: 117.2, lat: 38.8 },
              distanceNm: 120,
            },
            {
              airwayName: "V52",
              airwayType: "B",
              routeType: "R",
              direction: "N",
              minimumAltitude: 0,
              maximumAltitude: 99999,
              fromIdent: "GUSIV",
              toIdent: "OPUNI",
              from: { lon: 117.2, lat: 38.8 },
              to: { lon: 118.1, lat: 37.9 },
              distanceNm: 80,
            },
            {
              airwayName: "R473",
              airwayType: "B",
              routeType: "R",
              direction: "N",
              minimumAltitude: 0,
              maximumAltitude: 99999,
              fromIdent: "OPUNI",
              toIdent: "BEMAG",
              from: { lon: 118.1, lat: 37.9 },
              to: { lon: 119.0, lat: 36.8 },
              distanceNm: 70,
            },
            {
              airwayName: "V5",
              airwayType: "B",
              routeType: "R",
              direction: "N",
              minimumAltitude: 0,
              maximumAltitude: 99999,
              fromIdent: "BEMAG",
              toIdent: "OVTIX",
              from: { lon: 119.0, lat: 36.8 },
              to: { lon: 120.1, lat: 35.7 },
              distanceNm: 65,
            },
            {
              airwayName: "V5",
              airwayType: "B",
              routeType: "R",
              direction: "N",
              minimumAltitude: 0,
              maximumAltitude: 99999,
              fromIdent: "OVTIX",
              toIdent: "IRTAT",
              from: { lon: 120.1, lat: 35.7 },
              to: { lon: 120.9, lat: 34.9 },
              distanceNm: 55,
            },
            {
              airwayName: "V5",
              airwayType: "B",
              routeType: "R",
              direction: "N",
              minimumAltitude: 0,
              maximumAltitude: 99999,
              fromIdent: "IRTAT",
              toIdent: "ENVIP",
              from: { lon: 120.9, lat: 34.9 },
              to: { lon: 121.8, lat: 31.5 },
              distanceNm: 180,
            },
          ],
          arrival: {
            ident: "ENVIP",
            location: { lon: 121.8, lat: 31.5 },
            minimumProcedureDistanceNm: 29,
            procedures: [],
          },
          approaches: [],
        },
      ],
    });

    vi.spyOn(api, "getAirportProcedures").mockImplementation(async (airportIdent) => ({
      airport: {
        id: airportIdent === "ZBAD" ? 10 : 11,
        ident: airportIdent,
        icao: airportIdent,
        name: airportIdent === "ZBAD" ? "Daxing" : "Pudong",
        location: airportIdent === "ZBAD" ? { lon: 116.4106, lat: 39.5098 } : { lon: 121.805, lat: 31.1434 },
      },
      procedures: [],
    }));

    vi.spyOn(api, "getAirportRunwayEnds").mockResolvedValue([]);
    vi.spyOn(api, "getAirportTransitions").mockImplementation(async (airportIdent) => ({
      airport: {
        id: airportIdent === "ZBAD" ? 10 : 11,
        ident: airportIdent,
        icao: airportIdent,
        name: airportIdent === "ZBAD" ? "Daxing" : "Pudong",
        location: airportIdent === "ZBAD" ? { lon: 116.4106, lat: 39.5098 } : { lon: 121.805, lat: 31.1434 },
      },
      transitions: [],
    }));

    render(<RoutePage />);

    await user.type(screen.getByLabelText(/departure/i), "zbad");
    await user.type(screen.getByLabelText(/arrival/i), "zspd");
    await user.clear(screen.getByLabelText(/cruise alt/i));
    await user.type(screen.getByLabelText(/cruise alt/i), "32000");
    await user.click(screen.getByRole("button", { name: /plan route/i }));

    expect(await screen.findByText("OMDEK W37 GUSIV V52 OPUNI R473 BEMAG V5 ENVIP")).toBeInTheDocument();
  });

  it("collapses arrival transition and approach previews after confirmation and restores them when unconfirmed", async () => {
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
      notes: [],
      candidates: [
        {
          totalDistanceNm: 598,
          airwayDistanceNm: 521,
          departure: {
            ident: "BOTPU",
            location: { lon: 115.475, lat: 39.9853 },
            minimumProcedureDistanceNm: 44,
            procedures: [],
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
                procedureType: "STAR",
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
          {
            id: 204002,
            airportIdent: "ZSPD",
            airportName: "Pudong",
            name: "RNAV34L",
            arincName: "RNAV34L",
            procedureType: "RNAV",
            procedureKind: "approach",
            runwayName: "34L",
            legs: 7,
          },
          {
            id: 204003,
            airportIdent: "ZSPD",
            airportName: "Pudong",
            name: "VOR34L",
            arincName: "VOR34L",
            procedureType: "VOR",
            procedureKind: "approach",
            runwayName: "34L",
            legs: 6,
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

    vi.spyOn(api, "getAirportTransitions").mockResolvedValue({
      airport: {
        id: 2,
        ident: "ZSPD",
        icao: "ZSPD",
        name: "Pudong",
        location: { lon: 121.805, lat: 31.1434 },
      },
      transitions: [
        {
          id: 9001,
          airportIdent: "ZSPD",
          airportName: "Pudong",
          approachId: 204001,
          approachName: "ILS34L",
          runwayName: "34L",
          name: "AD521",
          transitionType: "IAF",
          legs: 4,
        },
        {
          id: 9002,
          airportIdent: "ZSPD",
          airportName: "Pudong",
          approachId: 204002,
          approachName: "RNAV34L",
          runwayName: "34L",
          name: "AD521",
          transitionType: "IAF",
          legs: 5,
        },
        {
          id: 9003,
          airportIdent: "ZSPD",
          airportName: "Pudong",
          approachId: 204003,
          approachName: "VOR34L",
          runwayName: "34L",
          name: "AD561",
          transitionType: "IAF",
          legs: 5,
        },
      ],
    });

    const { rerender } = render(<RoutePage onRoutePreviewChange={previewSpy} />);

    await user.type(screen.getByLabelText(/departure/i), "zbaa");
    await user.type(screen.getByLabelText(/arrival/i), "zspd");
    await user.clear(screen.getByLabelText(/cruise alt/i));
    await user.type(screen.getByLabelText(/cruise alt/i), "36000");
    await user.click(screen.getByRole("button", { name: /plan route/i }));
    await user.click(await screen.findByRole("button", { name: /show on map/i }));
    await user.click(await screen.findByRole("button", { name: "RWY 34L" }));

    rerender(<RoutePage onRoutePreviewChange={previewSpy} planningSelection={{ kind: "procedure", id: 104624 }} />);

    await waitFor(() => {
      expect(previewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          arrivalProcedureId: 104624,
          arrivalTransitionId: null,
          approachProcedureId: null,
        }),
        expect.objectContaining({
          arrivalTransition: expect.objectContaining({
            displayedTransitionIds: [9001, 9003],
            selectedTransitionId: null,
          }),
        }),
      );
    });

    rerender(<RoutePage onRoutePreviewChange={previewSpy} planningSelection={{ kind: "transition", id: 9001 }} />);

    await waitFor(() => {
      expect(previewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          arrivalProcedureId: 104624,
          arrivalTransitionId: 9001,
          approachProcedureId: null,
        }),
        expect.objectContaining({
          arrivalTransition: expect.objectContaining({
            displayedTransitionIds: [9001, 9003],
            selectedTransitionId: 9001,
          }),
          arrivalApproach: expect.objectContaining({
            displayedProcedureIds: [204001, 204002],
            selectedProcedureId: null,
          }),
        }),
      );
    });

    await user.click(screen.getByRole("button", { name: /confirm transition/i }));

    await waitFor(() => {
      expect(previewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          arrivalTransitionId: 9001,
        }),
        expect.objectContaining({
          arrivalTransition: expect.objectContaining({
            displayedTransitionIds: [9001],
            selectedTransitionId: 9001,
          }),
        }),
      );
    });

    await user.click(screen.getByRole("button", { name: /transition confirmed/i }));

    await waitFor(() => {
      expect(previewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          arrivalTransitionId: 9001,
        }),
        expect.objectContaining({
          arrivalTransition: expect.objectContaining({
            displayedTransitionIds: [9001, 9003],
            selectedTransitionId: 9001,
          }),
        }),
      );
    });

    rerender(<RoutePage onRoutePreviewChange={previewSpy} planningSelection={{ kind: "procedure", id: 204001 }} />);

    await waitFor(() => {
      expect(previewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          arrivalTransitionId: 9001,
          approachProcedureId: 204001,
        }),
        expect.objectContaining({
          arrivalApproach: expect.objectContaining({
            displayedProcedureIds: [204001, 204002],
            selectedProcedureId: 204001,
          }),
        }),
      );
    });

    await user.click(screen.getByRole("button", { name: /confirm approach/i }));

    await waitFor(() => {
      expect(previewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          approachProcedureId: 204001,
        }),
        expect.objectContaining({
          arrivalApproach: expect.objectContaining({
            displayedProcedureIds: [204001],
            selectedProcedureId: 204001,
          }),
        }),
      );
    });

    await user.click(screen.getByRole("button", { name: /approach confirmed/i }));

    await waitFor(() => {
      expect(previewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          approachProcedureId: 204001,
        }),
        expect.objectContaining({
          arrivalApproach: expect.objectContaining({
            displayedProcedureIds: [204001, 204002],
            selectedProcedureId: 204001,
          }),
        }),
      );
    });
  });
});
