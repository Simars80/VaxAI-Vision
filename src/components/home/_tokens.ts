// Shared design tokens for the v2 landing.
// Single source of truth — every section imports from here.

export const tokens = {
  // base (Clinical Precision)
  bg: "#ffffff",
  ink: "#0e1116",
  muted: "rgba(14,17,22,0.6)",
  rule: "rgba(14,17,22,0.10)",
  ruleSoft: "rgba(14,17,22,0.06)",

  // brand (preserved from existing site)
  brand: "#3A5BCC",
  brandHover: "#2D4BAF",
  brandSoft: "rgba(58,91,204,0.08)",

  // signal (cartographic alerts only)
  alert: "#c1392b",
  watch: "#c89b2a",
  ok: "#3a8e54",

  // editorial mode
  paper: "#f4eee2",
  paperInk: "#1a1410",
  paperBrick: "#b5462a",
  paperRule: "rgba(26,20,16,0.18)",

  // cartographic mode
  map: "#eceae3",
  water: "#dde3e0",
  land: "#e6e3d8",

  // dark surfaces (kept dark to match existing navbar/footer)
  navBg: "#0e1116",
  navInk: "#ffffff",
  navMuted: "rgba(255,255,255,0.7)",
  navPill: "rgba(255,255,255,0.08)",

  // type stacks — Inter is the body face; serif + mono are opt-in
  sans: 'var(--font-sans), "Inter", system-ui, sans-serif',
  serif: 'var(--font-serif), "Fraunces", "Times New Roman", serif',
  mono: 'var(--font-mono), "IBM Plex Mono", ui-monospace, monospace',
} as const;

export type Tokens = typeof tokens;
