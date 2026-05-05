import {
  CandidateCard,
  ProcedureChip,
  SelectionSnapshotField,
  SetupFlowRow,
  WorkflowStepCard,
} from "./RoutePagePieces";
import type { RoutePageProps } from "./RoutePage.types";
import { useRoutePlannerState } from "./useRoutePlannerState";

export type { RoutePageProps } from "./RoutePage.types";

export function RoutePage(props: RoutePageProps) {
  const {
    departure,
    setDeparture,
    arrival,
    setArrival,
    cruiseAltitudeFt,
    setCruiseAltitudeFt,
    limit,
    setLimit,
    result,
    error,
    planningError,
    isLoading,
    activeCandidateIndex,
    departureRunwayOptions,
    arrivalRunwayOptions,
    selectedDepartureRunwayName,
    selectedArrivalRunwayName,
    selectedDepartureProcedureDisplay,
    selectedArrivalProcedureDisplay,
    selectedArrivalTransitionDisplay,
    selectedApproachProcedureDisplay,
    hasSelectedDepartureProcedure,
    hasSelectedArrivalProcedure,
    hasSelectedArrivalTransition,
    hasSelectedApproachProcedure,
    isDepartureProcedureConfirmed,
    isArrivalProcedureConfirmed,
    isArrivalTransitionConfirmed,
    isArrivalApproachConfirmed,
    availableDepartureProcedureCount,
    availableArrivalStarProcedureCount,
    availableArrivalTransitionCount,
    availableArrivalApproachProcedureCount,
    currentWorkflowStageLabel,
    currentFocusDetail,
    workflowSteps,
    selectionSnapshot,
    activeApproachStatusText,
    activeApproachCountText,
    handleSubmit,
    clearDisplayedRoute,
    activateCandidate,
    selectDepartureRunway,
    selectArrivalRunway,
    toggleDepartureProcedureConfirmation,
    toggleArrivalProcedureConfirmation,
    toggleArrivalTransitionConfirmation,
    toggleArrivalApproachConfirmation,
  } = useRoutePlannerState(props);

  return (
    <section className="grid gap-4">
      <div className="rounded-[24px] border border-slate-700/60 bg-slate-950/60 p-5 shadow-[0_24px_54px_rgba(2,8,23,0.24)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="section-kicker">Route Planner</p>
            <h1 className="hero-title mt-2 text-[1.7rem] leading-none sm:text-[2rem]">Route Desk</h1>
            <p className="support-copy mt-3 text-sm">
              Route planning stays first. After you pin one route, continue with runway-first SID, STAR, transition,
              and approach selection.
            </p>
            <p className="support-copy mt-2 text-sm">
              Workflow: select a route candidate, choose departure runway, pick a SID on the map, then choose arrival
              runway, STAR, transition, and approach in order.
            </p>
          </div>
          <div className="grid w-full gap-3 lg:w-auto lg:min-w-[220px]">
            <div className="status-tile">
              <div className="flex items-center justify-between gap-3">
                <p className="stat-label m-0">Workflow</p>
                <span className="rounded-full border border-cyan-300/25 bg-cyan-300/12 px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-cyan-50">
                  Live
                </span>
              </div>
              <p className="m-0 text-sm leading-6 text-slate-100">{currentWorkflowStageLabel}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 xl:grid-cols-5">
          {workflowSteps.map((step, index) => (
            <div key={step.label} className="relative min-w-0">
              <WorkflowStepCard {...step} />
              {index < workflowSteps.length - 1 ? (
                <div className="pointer-events-none absolute right-[-0.45rem] top-1/2 hidden h-px w-2 -translate-y-1/2 bg-gradient-to-r from-cyan-300/30 to-slate-700/0 xl:block" />
              ) : null}
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-[18px] border border-slate-700/60 bg-slate-950/42 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <p className="m-0 text-[0.68rem] uppercase tracking-[0.18em] text-cyan-200/80">Current Focus</p>
            <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-2.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-cyan-50">
              {currentWorkflowStageLabel}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-300">{currentFocusDetail}</p>
        </div>

        <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.26em] text-slate-400">Departure</span>
              <input
                value={departure}
                onChange={(event) => setDeparture(event.target.value)}
                placeholder="ZBAA"
                className="input-shell font-mono text-sm"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.26em] text-slate-400">Arrival</span>
              <input
                value={arrival}
                onChange={(event) => setArrival(event.target.value)}
                placeholder="ZSPD"
                className="input-shell font-mono text-sm"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.26em] text-slate-400">Cruise Alt</span>
              <input
                value={cruiseAltitudeFt}
                onChange={(event) => setCruiseAltitudeFt(event.target.value)}
                placeholder="36000"
                inputMode="numeric"
                className="input-shell font-mono text-sm"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.26em] text-slate-400">Candidates</span>
              <input
                value={limit}
                onChange={(event) => setLimit(event.target.value)}
                placeholder="5"
                inputMode="numeric"
                className="input-shell font-mono text-sm"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isLoading}
              className="cursor-pointer rounded-2xl border border-sky-300/30 bg-sky-300/12 px-5 py-3 text-sm font-medium text-sky-100 transition duration-200 hover:border-sky-200/60 hover:bg-sky-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/35 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Planning..." : "Plan Route"}
            </button>

            <button
              type="button"
              onClick={clearDisplayedRoute}
              disabled={activeCandidateIndex === null}
              className="cursor-pointer rounded-2xl border border-slate-300/18 bg-slate-900/55 px-5 py-3 text-sm font-medium text-slate-200 transition duration-200 hover:border-slate-200/40 hover:bg-slate-900/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/25 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Clear displayed route
            </button>
          </div>
        </form>

        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
        {planningError ? <p className="mt-2 text-sm text-amber-200">{planningError}</p> : null}
      </div>

      {result ? (
        <>
          <div className="rounded-[22px] border border-slate-700/60 bg-slate-950/55 p-5 shadow-[0_18px_42px_rgba(2,8,23,0.2)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="section-kicker">Plan Summary</p>
                <h3 className="section-title mt-1 break-words text-[1.12rem]">
                  {result.departureAirport.ident} to {result.arrivalAirport.ident} at FL
                  {Math.round(result.cruiseAltitudeFt / 100)}
                </h3>
                {activeCandidateIndex !== null ? (
                  <p className="mt-2 text-sm text-cyan-200">
                    The selected route is pinned on the map and will stay there until you clear it.
                  </p>
                ) : null}
              </div>
              <div className="grid gap-1 text-left sm:text-right">
                <p className="m-0 text-[0.72rem] uppercase tracking-[0.28em] text-slate-500">Candidates</p>
                <p className="m-0 font-mono text-[1.1rem] text-slate-100">{result.candidates.length}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="status-tile">
                <p className="stat-label m-0">Active Route</p>
                <p className="m-0 text-sm text-slate-100">
                  {activeCandidateIndex !== null ? `Candidate ${activeCandidateIndex + 1}` : "No candidate pinned"}
                </p>
              </div>
              <div className="status-tile">
                <p className="stat-label m-0">Cruise</p>
                <p className="m-0 font-mono text-[1.02rem] text-slate-100">
                  FL{Math.round(result.cruiseAltitudeFt / 100)}
                </p>
              </div>
              <div className="status-tile">
                <p className="stat-label m-0">Current Stage</p>
                <p className="m-0 text-sm text-slate-100">{currentWorkflowStageLabel}</p>
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

          <div className="rounded-[22px] border border-slate-700/60 bg-slate-950/55 p-5 shadow-[0_18px_42px_rgba(2,8,23,0.2)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="section-kicker">Selection Snapshot</p>
                <h3 className="section-title mt-1 text-[1.08rem]">Current route build state</h3>
                <p className="mt-2 text-sm text-slate-300">
                  Keep this panel in view while working through runway, procedure, transition, and approach choices.
                </p>
              </div>
              <div className="rounded-full border border-slate-300/18 bg-slate-300/8 px-3 py-1 text-[0.68rem] uppercase tracking-[0.2em] text-slate-300">
                {currentWorkflowStageLabel}
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {selectionSnapshot.map((item) => (
                <SelectionSnapshotField key={item.label} {...item} />
              ))}
            </div>
          </div>

          {activeCandidateIndex !== null ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <section className="rounded-[22px] border border-emerald-400/16 bg-emerald-400/6 p-5 shadow-[0_18px_42px_rgba(16,185,129,0.08)]">
                <p className="m-0 text-[0.72rem] uppercase tracking-[0.28em] text-emerald-200/80">Departure Setup</p>
                <p className="mt-2 text-sm text-slate-300">
                  Choose departure runway first. The map will then display all matching SID procedures with names; click
                  a SID on the map to confirm it.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {departureRunwayOptions.map((runway) => (
                    <ProcedureChip
                      key={`${runway.runwayName}-${runway.headingDeg}`}
                      label={`RWY ${runway.runwayName}`}
                      isActive={selectedDepartureRunwayName === runway.runwayName}
                      onClick={() => selectDepartureRunway(runway.runwayName)}
                    />
                  ))}
                </div>
                <p className="mt-4 text-sm text-slate-300">
                  {selectedDepartureRunwayName
                    ? `${availableDepartureProcedureCount} SID option(s) are available for RWY ${selectedDepartureRunwayName}.`
                    : "Select a departure runway to preview matching SID procedures on the map."}
                </p>
                <div className="mt-4 grid gap-3">
                  <SetupFlowRow
                    label="Runway"
                    value={selectedDepartureRunwayName ? `RWY ${selectedDepartureRunwayName}` : "Pending"}
                    hint={selectedDepartureRunwayName ? "Departure runway selected." : "Choose a runway to unlock SID choices."}
                    tone="emerald"
                  />
                  <SetupFlowRow
                    label="SID"
                    value={selectedDepartureProcedureDisplay ?? "Waiting for map selection"}
                    hint={
                      hasSelectedDepartureProcedure
                        ? isDepartureProcedureConfirmed
                          ? "Confirmed and isolated on the map."
                          : "Selected on the map. Confirm if you want to hide the other SID candidates."
                        : "Pick one SID from the displayed route-linked procedures."
                    }
                    tone="emerald"
                    actionLabel={
                      hasSelectedDepartureProcedure
                        ? isDepartureProcedureConfirmed
                          ? "SID confirmed"
                          : "Confirm SID"
                        : undefined
                    }
                    onAction={hasSelectedDepartureProcedure ? toggleDepartureProcedureConfirmation : undefined}
                  />
                </div>
              </section>

              <section className="rounded-[22px] border border-amber-400/16 bg-amber-400/6 p-5 shadow-[0_18px_42px_rgba(245,158,11,0.08)]">
                <p className="m-0 text-[0.72rem] uppercase tracking-[0.28em] text-amber-200/80">Arrival Setup</p>
                <p className="mt-2 text-sm text-slate-300">
                  Choose arrival runway first. Then the map will display matching STAR procedures; after a STAR is
                  chosen, matching transitions will appear; after a transition is chosen, approach procedures for that
                  runway will be available.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {arrivalRunwayOptions.map((runway) => (
                    <ProcedureChip
                      key={`${runway.runwayName}-${runway.headingDeg}`}
                      label={`RWY ${runway.runwayName}`}
                      isActive={selectedArrivalRunwayName === runway.runwayName}
                      onClick={() => selectArrivalRunway(runway.runwayName)}
                    />
                  ))}
                </div>
                <p className="mt-4 text-sm text-slate-300">
                  {selectedArrivalRunwayName
                    ? `${availableArrivalStarProcedureCount} STAR option(s), ${availableArrivalTransitionCount} transition option(s), and ${availableArrivalApproachProcedureCount} approach option(s) are available for RWY ${selectedArrivalRunwayName}.`
                    : "Select an arrival runway to preview matching STAR procedures on the map."}
                </p>
                <div className="mt-4 grid gap-3">
                  <SetupFlowRow
                    label="Runway"
                    value={selectedArrivalRunwayName ? `RWY ${selectedArrivalRunwayName}` : "Pending"}
                    hint={selectedArrivalRunwayName ? "Arrival runway selected." : "Choose a runway to unlock STAR choices."}
                    tone="amber"
                  />
                  <SetupFlowRow
                    label="STAR"
                    value={selectedArrivalProcedureDisplay ?? "Waiting for map selection"}
                    hint={
                      hasSelectedArrivalProcedure
                        ? isArrivalProcedureConfirmed
                          ? "Confirmed and isolated on the map."
                          : "Selected on the map. Confirm if you want to hide the other STAR candidates."
                        : "Choose one STAR after runway selection."
                    }
                    tone="amber"
                    actionLabel={
                      hasSelectedArrivalProcedure
                        ? isArrivalProcedureConfirmed
                          ? "STAR confirmed"
                          : "Confirm STAR"
                        : undefined
                    }
                    onAction={hasSelectedArrivalProcedure ? toggleArrivalProcedureConfirmation : undefined}
                  />
                  <SetupFlowRow
                    label="Transition"
                    value={selectedArrivalTransitionDisplay ?? "Pending"}
                    hint={
                      hasSelectedArrivalTransition
                        ? isArrivalTransitionConfirmed
                          ? "Confirmed and isolated on the map."
                          : "Selected on the map. Confirm if you want to hide the other transition candidates."
                        : "Transition choices appear after STAR selection."
                    }
                    tone="orange"
                    actionLabel={
                      hasSelectedArrivalTransition
                        ? isArrivalTransitionConfirmed
                          ? "Transition confirmed"
                          : "Confirm transition"
                        : undefined
                    }
                    onAction={hasSelectedArrivalTransition ? toggleArrivalTransitionConfirmation : undefined}
                  />
                  <SetupFlowRow
                    label="Approach"
                    value={selectedApproachProcedureDisplay ?? "Pending"}
                    hint={
                      hasSelectedApproachProcedure
                        ? isArrivalApproachConfirmed
                          ? "Confirmed and isolated on the map."
                          : "Selected on the map. Confirm if you want to hide the other approach candidates."
                        : "Approach choices appear after transition selection."
                    }
                    tone="fuchsia"
                    actionLabel={
                      hasSelectedApproachProcedure
                        ? isArrivalApproachConfirmed
                          ? "Approach confirmed"
                          : "Confirm approach"
                        : undefined
                    }
                    onAction={hasSelectedApproachProcedure ? toggleArrivalApproachConfirmation : undefined}
                  />
                </div>
              </section>
            </div>
          ) : null}

          {result.candidates.length > 0 ? (
            <div className="rounded-[22px] border border-slate-700/60 bg-slate-950/55 p-5 shadow-[0_18px_42px_rgba(2,8,23,0.2)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="section-kicker">Route Candidates</p>
                  <h3 className="section-title mt-1 text-[1.08rem]">Pick the route backbone before procedure work</h3>
                  <p className="mt-2 text-sm text-slate-300">
                    Candidate cards keep the airway backbone readable while the live setup panels above handle
                    runway-first SID, STAR, transition, and approach decisions.
                  </p>
                </div>
                <div className="rounded-full border border-slate-300/18 bg-slate-300/8 px-3 py-1 text-[0.68rem] uppercase tracking-[0.2em] text-slate-300">
                  {result.candidates.length} option(s)
                </div>
              </div>

              <div className="scroll-panel mt-4 grid max-h-[56rem] gap-4 overflow-y-auto pr-1">
                {result.candidates.map((candidate, index) => (
                  <CandidateCard
                    key={`${candidate.departure.ident}-${candidate.arrival.ident}-${index}`}
                    candidate={candidate}
                    index={index}
                    isActive={activeCandidateIndex === index}
                    departureSelectionLabel={activeCandidateIndex === index ? selectedDepartureProcedureDisplay : null}
                    arrivalSelectionLabel={activeCandidateIndex === index ? selectedArrivalProcedureDisplay : null}
                    transitionSelectionLabel={activeCandidateIndex === index ? selectedArrivalTransitionDisplay : null}
                    approachSelectionLabel={activeCandidateIndex === index ? selectedApproachProcedureDisplay : null}
                    approachStatusText={activeCandidateIndex === index ? activeApproachStatusText : null}
                    approachCountText={activeCandidateIndex === index ? activeApproachCountText : null}
                    onActivate={() => {
                      if (activeCandidateIndex !== index) {
                        activateCandidate(index);
                      }
                    }}
                  />
                ))}
              </div>
            </div>
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
            Results are shown in this order: departure airport, SID options, SID exit point, airway path, STAR entry
            point, STAR options, approach options, arrival airport.
          </p>
        </div>
      )}
    </section>
  );
}
