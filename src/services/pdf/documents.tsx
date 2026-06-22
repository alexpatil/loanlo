import "server-only";
import {
  Document,
  Page,
  Image,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { PdfTheme } from "./theme";

/**
 * Premium fintech PDF kit. Every document renders from a `PdfTheme`
 * (template style tokens + company branding), so the four templates and the
 * admin's branding apply automatically. See ./theme.ts to tune a template.
 *
 * Building blocks shared by all documents:
 *   Header  · brand + document title (+ optional status)
 *   Hero    · the headline metric (outstanding / amount) — visually dominant
 *   KpiRow  · four scannable metric cards, one highlighted
 *   DataTable · zebra-striped ledger
 */

// Built-in PDF fonts don't include the ₹ glyph, so use the "Rs" prefix — the
// standard, reliably-rendered convention for Indian financial documents.
const inr = (n: number) =>
  "Rs " + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n ?? 0);

/** Semantic status pill colours, independent of the template palette. */
function statusColor(status: string): { bg: string; text: string } {
  switch (status?.toUpperCase()) {
    case "ACTIVE":
      return { bg: "#dcfce7", text: "#166534" };
    case "OVERDUE":
      return { bg: "#fee2e2", text: "#b91c1c" };
    case "CLOSED":
      return { bg: "#e2e8f0", text: "#475569" };
    case "APPROVED":
      return { bg: "#dbeafe", text: "#1d4ed8" };
    case "REJECTED":
      return { bg: "#fee2e2", text: "#b91c1c" };
    case "PAID":
      return { bg: "#dcfce7", text: "#166534" };
    case "PENDING":
    default:
      return { bg: "#fef3c7", text: "#b45309" };
  }
}

function buildStyles(t: PdfTheme) {
  const f = (n: number) => Math.round(n * t.fontScale * 100) / 100;
  return StyleSheet.create({
    page: {
      paddingTop: 36,
      paddingBottom: 60,
      paddingHorizontal: 40,
      fontSize: f(10),
      color: t.ink,
      fontFamily: t.fontFamily,
      lineHeight: 1.4,
    },

    // ── header ──
    headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    brandName: { fontSize: f(17), fontFamily: t.fontBold, color: t.headerText },
    brandNameSmall: { fontSize: f(13), fontFamily: t.fontBold, color: t.headerText },
    brandContact: { fontSize: f(8), color: t.headerMuted, marginTop: 2 },
    logo: { width: 40, height: 40, objectFit: "contain", marginBottom: 5 },
    docTitle: { fontSize: f(16), fontFamily: t.fontBold, color: t.ink, textAlign: "right" },
    docMeta: { fontSize: f(8.5), color: t.muted, textAlign: "right", marginTop: 3 },
    bar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: t.headerBg,
      paddingVertical: 16,
      paddingHorizontal: 18,
      borderRadius: t.radius,
    },
    barTitle: {
      fontSize: f(15),
      fontFamily: t.fontBold,
      color: t.headerText,
      textTransform: t.uppercaseTitles ? "uppercase" : "none",
      letterSpacing: t.uppercaseTitles ? 1 : 0,
    },
    dividerThick: { height: 2.5, backgroundColor: t.primary, marginTop: 12, marginBottom: 14 },
    dividerThin: { height: 1, backgroundColor: t.line, marginTop: 12, marginBottom: 14 },
    spacer: { height: 14 },

    // ── meta strip (customer / loan facts) ──
    metaStrip: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },
    metaItem: { width: "25%", marginBottom: 6 },
    metaLabel: { fontSize: f(7.5), color: t.muted, textTransform: "uppercase", letterSpacing: 0.5 },
    metaValue: { fontSize: f(10), fontFamily: t.fontBold, color: t.ink, marginTop: 1 },

    // ── hero ──
    heroLabel: { fontSize: f(8.5), textTransform: "uppercase", letterSpacing: 1.1 },
    heroValue: { fontSize: f(26), fontFamily: t.fontBold, marginTop: 5, lineHeight: 1.1 },
    heroSub: { fontSize: f(9), marginTop: 8, textAlign: "right" },

    // ── status pill ──
    pill: { borderRadius: 100, paddingVertical: 3, paddingHorizontal: 10 },
    pillText: { fontSize: f(8), fontFamily: t.fontBold, textTransform: "uppercase", letterSpacing: 0.6 },

    // ── KPI cards ──
    kpiRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
    kpiCard: {
      flex: 1,
      paddingVertical: 11,
      paddingHorizontal: 12,
      borderRadius: t.radius,
      backgroundColor: t.kpiBg,
      borderWidth: t.borderWidth,
      borderColor: t.kpiBorder,
      borderStyle: "solid",
    },
    kpiLabel: { fontSize: f(7.5), color: t.kpiLabel, textTransform: "uppercase", letterSpacing: 0.5 },
    kpiValue: { fontSize: f(13.5), fontFamily: t.fontBold, color: t.kpiValue, marginTop: 4 },

    // ── sections ──
    section: { marginBottom: 14 },
    sectionTitle: {
      fontSize: f(10.5),
      fontFamily: t.fontBold,
      marginBottom: 7,
      color: t.sectionTitleColor,
      textTransform: t.uppercaseTitles ? "uppercase" : "none",
      letterSpacing: t.uppercaseTitles ? 0.6 : 0,
    },
    grid: { flexDirection: "row", flexWrap: "wrap" },
    cell: { width: "50%", marginBottom: 7 },
    label: { fontSize: f(7.5), color: t.muted, textTransform: "uppercase", letterSpacing: 0.4 },
    value: { fontSize: f(10), fontFamily: t.fontBold, color: t.ink, marginTop: 1 },
    paragraph: { fontSize: f(9), lineHeight: 1.55, marginBottom: 5, color: t.muted },

    // ── table ──
    tHead: {
      flexDirection: "row",
      backgroundColor: t.tableHeadBg,
      paddingVertical: 7,
      paddingHorizontal: 8,
      borderTopLeftRadius: t.radius,
      borderTopRightRadius: t.radius,
    },
    tRow: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 8 },
    tRowAlt: { backgroundColor: t.rowAltBg },
    tRowBorder: { borderBottomWidth: t.borderWidth, borderBottomColor: t.line, borderBottomStyle: "solid" },
    th: { fontSize: f(8), fontFamily: t.fontBold, color: t.tableHeadText, textTransform: "uppercase", letterSpacing: 0.4 },
    td: { fontSize: f(9) },
    tdMuted: { fontSize: f(8.5), color: t.muted },
    totalsRow: {
      flexDirection: "row",
      paddingVertical: 8,
      paddingHorizontal: 8,
      backgroundColor: t.accentBg,
      borderRadius: t.radius,
      marginTop: 4,
    },
    totalsText: { fontSize: f(9), fontFamily: t.fontBold, color: t.ink },

    // ── footer ──
    footer: {
      position: "absolute",
      bottom: 26,
      left: 40,
      right: 40,
      flexDirection: "row",
      justifyContent: "space-between",
      borderTopWidth: 1,
      borderTopColor: t.line,
      borderTopStyle: "solid",
      paddingTop: 7,
    },
    footerText: { fontSize: f(7.5), color: t.muted },

    // ── signatures ──
    signRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 40 },
    signBox: { width: "42%" },
    sigImg: { width: 120, height: 44, objectFit: "contain", marginBottom: 2 },
    signLine: { borderTopWidth: 1, borderTopColor: t.ink, borderTopStyle: "solid", marginTop: 24, paddingTop: 5, fontSize: f(9), color: t.muted },
  });
}

// ─── Shared building blocks ──────────────────────────────────────────────────

function StatusPill({ t, status }: { t: PdfTheme; status: string }) {
  const s = buildStyles(t);
  const c = statusColor(status);
  return (
    <View style={[s.pill, { backgroundColor: c.bg }]}>
      <Text style={[s.pillText, { color: c.text }]}>{status}</Text>
    </View>
  );
}

function Header({ t, title, meta }: { t: PdfTheme; title: string; meta?: string }) {
  const s = buildStyles(t);
  const b = t.brand;
  const contact = [b.phone, b.email].filter(Boolean).join("  ·  ");

  if (t.headerVariant === "bar") {
    return (
      <>
        <View style={s.bar}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {b.logoUrl ? <Image src={b.logoUrl} style={{ width: 30, height: 30, objectFit: "contain" }} /> : null}
            <View>
              <Text style={{ fontSize: 15 * t.fontScale, fontFamily: t.fontBold, color: t.headerText }}>{b.companyName}</Text>
              {b.address ? <Text style={s.brandContact}>{b.address}</Text> : null}
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.barTitle}>{title}</Text>
            {meta ? <Text style={[s.brandContact, { color: t.headerText }]}>{meta}</Text> : null}
          </View>
        </View>
        {contact ? <Text style={[s.brandContact, { color: t.muted, marginTop: 6 }]}>{contact}</Text> : null}
        <View style={s.spacer} />
      </>
    );
  }

  if (t.headerVariant === "minimal") {
    return (
      <>
        <View style={s.headerRow}>
          <View>
            <Text style={s.brandNameSmall}>{b.companyName}</Text>
            {b.address ? <Text style={s.brandContact}>{[b.address, contact].filter(Boolean).join("  ·  ")}</Text> : null}
          </View>
          <View>
            <Text style={s.docTitle}>{title}</Text>
            {meta ? <Text style={s.docMeta}>{meta}</Text> : null}
          </View>
        </View>
        <View style={s.dividerThin} />
      </>
    );
  }

  // split (professional banking / rural print)
  const thick = t.template === "CLASSIC" || t.template === "PROFESSIONAL";
  return (
    <>
      <View style={s.headerRow}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
          {b.logoUrl ? <Image src={b.logoUrl} style={s.logo} /> : null}
          <View>
            <Text style={s.brandName}>{b.companyName}</Text>
            {b.address ? <Text style={s.brandContact}>{b.address}</Text> : null}
            {contact ? <Text style={s.brandContact}>{contact}</Text> : null}
          </View>
        </View>
        <View>
          <Text style={s.docTitle}>{title}</Text>
          {meta ? <Text style={s.docMeta}>{meta}</Text> : null}
        </View>
      </View>
      <View style={thick ? s.dividerThick : s.dividerThin} />
    </>
  );
}

function Hero({
  t,
  label,
  value,
  sub,
  status,
}: {
  t: PdfTheme;
  label: string;
  value: number;
  sub?: string;
  status?: string;
}) {
  const s = buildStyles(t);
  const dark = t.heroVariant === "dark";
  const container =
    t.heroVariant === "dark"
      ? { backgroundColor: t.heroBg, padding: 18, borderRadius: t.radius }
      : t.heroVariant === "accent"
        ? {
            backgroundColor: t.heroBg,
            padding: 16,
            borderRadius: t.radius,
            borderLeftWidth: 4,
            borderLeftColor: t.heroAccent,
            borderLeftStyle: "solid" as const,
          }
        : {
            backgroundColor: t.heroBg,
            padding: 16,
            borderRadius: t.radius,
            borderWidth: t.borderWidth + 0.5,
            borderColor: t.heroAccent,
            borderStyle: "solid" as const,
          };

  return (
    <View style={[container, { marginBottom: 16 }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flexShrink: 1, paddingRight: 12 }}>
          <Text style={[s.heroLabel, { color: t.heroMuted }]}>{label}</Text>
          <Text style={[s.heroValue, { color: dark ? t.heroText : t.heroAccent }]}>{inr(value)}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          {status ? <StatusPill t={t} status={status} /> : null}
          {sub ? <Text style={[s.heroSub, { color: t.heroMuted }]}>{sub}</Text> : null}
        </View>
      </View>
    </View>
  );
}

function KpiRow({
  t,
  items,
}: {
  t: PdfTheme;
  items: { label: string; value: string; highlight?: boolean }[];
}) {
  const s = buildStyles(t);
  return (
    <View style={s.kpiRow}>
      {items.map((it) => (
        <View
          key={it.label}
          style={
            it.highlight
              ? [s.kpiCard, { backgroundColor: t.kpiHighlightBg, borderColor: t.kpiHighlightBg }]
              : s.kpiCard
          }
        >
          <Text style={[s.kpiLabel, it.highlight ? { color: t.kpiHighlightLabel } : {}]}>{it.label}</Text>
          <Text style={[s.kpiValue, it.highlight ? { color: t.kpiHighlightText } : {}]}>{it.value}</Text>
        </View>
      ))}
    </View>
  );
}

function MetaStrip({ t, items }: { t: PdfTheme; items: { label: string; value: string }[] }) {
  const s = buildStyles(t);
  return (
    <View style={s.metaStrip}>
      {items.map((it) => (
        <View key={it.label} style={s.metaItem}>
          <Text style={s.metaLabel}>{it.label}</Text>
          <Text style={s.metaValue}>{it.value || "—"}</Text>
        </View>
      ))}
    </View>
  );
}

function Footer({ t }: { t: PdfTheme }) {
  const s = buildStyles(t);
  const left = [t.brand.companyName, t.brand.footerText].filter(Boolean).join("  ·  ");
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>{left || "System-generated document"}</Text>
      <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function Field({ t, label, value }: { t: PdfTheme; label: string; value: string }) {
  const s = buildStyles(t);
  return (
    <View style={s.cell}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value || "—"}</Text>
    </View>
  );
}

// ─── Data shapes ─────────────────────────────────────────────────────────────

export interface AgreementData {
  loanNumber: string;
  date: string;
  loanTypeLabel: string;
  status?: string;
  customer: { name: string; code: string; phone: string; address: string; aadhaar: string; pan: string };
  terms: {
    principal: number;
    rateLabel: string;
    tenureMonths: number;
    emiAmount: number;
    processingFee: number;
    totalInterest: number;
    totalPayable: number;
    gracePeriodDays: number;
    disbursementDate: string;
    maturityDate: string;
  };
}

export interface StatementLineDTO {
  date: string;
  description: string;
  debit: string;
  credit: string;
  balance: string;
}
export interface StatementData {
  loanNumber: string;
  customerName: string;
  generatedAt: string;
  loanTypeLabel: string;
  status: string;
  dueDate: string;
  agentName?: string;
  summary: { principal: number; charged: number; paid: number; outstanding: number };
  lines: StatementLineDTO[];
}

export interface ReceiptData {
  receiptNo: string;
  date: string;
  customerName: string;
  loanNumber: string;
  amount: number;
  method: string;
  principal: number;
  interest: number;
  penalty: number;
  outstandingAfter: number;
  collectedBy: string;
}

export interface ReportRow {
  date: string;
  loanNumber: string;
  customer: string;
  amount: string;
  method: string;
  collectedBy: string;
}
export interface ReportData {
  title: string;
  periodLabel: string;
  generatedAt: string;
  rows: ReportRow[];
  totals: { count: number; amount: number; principal: number; interest: number; penalty: number };
}

export interface CashBookRow {
  date: string;
  type: string;
  note: string;
  inAmount: string;
  outAmount: string;
  balance: string;
}
export interface CashBookData {
  title: string;
  periodLabel: string;
  generatedAt: string;
  openingBalance: number;
  closingBalance: number;
  rows: CashBookRow[];
  totals: { inflow: number; outflow: number };
}

// ─── Documents ───────────────────────────────────────────────────────────────

function AgreementDoc({ data, t }: { data: AgreementData; t: PdfTheme }) {
  const s = buildStyles(t);
  const terms = data.terms;
  return (
    <Document title={`Loan Agreement ${data.loanNumber}`}>
      <Page size="A4" style={s.page}>
        <Header t={t} title="Loan Agreement" meta={`${data.loanNumber} · ${data.date}`} />

        <Hero
          t={t}
          label="Sanctioned Principal"
          value={terms.principal}
          sub={`Total payable ${inr(terms.totalPayable)} · ${terms.rateLabel}`}
          status={data.status}
        />

        <KpiRow
          t={t}
          items={[
            { label: "Principal", value: inr(terms.principal) },
            { label: "Interest", value: inr(terms.totalInterest) },
            { label: "Installment", value: terms.emiAmount > 0 ? inr(terms.emiAmount) : "Flexible" },
            { label: "Total Payable", value: inr(terms.totalPayable), highlight: true },
          ]}
        />

        <View style={s.section}>
          <Text style={s.sectionTitle}>Borrower</Text>
          <View style={s.grid}>
            <Field t={t} label="Name" value={data.customer.name} />
            <Field t={t} label="Customer code" value={data.customer.code} />
            <Field t={t} label="Phone" value={data.customer.phone} />
            <Field t={t} label="PAN" value={data.customer.pan} />
            <Field t={t} label="Aadhaar" value={data.customer.aadhaar} />
            <Field t={t} label="Address" value={data.customer.address} />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Loan terms — {data.loanTypeLabel}</Text>
          <View style={s.grid}>
            <Field t={t} label="Interest" value={terms.rateLabel} />
            <Field t={t} label="Tenure" value={`${terms.tenureMonths} months`} />
            <Field t={t} label="Processing fee" value={inr(terms.processingFee)} />
            <Field t={t} label="Grace period" value={`${terms.gracePeriodDays} days`} />
            <Field t={t} label="Disbursement date" value={terms.disbursementDate} />
            <Field t={t} label="Maturity date" value={terms.maturityDate} />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Terms &amp; conditions</Text>
          <Text style={s.paragraph}>1. The Borrower agrees to repay the loan as per the schedule and terms set out above.</Text>
          <Text style={s.paragraph}>
            2. Interest is computed using the {data.loanTypeLabel} method. For non-EMI loans, interest accrues over
            elapsed time at the stated rate and frequency.
          </Text>
          <Text style={s.paragraph}>3. A late-payment penalty applies on amounts unpaid beyond the due date and grace period.</Text>
          <Text style={s.paragraph}>
            4. The Borrower may prepay the outstanding principal; for reducing-balance loans this reduces subsequently
            accrued interest.
          </Text>
        </View>

        <View style={s.signRow}>
          <View style={s.signBox}>
            <Text style={s.signLine}>Borrower signature</Text>
          </View>
          <View style={s.signBox}>
            {t.brand.signatureUrl ? <Image src={t.brand.signatureUrl} style={s.sigImg} /> : null}
            <Text style={s.signLine}>For {t.brand.companyName} (Authorised signatory)</Text>
          </View>
        </View>

        <Footer t={t} />
      </Page>
    </Document>
  );
}

function StatementDoc({ data, t }: { data: StatementData; t: PdfTheme }) {
  const s = buildStyles(t);
  return (
    <Document title={`Statement ${data.loanNumber}`}>
      <Page size="A4" style={s.page}>
        <Header t={t} title="Loan Statement" meta={`${data.loanNumber} · ${data.generatedAt}`} />

        <MetaStrip
          t={t}
          items={[
            { label: "Customer", value: data.customerName },
            { label: "Loan type", value: data.loanTypeLabel },
            { label: "Loan number", value: data.loanNumber },
            { label: "Agent", value: data.agentName ?? "—" },
          ]}
        />

        <Hero
          t={t}
          label="Current Outstanding"
          value={data.summary.outstanding}
          sub={data.dueDate ? `Due date: ${data.dueDate}` : undefined}
          status={data.status}
        />

        <KpiRow
          t={t}
          items={[
            { label: "Principal", value: inr(data.summary.principal) },
            { label: "Interest", value: inr(data.summary.charged) },
            { label: "Total Paid", value: inr(data.summary.paid) },
            { label: "Outstanding", value: inr(data.summary.outstanding), highlight: true },
          ]}
        />

        <Text style={s.sectionTitle}>Transaction history</Text>
        <View style={s.tHead}>
          <Text style={[s.th, { width: "15%" }]}>Date</Text>
          <Text style={[s.th, { width: "39%" }]}>Description</Text>
          <Text style={[s.th, { width: "15%", textAlign: "right" }]}>Debit</Text>
          <Text style={[s.th, { width: "15%", textAlign: "right" }]}>Credit</Text>
          <Text style={[s.th, { width: "16%", textAlign: "right" }]}>Balance</Text>
        </View>
        {data.lines.map((ln, i) => (
          <View key={i} style={[s.tRow, s.tRowBorder, i % 2 === 1 ? s.tRowAlt : {}]} wrap={false}>
            <Text style={[s.tdMuted, { width: "15%" }]}>{ln.date}</Text>
            <Text style={[s.td, { width: "39%" }]}>{ln.description}</Text>
            <Text style={[s.td, { width: "15%", textAlign: "right" }]}>{ln.debit}</Text>
            <Text style={[s.td, { width: "15%", textAlign: "right", color: "#166534" }]}>{ln.credit}</Text>
            <Text style={[s.td, { width: "16%", textAlign: "right", fontFamily: t.fontBold }]}>{ln.balance}</Text>
          </View>
        ))}

        <Footer t={t} />
      </Page>
    </Document>
  );
}

function ReceiptDoc({ data, t }: { data: ReceiptData; t: PdfTheme }) {
  const s = buildStyles(t);
  return (
    <Document title={`Receipt ${data.receiptNo}`}>
      <Page size="A5" style={s.page}>
        <Header t={t} title="Payment Receipt" meta={`${data.receiptNo} · ${data.date}`} />

        <Hero t={t} label="Amount Received" value={data.amount} sub={`via ${data.method} · ${data.date}`} status="PAID" />

        <View style={s.section}>
          <Text style={s.sectionTitle}>Payment details</Text>
          <View style={s.grid}>
            <Field t={t} label="Received from" value={data.customerName} />
            <Field t={t} label="Loan number" value={data.loanNumber} />
            <Field t={t} label="Payment method" value={data.method} />
            <Field t={t} label="Collected by" value={data.collectedBy} />
            <Field t={t} label="Towards principal" value={inr(data.principal)} />
            <Field t={t} label="Towards interest" value={inr(data.interest)} />
            <Field t={t} label="Towards penalty" value={inr(data.penalty)} />
          </View>
        </View>

        <KpiRow t={t} items={[{ label: "Outstanding After This Payment", value: inr(data.outstandingAfter), highlight: true }]} />

        <Text style={[s.paragraph, { marginTop: 10, textAlign: "center" }]}>
          This is a system-generated receipt and does not require a physical signature.
        </Text>

        <Footer t={t} />
      </Page>
    </Document>
  );
}

function ReportDoc({ data, t }: { data: ReportData; t: PdfTheme }) {
  const s = buildStyles(t);
  return (
    <Document title={data.title}>
      <Page size="A4" style={s.page}>
        <Header t={t} title={data.title} meta={`${data.periodLabel} · generated ${data.generatedAt}`} />

        <KpiRow
          t={t}
          items={[
            { label: "Collections", value: String(data.totals.count) },
            { label: "Principal", value: inr(data.totals.principal) },
            { label: "Interest", value: inr(data.totals.interest) },
            { label: "Total Amount", value: inr(data.totals.amount), highlight: true },
          ]}
        />

        <Text style={s.sectionTitle}>Collections</Text>
        <View style={s.tHead}>
          <Text style={[s.th, { width: "15%" }]}>Date</Text>
          <Text style={[s.th, { width: "20%" }]}>Loan</Text>
          <Text style={[s.th, { width: "27%" }]}>Customer</Text>
          <Text style={[s.th, { width: "16%", textAlign: "right" }]}>Amount</Text>
          <Text style={[s.th, { width: "12%" }]}>Method</Text>
          <Text style={[s.th, { width: "10%" }]}>By</Text>
        </View>
        {data.rows.length === 0 ? (
          <View style={[s.tRow, s.tRowBorder]}>
            <Text style={s.tdMuted}>No collections in this period.</Text>
          </View>
        ) : (
          data.rows.map((r, i) => (
            <View key={i} style={[s.tRow, s.tRowBorder, i % 2 === 1 ? s.tRowAlt : {}]} wrap={false}>
              <Text style={[s.tdMuted, { width: "15%" }]}>{r.date}</Text>
              <Text style={[s.td, { width: "20%" }]}>{r.loanNumber}</Text>
              <Text style={[s.td, { width: "27%" }]}>{r.customer}</Text>
              <Text style={[s.td, { width: "16%", textAlign: "right", fontFamily: t.fontBold }]}>{r.amount}</Text>
              <Text style={[s.td, { width: "12%" }]}>{r.method}</Text>
              <Text style={[s.tdMuted, { width: "10%" }]}>{r.collectedBy}</Text>
            </View>
          ))
        )}
        <View style={s.totalsRow}>
          <Text style={[s.totalsText, { width: "62%" }]}>Total collected</Text>
          <Text style={[s.totalsText, { width: "38%", textAlign: "right" }]}>{inr(data.totals.amount)}</Text>
        </View>

        <Footer t={t} />
      </Page>
    </Document>
  );
}

function CashBookDoc({ data, t }: { data: CashBookData; t: PdfTheme }) {
  const s = buildStyles(t);
  return (
    <Document title={data.title}>
      <Page size="A4" style={s.page}>
        <Header t={t} title={data.title} meta={`${data.periodLabel} · generated ${data.generatedAt}`} />

        <KpiRow
          t={t}
          items={[
            { label: "Opening Balance", value: inr(data.openingBalance) },
            { label: "Cash In", value: inr(data.totals.inflow) },
            { label: "Cash Out", value: inr(data.totals.outflow) },
            { label: "Closing Balance", value: inr(data.closingBalance), highlight: true },
          ]}
        />

        <Text style={s.sectionTitle}>Cash movement</Text>
        <View style={s.tHead}>
          <Text style={[s.th, { width: "13%" }]}>Date</Text>
          <Text style={[s.th, { width: "22%" }]}>Type</Text>
          <Text style={[s.th, { width: "25%" }]}>Note</Text>
          <Text style={[s.th, { width: "13%", textAlign: "right" }]}>In</Text>
          <Text style={[s.th, { width: "13%", textAlign: "right" }]}>Out</Text>
          <Text style={[s.th, { width: "14%", textAlign: "right" }]}>Balance</Text>
        </View>
        {data.rows.length === 0 ? (
          <View style={[s.tRow, s.tRowBorder]}>
            <Text style={s.tdMuted}>No cash movement in this period.</Text>
          </View>
        ) : (
          data.rows.map((r, i) => (
            <View key={i} style={[s.tRow, s.tRowBorder, i % 2 === 1 ? s.tRowAlt : {}]} wrap={false}>
              <Text style={[s.tdMuted, { width: "13%" }]}>{r.date}</Text>
              <Text style={[s.td, { width: "22%" }]}>{r.type}</Text>
              <Text style={[s.tdMuted, { width: "25%" }]}>{r.note}</Text>
              <Text style={[s.td, { width: "13%", textAlign: "right", color: "#166534" }]}>{r.inAmount}</Text>
              <Text style={[s.td, { width: "13%", textAlign: "right", color: "#b91c1c" }]}>{r.outAmount}</Text>
              <Text style={[s.td, { width: "14%", textAlign: "right", fontFamily: t.fontBold }]}>{r.balance}</Text>
            </View>
          ))
        )}
        <View style={s.totalsRow}>
          <Text style={[s.totalsText, { width: "60%" }]}>Closing balance</Text>
          <Text style={[s.totalsText, { width: "40%", textAlign: "right" }]}>{inr(data.closingBalance)}</Text>
        </View>

        <Footer t={t} />
      </Page>
    </Document>
  );
}

// ─── Renderers ───────────────────────────────────────────────────────────────

export const renderAgreement = (data: AgreementData, t: PdfTheme) =>
  renderToBuffer(<AgreementDoc data={data} t={t} />);
export const renderStatement = (data: StatementData, t: PdfTheme) =>
  renderToBuffer(<StatementDoc data={data} t={t} />);
export const renderReceipt = (data: ReceiptData, t: PdfTheme) =>
  renderToBuffer(<ReceiptDoc data={data} t={t} />);
export const renderReport = (data: ReportData, t: PdfTheme) =>
  renderToBuffer(<ReportDoc data={data} t={t} />);
export const renderCashBook = (data: CashBookData, t: PdfTheme) =>
  renderToBuffer(<CashBookDoc data={data} t={t} />);
