import type { AirportCommunication, GeneratedAtisBundle, GeneratedAtisReport } from "../../types/api";
import { MiniDataTile, WeatherTextPanel } from "../shared/PanelPrimitives";

type GeneratedAtisSectionProps = {
  generatedAtis: GeneratedAtisBundle;
};

export function GeneratedAtisSection({ generatedAtis }: GeneratedAtisSectionProps) {
  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-2">
      <GeneratedAtisCard title="Generated D-ATIS" report={generatedAtis.departure} />
      <GeneratedAtisCard title="Generated A-ATIS" report={generatedAtis.arrival} />
    </div>
  );
}

type GeneratedAtisCardProps = {
  title: string;
  report: GeneratedAtisReport;
};

function GeneratedAtisCard({ title, report }: GeneratedAtisCardProps) {
  return (
    <div className="rounded-[18px] border border-slate-700/60 bg-slate-950/55 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="section-kicker">{title}</p>
          <p className="m-0 mt-1 text-[1rem] font-semibold text-slate-50">
            Information {report.informationCode}
          </p>
        </div>
        <span className="rounded-full bg-cyan-950/28 px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.12em] text-cyan-100">
          {report.atisType}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MiniDataTile label="Issued" value={report.issuedAt ?? "n/a"} />
        <MiniDataTile
          label="Runways"
          value={report.runwaysInUse.length > 0 ? report.runwaysInUse.join(" / ") : "n/a"}
        />
        <MiniDataTile label="Contacts" value={String(report.contacts.length)} />
      </div>

      {report.contacts.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {report.contacts.map((contact, index) => (
            <span
              key={`${contact.serviceType}-${contact.frequencyMhz}-${index}`}
              className="rounded-full border border-slate-700/60 bg-slate-900/86 px-3 py-2 text-[0.72rem] uppercase tracking-[0.08em] text-slate-300"
            >
              {formatContactBadge(contact)}
            </span>
          ))}
        </div>
      ) : null}

      <WeatherTextPanel title="Broadcast Text" body={report.text} className="mt-4" />
    </div>
  );
}

function formatContactBadge(contact: AirportCommunication) {
  return `${contact.label} ${contact.frequencyMhz.toFixed(3)}`;
}
