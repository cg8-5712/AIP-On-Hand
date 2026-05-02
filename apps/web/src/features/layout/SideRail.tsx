import type { ComponentType, SVGProps } from "react";
import type { AppPage } from "../app/types";

type SideRailProps = {
  activePage: AppPage;
  onPageChange: (page: AppPage) => void;
};

type RailItem = {
  key: AppPage;
  label: string;
  subLabel: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const primaryItems: RailItem[] = [
  { key: "map", label: "Map", subLabel: "surface", icon: MapIcon },
  { key: "airport", label: "Airport", subLabel: "info", icon: AirportIcon },
  { key: "eaip", label: "eAIP", subLabel: "charts", icon: ChartIcon },
  { key: "weather", label: "Weather", subLabel: "metar", icon: WeatherIcon },
  { key: "route", label: "Route", subLabel: "plan", icon: RouteIcon },
  { key: "fuel", label: "Fuel", subLabel: "burn", icon: FuelIcon },
];

const utilityItems: RailItem[] = [
  { key: "settings", label: "Settings", subLabel: "system", icon: SettingsIcon },
];

export function SideRail({ activePage, onPageChange }: SideRailProps) {
  return (
    <aside className="module-rail">
      <div className="flex gap-2 overflow-x-auto px-3 py-3 xl:flex-col xl:overflow-hidden">
        <div className="min-w-[92px] shrink-0 rounded-[18px] border border-white/6 bg-white/4 px-3 py-3 text-center xl:min-w-0">
          <p className="m-0 font-mono text-[0.88rem] tracking-[0.28em] text-cyan-100">AOH</p>
          <p className="m-0 mt-1 text-[0.62rem] uppercase tracking-[0.18em] text-slate-500">flight desk</p>
        </div>

        {primaryItems.map((item) => (
          <RailButton
            key={item.key}
            item={item}
            isActive={activePage === item.key}
            onClick={() => onPageChange(item.key)}
          />
        ))}

        <div className="mx-1 w-px shrink-0 self-stretch border-l border-white/6 xl:mx-0 xl:my-3 xl:w-auto xl:border-l-0 xl:border-t" />

        {utilityItems.map((item) => (
          <RailButton
            key={item.key}
            item={item}
            isActive={activePage === item.key}
            onClick={() => onPageChange(item.key)}
          />
        ))}
      </div>
    </aside>
  );
}

type RailButtonProps = {
  item: RailItem;
  isActive: boolean;
  onClick: () => void;
};

function RailButton({ item, isActive, onClick }: RailButtonProps) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`module-button min-w-[92px] shrink-0 xl:min-w-0 ${isActive ? "module-button-active" : "module-button-idle"}`}
      aria-pressed={isActive}
      title={item.label}
    >
      <span className={`module-icon-frame ${isActive ? "module-icon-frame-active" : ""}`} aria-hidden="true">
        <Icon className="h-8 w-8" />
      </span>
      <span className="text-[0.72rem] font-semibold uppercase tracking-[0.14em]">{item.label}</span>
      <span className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-400">{item.subLabel}</span>
    </button>
  );
}

function iconProps(props: SVGProps<SVGSVGElement>) {
  return {
    ...props,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

function MapIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20V6.5Z" />
      <path d="M9 4v13.5M15 6.5V20" />
    </svg>
  );
}

function ChartIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <rect x="4" y="5" width="16" height="14" rx="2.5" />
      <path d="M8 9h8M8 12.5h5M8 16h6" />
      <path d="m15.5 3 2 2" />
    </svg>
  );
}

function AirportIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <path d="M12 4v16" />
      <path d="M7 9.5 12 7l5 2.5" />
      <path d="M6 15h12" />
      <path d="M8.5 19h7" />
    </svg>
  );
}

function WeatherIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <path d="M8 18h8a4 4 0 1 0-.7-7.94A5.5 5.5 0 0 0 5 11.5 3.5 3.5 0 0 0 8 18Z" />
      <path d="m9 20 1.2-2M13 20l1.2-2M17 20l1.2-2" />
    </svg>
  );
}

function RouteIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <circle cx="6.5" cy="17.5" r="2.5" />
      <circle cx="17.5" cy="6.5" r="2.5" />
      <path d="M8.7 15.3 15.3 8.7" />
      <path d="M10 6h4M18 14v4" />
    </svg>
  );
}

function FuelIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <path d="M7 20V6.5A2.5 2.5 0 0 1 9.5 4h5A2.5 2.5 0 0 1 17 6.5V20Z" />
      <path d="M7 10h10" />
      <path d="M17 8.5h1.8a1.2 1.2 0 0 1 1.2 1.2v7.6a1.7 1.7 0 1 1-3.4 0V13" />
      <path d="m18.5 5 1.5 1.5" />
    </svg>
  );
}

function SettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <path d="M12 3.5v3M12 17.5v3M4.6 6.6l2.1 2.1M17.3 15.3l2.1 2.1M3.5 12h3M17.5 12h3M6.7 15.3l-2.1 2.1M19.4 6.6l-2.1 2.1" />
      <circle cx="12" cy="12" r="3.3" />
    </svg>
  );
}
