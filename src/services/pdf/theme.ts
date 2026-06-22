/**
 * PDF template + branding theme system.
 *
 * To add a NEW template:
 *   1. add its key to PDF_TEMPLATES (and labels in lib/constants).
 *   2. add a case in makeTheme() with its style tokens.
 * Every document renders from the resulting PdfTheme, so no document code
 * changes are needed.
 */

export const PDF_TEMPLATES = ["CLASSIC", "MODERN", "PROFESSIONAL", "MINIMAL"] as const;
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
  // colors
  primary: string;
  ink: string;
  muted: string;
  line: string;
  accentBg: string; // table header / summary tint
  // header
  headerVariant: "bar" | "split" | "minimal";
  headerBg: string;
  headerText: string;
  // type
  fontFamily: string;
  fontBold: string;
  uppercaseTitles: boolean;
  // divider under header
  dividerStyle: "thick" | "thin" | "none";
  sectionTitleColor: string;
}

const INK = "#1e1b2e";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";

/** Light tint string for table headers (semi-transparent primary). */
function tint(hex: string) {
  // @react-pdf supports 8-digit hex (RRGGBBAA).
  return `${hex}14`; // ~8% opacity
}

export function makeTheme(template: TemplateKey, brand: BrandSettings): PdfTheme {
  const primary = brand.primaryColor || DEFAULT_PRIMARY;
  const base = {
    template,
    brand,
    primary,
    ink: INK,
    muted: MUTED,
    line: LINE,
    accentBg: tint(primary),
  };

  switch (template) {
    case "MODERN":
      return {
        ...base,
        headerVariant: "bar",
        headerBg: primary,
        headerText: "#ffffff",
        fontFamily: "Helvetica",
        fontBold: "Helvetica-Bold",
        uppercaseTitles: true,
        dividerStyle: "none",
        sectionTitleColor: primary,
      };
    case "PROFESSIONAL":
      return {
        ...base,
        headerVariant: "split",
        headerBg: "#ffffff",
        headerText: primary,
        fontFamily: "Helvetica",
        fontBold: "Helvetica-Bold",
        uppercaseTitles: false,
        dividerStyle: "thick",
        sectionTitleColor: primary,
      };
    case "MINIMAL":
      return {
        ...base,
        accentBg: "#f4f4f5",
        headerVariant: "minimal",
        headerBg: "#ffffff",
        headerText: INK,
        fontFamily: "Helvetica",
        fontBold: "Helvetica-Bold",
        uppercaseTitles: false,
        dividerStyle: "thin",
        sectionTitleColor: INK,
      };
    case "CLASSIC":
    default:
      return {
        ...base,
        headerVariant: "split",
        headerBg: "#ffffff",
        headerText: primary,
        fontFamily: "Times-Roman",
        fontBold: "Times-Bold",
        uppercaseTitles: false,
        dividerStyle: "thin",
        sectionTitleColor: primary,
      };
  }
}
