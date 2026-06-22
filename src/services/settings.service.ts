import "server-only";
import { prisma } from "@/lib/prisma";
import { APP_NAME } from "@/lib/constants";
import {
  makeTheme,
  PDF_TEMPLATES,
  DEFAULT_PRIMARY,
  type BrandSettings,
  type TemplateKey,
  type PdfTheme,
} from "./pdf/theme";

const SINGLETON_ID = "default";

export interface ResolvedPdfSettings {
  companyName: string;
  address: string;
  phone: string;
  email: string;
  footerText: string;
  primaryColor: string;
  logoUrl: string;
  signatureUrl: string;
  defaultTemplate: TemplateKey;
}

/** Current settings merged with sensible defaults (never null). */
export async function getPdfSettings(): Promise<ResolvedPdfSettings> {
  const row = await prisma.pdfSettings.findUnique({ where: { id: SINGLETON_ID } });
  return {
    companyName: row?.companyName ?? APP_NAME,
    address: row?.address ?? "",
    phone: row?.phone ?? "",
    email: row?.email ?? "",
    footerText: row?.footerText ?? "",
    primaryColor: row?.primaryColor ?? DEFAULT_PRIMARY,
    logoUrl: row?.logoUrl ?? "",
    signatureUrl: row?.signatureUrl ?? "",
    defaultTemplate: ((row?.defaultTemplate as TemplateKey) ?? "MODERN") as TemplateKey,
  };
}

function brandOf(s: ResolvedPdfSettings): BrandSettings {
  return {
    companyName: s.companyName,
    address: s.address || undefined,
    phone: s.phone || undefined,
    email: s.email || undefined,
    footerText: s.footerText || undefined,
    primaryColor: s.primaryColor,
    logoUrl: s.logoUrl || undefined,
    signatureUrl: s.signatureUrl || undefined,
  };
}

/**
 * Build the active theme. Pass `templateOverride` (e.g. from a `?template=`
 * query param) to preview a template without changing the saved default.
 */
export async function getPdfTheme(templateOverride?: string | null): Promise<PdfTheme> {
  const settings = await getPdfSettings();
  const isValid = (t: string): t is TemplateKey =>
    (PDF_TEMPLATES as readonly string[]).includes(t);
  const template =
    templateOverride && isValid(templateOverride) ? templateOverride : settings.defaultTemplate;
  return makeTheme(template, brandOf(settings));
}

export async function updatePdfSettings(data: Partial<ResolvedPdfSettings>) {
  return prisma.pdfSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...data },
    update: { ...data },
  });
}
