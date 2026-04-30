import { useEffect, useRef, useState, type FormEvent } from "react";
import { planRoute } from "../../lib/api";
import type {
  RouteAirwaySegment,
  RoutePlanCandidate,
  RoutePlanResponse,
  RouteProcedureOption,
} from "../../types/api";

function formatDistance(distanceNm: number) {
  return `${Math.round(distanceNm)} nm`;
}

function formatDirection(direction?: string | null) {
  switch (direction?.toUpperCase()) {
    case "F":
      return "one-way";
    case "B":
      return "reverse one-way";
    default:
      return "two-way";
  }
}

function formatAltitudeBand(segment: RouteAirwaySegment) {
  const minimum = segment.minimumAltitude ?? null;
  const maximum = segment.maximumAltitude ?? null;

  if (minimum !== null && maximum !== null) {
    return `${minimum}-${maximum} ft`;
  }

  if (minimum !== null) {
    return `>= ${minimum} ft`;
  }

  if (maximum !== null) {
    return `<= ${maximum} ft`;
  }

  return "unrestricted";
}

function formatProcedureLabel(procedure: RouteProcedureOption) {
  const runway = procedure.runwayName ? `RWY ${procedure.runwayName}` : "RWY later";
  return `${procedure.name} / ${runway}`;
}

function formatAirwaySequence(segments: RouteAirwaySegment[]) {
  if (segments.length === 0) {
    return "No airway path";
  }

  const sequence = [segments[0].fromIdent];
  for (const segment of segments) {
    sequence.push(segment.airwayName);
    sequence.push(segment.toIdent);
  }

  return sequence.join(" ");
}

function CandidateCard({ candidate, index }: { candidate: RoutePlanCandidate; index: number }) {
  return (
    <article className="rounded-[24px] border border-slate-700/70 bg-slate-950/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="section-kicker">Candidate {index + 1}</p>
          <h3 className="section-title mt-1 text-[1.15rem]">{formatAirwaySequence(candidate.airways)}</h3>
        </div>
        <div className="grid min-w-[180px] gap-2 text-right">
          <div>
            <p className="m-0 text-[0.72rem] uppercase tracking-[0.28em] text-slate-500">Total</p>
            <p className="m-0 font-mono text-[1.1rem] text-slate-100">
              {formatDistance(candidate.totalDistanceNm)}
            </p>
          </div>
          <div>
            <p className="m-0 text-[0.72rem] uppercase tracking-[0.28em] text-slate-500">Airway</p>
            <p className="m-0 font-mono text-sm text-slate-300">
              {formatDistance(candidate.airwayDistanceNm)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.25fr_1fr]">
        <section className="rounded-[20px] border border-emerald-400/16 bg-emerald-400/6 p-4">
          <p className="m-0 text-[0.72rem] uppercase tracking-[0.28em] text-emerald-200/80">Departure</p>
          <p className="mt-2 font-mono text-lg text-emerald-100">{candidate.departure.ident}</p>
          <p className="mt-1 text-sm text-slate-300">
            SID shortest path {formatDistance(candidate.departure.minimumProcedureDistanceNm)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {candidate.departure.procedures.map((procedure) => (
              <span
                key={procedure.procedureId}
                className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-100"
              >
                {formatProcedureLabel(procedure)}
              </span>
            ))}
          </div>
        </section>

        <section className="rounded-[20px] border border-sky-400/16 bg-sky-400/6 p-4">
          <p className="m-0 text-[0.72rem] uppercase tracking-[0.28em] text-sky-200/80">Airway</p>
          <div className="mt-2 grid gap-2">
            {candidate.airways.map((segment, segmentIndex) => (
              <div
                key={`${segment.airwayName}-${segmentIndex}-${segment.fromIdent}-${segment.toIdent}`}
                className="rounded-2xl border border-slate-700/70 bg-slate-950/55 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="m-0 font-mono text-sm text-slate-100">
                    {segment.fromIdent} <span className="text-sky-300">{segment.airwayName}</span>{" "}
                    {segment.toIdent}
                  </p>
                  <p className="m-0 font-mono text-xs text-slate-400">
                    {formatDistance(segment.distanceNm)}
                  </p>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  {segment.airwayType} / {formatDirection(segment.direction)} / {formatAltitudeBand(segment)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[20px] border border-amber-400/16 bg-amber-400/6 p-4">
          <p className="m-0 text-[0.72rem] uppercase tracking-[0.28em] text-amber-200/80">Arrival</p>
          <p className="mt-2 font-mono text-lg text-amber-100">{candidate.arrival.ident}</p>
          <p className="mt-1 text-sm text-slate-300">
            STAR shortest path {formatDistance(candidate.arrival.minimumProcedureDistanceNm)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {candidate.arrival.procedures.map((procedure) => (
              <span
                key={procedure.procedureId}
                className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs text-amber-100"
              >
                {formatProcedureLabel(procedure)}
              </span>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-[20px] border border-fuchsia-400/16 bg-fuchsia-400/6 p-4">
        <p className="m-0 text-[0.72rem] uppercase tracking-[0.28em] text-fuchsia-200/80">Approach</p>
        <p className="mt-2 text-sm text-slate-300">
          Approach selection stays open. Use wind and operational constraints to choose the final runway and procedure.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {candidate.approaches.length > 0 ? (
            candidate.approaches.map((procedure) => (
              <span
                key={procedure.procedureId}
                className="rounded-full border border-fuchsia-300/20 bg-fuchsia-300/10 px-3 py-1 text-xs text-fuchsia-100"
              >
                {formatProcedureLabel(procedure)}
              </span>
            ))
          ) : (
            <span className="text-sm text-slate-400">No published approach candidates were resolved.</span>
          )}
        </div>
      </section>
    </article>
  );
}

export function RoutePage() {
  const [departure, setDeparture] = useState("");
  const [arrival, setArrival] = useState("");
  const [cruiseAltitudeFt, setCruiseAltitudeFt] = useState("36000");
  const [limit, setLimit] = useState("5");
  const [result, setResult] = useState<RoutePlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedDeparture = departure.trim().toUpperCase();
    const normalizedArrival = arrival.trim().toUpperCase();
    const parsedCruiseAltitude = Number(cruiseAltitudeFt);
    const parsedLimit = Number(limit);

    if (!normalizedDeparture || !normalizedArrival) {
      setError("Departure and arrival airport identifiers are required.");
      setResult(null);
      return;
    }

    if (!Number.isFinite(parsedCruiseAltitude) || parsedCruiseAltitude <= 0) {
      setError("Cruise altitude must be a positive number in feet.");
      setResult(null);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const response = await planRoute({
        departure: normalizedDeparture,
        arrival: normalizedArrival,
        cruiseAltitudeFt: parsedCruiseAltitude,
        limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 5,
        signal: controller.signal,
      });
      setResult(response);
    } catch (requestError) {
      if (controller.signal.aborted) {
        return;
      }

      setResult(null);
      setError(requestError instanceof Error ? requestError.message : "Failed to plan route");
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }

  return (
    <section className="grid gap-4">
      <div className="rounded-[22px] border border-slate-700/60 bg-slate-950/55 p-5">
        <p className="section-kicker">Route Planner</p>
        <h2 className="section-title mt-1">Procedure-Point Driven Planning</h2>
        <p className="support-copy mt-3 text-sm">
          Enter cruise altitude, departure airport, and arrival airport. The planner filters
          legal routes through SID and STAR anchor points first, then leaves runway and final
          procedure selection to the user.
        </p>

        <form className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_170px_120px_auto]" onSubmit={handleSubmit}>
          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.26em] text-slate-400">Departure</span>
            <input
              value={departure}
              onChange={(event) => setDeparture(event.target.value)}
              placeholder="ZBAA"
              className="rounded-2xl border border-slate-700/70 bg-slate-950/75 px-4 py-3 font-mono text-sm text-slate-100 outline-none transition focus:border-sky-300/60"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.26em] text-slate-400">Arrival</span>
            <input
              value={arrival}
              onChange={(event) => setArrival(event.target.value)}
              placeholder="ZSPD"
              className="rounded-2xl border border-slate-700/70 bg-slate-950/75 px-4 py-3 font-mono text-sm text-slate-100 outline-none transition focus:border-sky-300/60"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.26em] text-slate-400">Cruise Alt</span>
            <input
              value={cruiseAltitudeFt}
              onChange={(event) => setCruiseAltitudeFt(event.target.value)}
              placeholder="36000"
              inputMode="numeric"
              className="rounded-2xl border border-slate-700/70 bg-slate-950/75 px-4 py-3 font-mono text-sm text-slate-100 outline-none transition focus:border-sky-300/60"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.26em] text-slate-400">Candidates</span>
            <input
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
              placeholder="5"
              inputMode="numeric"
              className="rounded-2xl border border-slate-700/70 bg-slate-950/75 px-4 py-3 font-mono text-sm text-slate-100 outline-none transition focus:border-sky-300/60"
            />
          </label>

          <button
            type="submit"
            disabled={isLoading}
            className="rounded-2xl border border-sky-300/30 bg-sky-300/12 px-5 py-3 text-sm font-medium text-sky-100 transition hover:border-sky-200/60 hover:bg-sky-300/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Planning..." : "Plan Route"}
          </button>
        </form>

        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
      </div>

      {result ? (
        <>
          <div className="rounded-[22px] border border-slate-700/60 bg-slate-950/55 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="section-kicker">Plan Summary</p>
                <h3 className="section-title mt-1 text-[1.12rem]">
                  {result.departureAirport.ident} to {result.arrivalAirport.ident} at FL
                  {Math.round(result.cruiseAltitudeFt / 100)}
                </h3>
              </div>
              <div className="grid gap-1 text-right">
                <p className="m-0 text-[0.72rem] uppercase tracking-[0.28em] text-slate-500">Candidates</p>
                <p className="m-0 font-mono text-[1.1rem] text-slate-100">{result.candidates.length}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              {result.notes.map((note) => (
                <p
                  key={note}
                  className="m-0 rounded-2xl border border-slate-700/60 bg-slate-900/60 px-4 py-3 text-sm text-slate-300"
                >
                  {note}
                </p>
              ))}
            </div>
          </div>

          {result.candidates.length > 0 ? (
            result.candidates.map((candidate, index) => (
              <CandidateCard
                key={`${candidate.departure.ident}-${candidate.arrival.ident}-${index}`}
                candidate={candidate}
                index={index}
              />
            ))
          ) : (
            <div className="rounded-[22px] border border-slate-700/60 bg-slate-950/55 p-5">
              <p className="m-0 text-sm text-slate-300">
                No airway-connected candidate was found for the current altitude and procedure-point combination.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-[22px] border border-slate-700/60 bg-slate-950/55 p-5">
          <p className="m-0 text-sm text-slate-300">
            Results are shown in this order: departure airport, SID options, SID exit point,
            airway path, STAR entry point, STAR options, approach options, arrival airport.
          </p>
        </div>
      )}
    </section>
  );
}
