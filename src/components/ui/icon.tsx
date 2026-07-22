/**
 * Единый набор иконок (контурные, 24×24, без внешних зависимостей).
 * Новые иконки добавляются только сюда — не рисовать SVG по месту.
 */
const ICON_PATHS = {
  home: "M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5",
  report: "M6 3h7l5 5v13H6zM13 3v5h5M9 13h6M9 17h4",
  funnel: "M3 4h18l-7 8v8l-4-2v-6z",
  leads: "M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M17 8h5M19.5 5.5v5",
  trial: "M12 4 2 9l10 5 10-5-10-5ZM6 11.5V17c0 1.4 2.7 2.8 6 2.8s6-1.4 6-2.8v-5.5",
  sales: "M6 7h12l-1.2 13H7.2zM9 7a3 3 0 0 1 6 0",
  returns: "M3 12a9 9 0 1 0 2.6-6.4M3 4v5h5",
  customers: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 12.5l2 2 4-4",
  calls:
    "M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z",
  office: "M3 8h18v12H3zM8 8V5h8v3M3 13h18",
  ads: "M3 10v4h4l7 4V6l-7 4zM18 9.5a3 3 0 0 1 0 5",
  creative: "M3 5h18v14H3zM3 16.5l5-5 4 4 3-3 6 6",
  chart: "M4 20V10M10 20V4M16 20v-7M2 20h20",
  sparkle:
    "M12 3.5 13.8 8.2 18.5 10l-4.7 1.8L12 16.5l-1.8-4.7L5.5 10l4.7-1.8zM18.5 3v3M20 4.5h-3",
  send: "M22 2 11 13M22 2l-7 20-4-9-9-4z",
  link: "M10.5 13.5a5 5 0 0 0 7 0l2.5-2.5a5 5 0 0 0-7-7l-1.2 1.2M13.5 10.5a5 5 0 0 0-7 0L4 13a5 5 0 0 0 7 7l1.2-1.2",
  chat: "M4 5h16v10H9.5L4 19z",
  plug: "M9 3v5M15 3v5M6.5 8h11v3.5a5.5 5.5 0 0 1-11 0zM12 17v4",
  wallet: "M3 7.5h15a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM16 13h4",
  money: "M3 6.5h18v11H3zM12 15a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  calendar: "M4 6.5h16V20H4zM4 10.5h16M8 3v4M16 3v4",
  clock: "M12 3.2a8.8 8.8 0 1 0 0 17.6 8.8 8.8 0 0 0 0-17.6ZM12 7.5V12l3 2",
  contract: "M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h4",
  folder: "M3 6h6l2 2h10v12H3z",
  sliders: "M4 7h16M4 12h16M4 17h16M9 4.5v5M15 9.5v5M9 14.5v5",
  people: "M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16.5 5.2a3.5 3.5 0 0 1 0 6.6M18 14.8c2.4.6 4 2.4 4 5.2",
  shield: "M12 3l8 3v6c0 5-3.4 8.2-8 9.2C7.4 20.2 4 17 4 12V6z",
  plus: "M12 5v14M5 12h14",
  logout: "M15 5H6v14h9M11 12h10M18 8.5l3 3.5-3 3.5",
  chevron: "m9 6 6 6-6 6",
  calendarRange: "M4 6.5h16V20H4zM4 10.5h16M8 3v4M16 3v4M9 15h6",
  building: "M4 21V4h10v17M14 9h6v12M7 8h4M7 12h4M7 16h4M17 13h1M17 17h1",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4-4",
  check: "m5 12.5 5 5L19 6.5",
  lock: "M6 10.5h12V21H6zM8.5 10.5V7a3.5 3.5 0 1 1 7 0v3.5",
} as const;

export type IconName = keyof typeof ICON_PATHS;

export function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}
