// Minimalist icon set — single stroke, 16px
const ICON_PATHS = {
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></>,
  star: <path d="M12 2l3 7 7 .5-5.5 4.5 2 7L12 17l-6.5 4 2-7L2 9.5 9 9z"/>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></>,
  sparkles: <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5zM19 14l.75 2.25L22 17l-2.25.75L19 20l-.75-2.25L16 17l2.25-.75z"/>,
  cpu: <><rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4"/></>,
  bot: <><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 4v4M8 14h.01M16 14h.01M9 18h6"/></>,
  bank: <path d="M3 21h18M5 21V10M9 21V10M15 21V10M19 21V10M2 10l10-7 10 7"/>,
  wrench: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.7 2.7-2.7-2.7z"/>,
  scale: <path d="M12 3v18M6 8l-4 7h8zm12 0l-4 7h8zM3 21h18"/>,
  paper: <><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></>,
  target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></>,
  bookmark: <path d="M6 3h12v18l-6-4-6 4z"/>,
  trophy: <path d="M7 4h10v3a5 5 0 0 1-10 0V4zM5 4H2v3a3 3 0 0 0 3 3M19 4h3v3a3 3 0 0 1-3 3M12 12v5M8 21h8M9 17h6"/>,
  book: <path d="M4 4h7a3 3 0 0 1 3 3v14a3 3 0 0 0-3-3H4zM20 4h-7a3 3 0 0 0-3 3v14a3 3 0 0 1 3-3h7z"/>,
  wave: <path d="M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0 4 4 6 0"/>,
  lightbulb: <path d="M9 18h6M10 22h4M8 14a5 5 0 1 1 8 0c-.5.6-1 1.4-1 2.5V18H9v-1.5c0-1.1-.5-1.9-1-2.5z"/>,
  notebook: <><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M8 3v18M12 7h5M12 11h5M12 15h5"/></>,
  toolbox: <path d="M3 9h18v11H3zM8 9V5h8v4M3 14h18"/>,
  assistant: <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18ZM12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18ZM15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></>,
  activity: <path d="M2 12h4l3-9 6 18 3-9h4"/>,
  music: <path d="M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>,
  gamepad: <><rect x="2" y="7" width="20" height="12" rx="4"/><path d="M7 12h3M8.5 10.5v3M15 12h.01M18 13h.01"/></>,
  wallet: <><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M16 12h4M2 10h20"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></>,
  arrow_up: <path d="M12 19V5M5 12l7-7 7 7"/>,
  arrow_down: <path d="M12 5v14M19 12l-7 7-7-7"/>,
  arrow_right: <path d="M5 12h14M12 5l7 7-7 7"/>,
  arrow_left: <path d="M19 12H5M12 19l-7-7 7-7"/>,
  share: <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13"/>,
  file_text: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2"/></>,
  dot: <circle cx="12" cy="12" r="4" fill="currentColor"/>,
  play: <path d="M6 4l14 8-14 8z" fill="currentColor"/>,
  mic: <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v4M8 22h8"/>,
  check: <path d="M4 12l5 5L20 6"/>,
  plus: <path d="M12 5v14M5 12h14"/>,
  chevron_right: <path d="M9 6l6 6-6 6"/>,
  chevron_down: <path d="M6 9l6 6 6-6"/>,
  chevron_up: <path d="M6 15l6-6 6 6"/>,
  flame: <path d="M12 3c2 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4-1 4 3 3 3 0 0-2 0-4 0-5z"/>,
  message_circle: <path d="M21 11.5a8.38 8.38 0 0 1-9 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.2A8.38 8.38 0 0 1 3 11.5a8.5 8.5 0 0 1 9-8.5 8.38 8.38 0 0 1 9 8.5z"/>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
  shield: <path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/>,
  plug: <path d="M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5"/>,
  chart: <path d="M3 20V4M3 20h18M7 16V10M12 16V7M17 16V12"/>,
  archive: <><rect x="3" y="4" width="18" height="4"/><path d="M5 8v12h14V8M10 13h4"/></>,
  filter: <path d="M3 4h18l-7 9v6l-4 2v-8z"/>,
  pin: <path d="M12 22v-7M7 2h10l-1 4 2 3-2 5H8l-2-5 2-3z"/>,
  pin_filled: <path d="M12 22v-7M7 2h10l-1 4 2 3-2 5H8l-2-5 2-3z" fill="currentColor"/>,
  chevron_left: <path d="M15 6l-6 6 6 6"/>,
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>,
  square: <rect x="4" y="4" width="16" height="16" rx="1"/>,
  x: <path d="M5 5l14 14M19 5L5 19"/>,
  envelope: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 7 9-7"/></>,
  flag: <><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22V3"/></>,
};

function Icon({ name, size = 16, stroke = 1.75, style, className }) {
  const path = ICON_PATHS[name] || ICON_PATHS.dot;
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      style={style} className={className}
      aria-hidden="true"
    >{path}</svg>
  );
}

window.Icon = Icon;
