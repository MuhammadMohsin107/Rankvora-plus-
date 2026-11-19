import type { ReactNode, SVGProps } from "react";

/**
 * One icon family: 24px grid, 1.5 stroke, round caps. Inline SVG, no library.
 * Decorative by default (aria-hidden). Pass `label` for a meaningful icon.
 */
const paths: Record<string, ReactNode> = {
  search: (<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></>),
  x: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "chevron-up": <path d="m18 15-6-6-6 6" />,
  "chevron-left": <path d="m15 18-6-6 6-6" />,
  "chevron-right": <path d="m9 18 6-6-6-6" />,
  "chevrons-up-down": <path d="m7 15 5 5 5-5M7 9l5-5 5 5" />,
  "arrow-right": <path d="M5 12h14m-6-6 6 6-6 6" />,
  "arrow-left": <path d="M19 12H5m6-6-6 6 6 6" />,
  "arrow-up": <path d="M12 19V5m-6 6 6-6 6 6" />,
  "arrow-down": <path d="M12 5v14m-6-6 6 6 6-6" />,
  "arrow-up-right": <path d="M7 17 17 7M8 7h9v9" />,
  "trend-up": <path d="m21 7-8 8-4-4-6 6M15 7h6v6" />,
  "trend-down": <path d="m21 17-8-8-4 4-6-6M15 17h6v-6" />,
  bell: <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9ZM10.3 20.5a2 2 0 0 0 3.4 0" />,
  user: (<><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>),
  users: (<><circle cx="9" cy="8" r="3" /><path d="M3 19a6 6 0 0 1 12 0M16 5.2a3 3 0 0 1 0 5.6M18 14.2A6 6 0 0 1 21 19" /></>),
  building: <path d="M5 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17M16 9h3a1 1 0 0 1 1 1v11M3 21h18M9 7h2M9 11h2M9 15h2" />,
  clock: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>),
  calendar: <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7ZM4 10h16M8 3v4M16 3v4" />,
  play: <path d="M7 5v14l11-7L7 5Z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  refresh: <path d="M20 12a8 8 0 1 1-2.6-5.9L20 8.5M20 4v4.5h-4.5" />,
  download: <path d="M12 4v11m-4-4 4 4 4-4M5 20h14" />,
  upload: <path d="M12 16V5m-4 4 4-4 4 4M5 20h14" />,
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />,
  link: <path d="M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6l-1 1M14 10a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6l1-1" />,
  copy: <path d="M9 9h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2ZM5 15V6a2 2 0 0 1 2-2h8" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />,
  pencil: <path d="M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4" />,
  more: (<><circle cx="5" cy="12" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /><circle cx="19" cy="12" r="1.2" fill="currentColor" /></>),
  "alert-triangle": <path d="M12 4 2.5 20h19L12 4ZM12 10v4M12 17v.01" />,
  "alert-circle": (<><circle cx="12" cy="12" r="8.5" /><path d="M12 8v5M12 16v.01" /></>),
  info: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8v.01" /></>),
  "check-circle": (<><circle cx="12" cy="12" r="8.5" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>),
  "x-circle": (<><circle cx="12" cy="12" r="8.5" /><path d="m9 9 6 6m0-6-6 6" /></>),
  "minus-circle": (<><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12h7" /></>),
  circle: <circle cx="12" cy="12" r="8.5" />,
  "circle-dot": (<><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="2.5" fill="currentColor" /></>),
  globe: <path d="M3.5 12a8.5 8.5 0 1 0 17 0 8.5 8.5 0 0 0-17 0ZM3.5 12h17M12 3.5c2.5 2.5 3.5 5.3 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.3-3.5-8.5s1-6 3.5-8.5Z" />,
  lock: <path d="M6 11h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1ZM8 11V8a4 4 0 0 1 8 0v3" />,
  key: <path d="M14 10a4 4 0 1 0-1.2 2.8L20 20l-2-2 1.5-1.5M16 14l2 2" />,
  plug: <path d="M9 3v5M15 3v5M7 8h10v4a5 5 0 0 1-10 0V8ZM12 17v4" />,
  layers: <path d="m12 3.5 9 4.8-9 4.8-9-4.8 9-4.8ZM3 12.5l9 4.8 9-4.8M3 16.8l9 4.7 9-4.7" />,
  history: <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5M3.5 4v4.5H8M12 7.5V12l3 2" />,
  eye: (<><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.8" /></>),
  "eye-off": <path d="M3 3l18 18M10.6 6a9 9 0 0 1 1.4-.1c6 0 9.5 6.1 9.5 6.1a16 16 0 0 1-3 3.6M6.6 7.4C4 9.2 2.5 12 2.5 12S6 18.5 12 18.5a9 9 0 0 0 3.5-.7" />,
  sparkles: <path d="m12 3 1.7 4.6L18.3 9.3l-4.6 1.7L12 15.6l-1.7-4.6L5.7 9.3l4.6-1.7L12 3ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />,
  shield: <path d="M12 3 5 6v5.5c0 4.4 3 7.8 7 9.5 4-1.7 7-5.1 7-9.5V6l-7-3Z" />,
  "shield-check": <path d="M12 3 5 6v5.5c0 4.4 3 7.8 7 9.5 4-1.7 7-5.1 7-9.5V6l-7-3ZM9 12l2.2 2.2L15.5 10" />,
  menu: <path d="M4 6.5h16M4 12h16M4 17.5h16" />,
  columns: <path d="M4 5h5v14H4zM9.5 5h5v9h-5zM15 5h5v5h-5z" />,
  list: <path d="M8.5 6.5H20M8.5 12H20M8.5 17.5H20M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" />,
  grid: <path d="M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z" />,
  flag: <path d="M5 21V4M5 5h12l-2 4 2 4H5" />,
  bolt: <path d="M13 3 5 14h6l-1 7 8-11h-6l1-7Z" />,
  database: <path d="M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Zm0 0v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />,
  code: <path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" />,
  "file-text": <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5ZM14 3v5h5M9 13h6M9 17h6" />,
  diff: <path d="M12 5v8M8 9h8M8 18h8" />,
  mail: <path d="M4 6.5h16v11H4zM4.5 7.5 12 13l7.5-5.5" />,
  "credit-card": <path d="M4 6.5h16v11H4zM4 10.5h16M7.5 14.5h3" />,
  undo: <path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />,
  filter: <path d="M3.5 5h17l-6.5 7.5V19l-4-2v-4.5L3.5 5Z" />,
  sun: (<><circle cx="12" cy="12" r="3.8" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /></>),
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />,
  logout: <path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9" />,
  help: (<><circle cx="12" cy="12" r="8.5" /><path d="M9.7 9.5a2.4 2.4 0 1 1 3.4 2.2c-.7.3-1.1.9-1.1 1.6M12 16.5v.01" /></>),
  loader: <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5" />,
  // product navigation
  dashboard: <path d="M4 4h7v9H4zM13 4h7v5h-7zM13 11h7v9h-7zM4 15h7v5H4z" />,
  store: <path d="M4 9.5 5.5 4h13L20 9.5M4 9.5V20h16V9.5M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M10 20v-5h4v5" />,
  prompts: <path d="M4 5.5h16v11H10l-4.5 3.5v-3.5H4v-11ZM8 9.5h8M8 12.5h5" />,
  audit: <path d="M9 4h6v3H9zM8 5.5H6.5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-13a1 1 0 0 0-1-1H16M9 14l2 2 4-4" />,
  fixes: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.8 3.8Z" />,
  monitoring: <path d="M21.5 12H18l-3 8.5-6-17L6 12H2.5" />,
  compare: <path d="M7 4 3 8l4 4M3 8h13M17 20l4-4-4-4M21 16H8" />,
  reports: <path d="M6 3h8l5 5v13H6V3ZM14 3v5h5M9 13h7M9 16.5h7M9 9.5h2" />,
  settings: <path d="M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4" />,
};

export type IconName = keyof typeof paths;

type IconProps = Omit<SVGProps<SVGSVGElement>, "name"> & {
  name: IconName;
  size?: number;
  /** Accessible name for a meaningful icon. Omit for decorative icons. */
  label?: string;
};

export function Icon({ name, size = 16, label, className, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      focusable="false"
      className={className}
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
