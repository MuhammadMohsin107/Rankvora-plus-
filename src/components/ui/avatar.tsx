import { cn } from "@/lib/cn";

/* Five tints from the chart series tokens. Literal class names so Tailwind can see them. */
const WEBSITE_TINTS = [
  "bg-series-1/15 border-series-1/30",
  "bg-series-2/15 border-series-2/30",
  "bg-series-3/15 border-series-3/30",
  "bg-series-4/15 border-series-4/30",
  "bg-series-5/15 border-series-5/30",
];

const SIZES = {
  sm: "size-6 text-[10px]",
  md: "size-8 text-xs",
  lg: "size-10 text-sm",
};

/** Stable 32-bit hash (djb2). The same name always gives the same colour, on server and client. */
export function hashString(value: string): number {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

/** Index 0-4 of the series token used for a name. */
export function seriesIndex(name: string): number {
  return hashString(name.trim().toLowerCase()) % WEBSITE_TINTS.length;
}

/** Up to two letters: first letters of the first two words, or the first two letters of a single word. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/[\s\-_./]+/).filter(Boolean);
  const letters = (word: string) => Array.from(word.replace(/[^\p{L}\p{N}]/gu, ""));
  if (words.length === 0) return "?";
  if (words.length === 1) return letters(words[0]).slice(0, 2).join("").toUpperCase() || "?";
  return ((letters(words[0])[0] ?? "") + (letters(words[1])[0] ?? "")).toUpperCase() || "?";
}

type AvatarProps = {
  name: string;
  size?: keyof typeof SIZES;
  /** Accessible name. Leave out when the name is written next to the avatar (it is then decorative). */
  label?: string;
  className?: string;
};

/** Square initials tile for a website or brand: colour comes from a hash of the name, no images. */
export function WebsiteAvatar({ name, size = "md", label, className }: AvatarProps) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        "tnum inline-flex shrink-0 select-none items-center justify-center rounded-control border font-semibold leading-none text-fg",
        WEBSITE_TINTS[seriesIndex(name)],
        SIZES[size],
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}

/** Round initials tile for a person. Neutral so websites stay the only coloured avatars. */
export function UserAvatar({ name, size = "md", label, className }: AvatarProps) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-full bg-surface-3 font-semibold leading-none text-fg-muted", SIZES[size], className)}
    >
      {initialsOf(name)}
    </span>
  );
}
