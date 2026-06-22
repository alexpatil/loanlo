/**
 * PDF template + branding theme system.
 *
 * Four opinionated, premium fintech templates. Every document renders from the
 * resulting PdfTheme (style tokens + company branding), so adding/adjusting a
 * template only touches makeTheme() — no document code changes needed.
 *
 *   MODERN       → "Modern Fintech"            (dark hero, brand-coloured KPIs)
 *   PROFESSIONAL → "Professional Banking"      (corporate navy, formal)
 *   MINIMAL      → "Minimal Black & White"     (monochrome, typographic)
 *   CLASSIC      → "Rural Finance Print Format" (high-contrast, large type)
 */

export const PDF_TEMPLATES = ["MODERN", "PROFESSIONAL", "MINIMAL", "CLASSIC"] as const;
export type TemplateKey = (typeof PDF_TEMPLATES)[number];

export const DEFAULT_PRIMARY = "#6d28d9";

export interface BrandSettings {
  companyName: string;
  address?: string;
  phone?: string;
  email?: string;
  footerText?: string;
  primaryColor: string;
  logoUrl?: string;
  signatureUrl?: string;
}

export interface PdfTheme {
  template: TemplateKey;
  brand: BrandSettings;

  // ── palette ──
  primary: string;
  ink: string;
  muted: string;
  line: string;
  surface: string; // subtle card / panel background
  accentBg: string; // soft tint of the primary

  // ── header ──
  headerVariant: "bar" | "split" | "minimal";
  headerBg: string;
  headerText: string;
  headerMuted: string;

  // ── hero (outstanding balance band) ──
  heroVariant: "dark" | "accent" | "outline";
  heroBg: string;
  heroText: string;
  heroMuted: string;
  heroAccent: string;

  // ── KPI cards ──
  kpiBg: string;
  kpiBorder: string;
  kpiLabel: string;
  kpiValue: string;
  kpiHighlightBg: string;
  kpiHighlightText: string;
  kpiHighlightLabel: string;

  // ── table ──
  tableHeadBg: string;
  tableHeadText: string;
  rowAltBg: string;

  // ── type ──
  fontFamily: string;
  fontBold: string;
  uppercaseTitles: boolean;
  fontScale: number; // bumps every size (rural print)

  // ── shape ──
  radius: number;
  borderWidth: number;
  sectionTitleColor: string;
}

const SLATE_INK = "#0f172a";
const SLATE_MUTED = "#64748b";

/** Light tint string for soft panels (semi-transparent primary). */
function tint(hex: string, alpha = "14") {
  // @react-pdf supports 8-digit hex (RRGGBBAA).
  return `${hex}${alpha}`;
}

export function makeTheme(template: TemplateKey, brand: BrandSettings): PdfTheme {
  const primary = brand.primaryColor || DEFAULT_PRIMARY;

  const base = {
    template,
    brand,
    primary,
    ink: SLATE_INK,
    muted: SLATE_MUTED,
    line: "#e6e8ee",
    surface: "#f8f8fc",
    accentBg: tint(primary),
    fontFamily: "Helvetica",
    fontBold: "Helvetica-Bold",
    fontScale: 1,
    radius: 8,
    borderWidth: 1,
  };

  switch (template) {
    // ── Modern Fintech — dark premium hero, brand-coloured highlights ──
    case "MODERN":
      return {
        ...base,
        headerVariant: "bar",
        headerBg: "#0e1023",
        headerText: "#ffffff",
        headerMuted: "#a5a8c8",
        heroVariant: "dark",
        heroBg: "#0e1023",
        heroText: "#ffffff",
        heroMuted: "#a5a8c8",
        heroAccent: primary,
        kpiBg: "#f7f7fc",
        kpiBorder: "#ededf6",
        kpiLabel: SLATE_MUTED,
        kpiValue: SLATE_INK,
        kpiHighlightBg: primary,
        kpiHighlightText: "#ffffff",
        kpiHighlightLabel: tint("#ffffff", "cc"),
        tableHeadBg: "#0e1023",
        tableHeadText: "#ffffff",
        rowAltBg: "#f7f7fc",
        uppercaseTitles: true,
        sectionTitleColor: SLATE_INK,
      };

    // ── Professional Banking — corporate navy, formal ──
    case "PROFESSIONAL": {
      const navy = "#0f3d6e";
      return {
        ...base,
        primary: navy,
        line: "#dbe3ee",
        surface: "#f5f8fc",
        accentBg: tint(navy, "0f"),
        headerVariant: "split",
        headerBg: "#ffffff",
        headerText: navy,
        headerMuted: SLATE_MUTED,
        heroVariant: "accent",
        heroBg: "#f5f8fc",
        heroText: navy,
        heroMuted: SLATE_MUTED,
        heroAccent: navy,
        kpiBg: "#ffffff",
        kpiBorder: "#dbe3ee",
        kpiLabel: SLATE_MUTED,
        kpiValue: navy,
        kpiHighlightBg: navy,
        kpiHighlightText: "#ffffff",
        kpiHighlightLabel: tint("#ffffff", "cc"),
        tableHeadBg: navy,
        tableHeadText: "#ffffff",
        rowAltBg: "#f5f8fc",
        uppercaseTitles: false,
        radius: 4,
        sectionTitleColor: navy,
      };
    }

    // ── Minimal Black & White — monochrome, typographic ──
    case "MINIMAL":
      return {
        ...base,
        primary: "#111111",
        ink: "#111111",
        muted: "#6b7280",
        line: "#dcdcdc",
        surface: "#ffffff",
        accentBg: "#f2f2f2",
        headerVariant: "minimal",
        headerBg: "#ffffff",
        headerText: "#111111",
        headerMuted: "#6b7280",
        heroVariant: "outline",
        heroBg: "#ffffff",
        heroText: "#111111",
        heroMuted: "#6b7280",
        heroAccent: "#111111",
        kpiBg: "#ffffff",
        kpiBorder: "#dcdcdc",
        kpiLabel: "#6b7280",
        kpiValue: "#111111",
        kpiHighlightBg: "#111111",
        kpiHighlightText: "#ffffff",
        kpiHighlightLabel: "#cccccc",
        tableHeadBg: "#111111",
        tableHeadText: "#ffffff",
        rowAltBg: "#f6f6f6",
        uppercaseTitles: false,
        radius: 2,
        sectionTitleColor: "#111111",
      };

    // ── Rural Finance Print Format — high-contrast, large type, heavy rules ──
    case "CLASSIC":
    default: {
      const accent = primary;
      return {
        ...base,
        ink: "#000000",
        muted: "#3f3f46",
        line: "#1f2937",
        surface: "#ffffff",
        accentBg: "#eeeeee",
        headerVariant: "split",
        headerBg: "#ffffff",
        headerText: "#000000",
        headerMuted: "#3f3f46",
        heroVariant: "outline",
        heroBg: "#ffffff",
        heroText: "#000000",
        heroMuted: "#3f3f46",
        heroAccent: accent,
        kpiBg: "#ffffff",
        kpiBorder: "#000000",
        kpiLabel: "#3f3f46",
        kpiValue: "#000000",
        kpiHighlightBg: "#000000",
        kpiHighlightText: "#ffffff",
        kpiHighlightLabel: "#dddddd",
        tableHeadBg: "#000000",
        tableHeadText: "#ffffff",
        rowAltBg: "#f0f0f0",
        uppercaseTitles: true,
        fontScale: 1.16,
        radius: 0,
        borderWidth: 1.5,
        sectionTitleColor: "#000000",
      };
    }
  }
}
