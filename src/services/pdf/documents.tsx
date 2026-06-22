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
 * Theme-driven PDF document kit. Every document renders from a `PdfTheme`
 * (template style tokens + company branding), so templates and branding are
 * applied automatically. See ./theme.ts to add new templates.
 */

const inr = (n: number) =>
  "INR " + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n ?? 0);

function buildStyles(t: PdfTheme) {
  return StyleSheet.create({
    page: {
      paddingTop: 38,
      paddingBottom: 56,
      paddingHorizontal: 44,
      fontSize: 10,
      color: t.ink,
      fontFamily: t.fontFamily,
    },
    // header — split / minimal
    headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    brandName: { fontSize: 18, fontFamily: t.fontBold, color: t.headerText },
    brandNameSmall: { fontSize: 12, fontFamily: t.fontBold, color: t.headerText },
    brandContact: { fontSize: 8, color: t.muted, marginTop: 2 },
    docTitle: { fontSize: 15, fontFamily: t.fontBold, color: t.ink, textAlign: "right" },
    docMeta: { fontSize: 9, color: t.muted, textAlign: "right", marginTop: 2 },
    logo: { width: 42, height: 42, objectFit: "contain", marginBottom: 4 },
    // header — bar (modern)
    bar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: t.headerBg,
      color: t.headerText,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 6,
    },
    barTitle: { fontSize: 15, fontFamily: t.fontBold, color: t.headerText, textTransform: "uppercase" },
    dividerThick: { height: 3, backgroundColor: t.primary, marginTop: 10, marginBottom: 12 },
    dividerThin: { height: 1, backgroundColor: t.line, marginTop: 10, marginBottom: 12 },
    spacer: { height: 14 },
    // sections
    section: { marginBottom: 14 },
    sectionTitle: {
      fontSize: 11,
      fontFamily: t.fontBold,
      marginBottom: 6,
      color: t.sectionTitleColor,
      textTransform: t.uppercaseTitles ? "uppercase" : "none",
    },
    grid: { flexDirection: "row", flexWrap: "wrap" },
    cell: { width: "50%", marginBottom: 6 },
    label: { fontSize: 8, color: t.muted, marginBottom: 1 },
    value: { fontSize: 10, fontFamily: t.fontBold },
    paragraph: { fontSize: 9.5, lineHeight: 1.5, marginBottom: 6, color: "#374151" },
    // table
    tHead: {
      flexDirection: "row",
      backgroundColor: t.accentBg,
      borderBottom: `1px solid ${t.line}`,
      paddingVertical: 5,
      paddingHorizontal: 4,
    },
    tRow: {
      flexDirection: "row",
      borderBottom: `1px solid ${t.line}`,
      paddingVertical: 4,
      paddingHorizontal: 4,
    },
    th: { fontSize: 8, fontFamily: t.fontBold, color: t.muted },
    td: { fontSize: 8.5 },
    totalsRow: {
      flexDirection: "row",
      paddingVertical: 6,
      paddingHorizontal: 4,
      backgroundColor: t.accentBg,
      marginTop: 2,
    },
    summaryCard: { width: "25%", padding: 8 },
    summaryLabel: { fontSize: 8, color: t.muted },
    summaryValue: { fontSize: 13, fontFamily: t.fontBold, marginTop: 2, color: t.ink },
    footer: {
      position: "absolute",
      bottom: 24,
      left: 44,
      right: 44,
      flexDirection: "row",
      justifyContent: "space-between",
      borderTop: `1px solid ${t.line}`,
      paddingTop: 6,
    },
    footerText: { fontSize: 7.5, color: t.muted },
    signRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 36 },
    signBox: { width: "42%" },
    sigImg: { width: 120, height: 44, objectFit: "contain", marginBottom: 2 },
    signLine: { borderTop: `1px solid ${t.ink}`, marginTop: 24, paddingTop: 4, fontSize: 9, color: t.muted },
  });
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
            <Text style={{ fontSize: 16, fontFamily: t.fontBold, color: t.headerText }}>{b.companyName}</Text>
          </View>
          <Text style={s.barTitle}>{title}</Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
          <Text style={s.brandContact}>{[b.address, contact].filter(Boolean).join("  ·  ")}</Text>
          {meta ? <Text style={s.docMeta}>{meta}</Text> : null}
        </View>
        <View style={s.spacer} />
      </>
    );
  }

  if (t.headerVariant === "minimal") {
    return (
      <>
        <View style={s.headerRow}>
          <Text style={s.brandNameSmall}>{b.companyName}</Text>
          <View>
            <Text style={s.docTitle}>{title}</Text>
            {meta ? <Text style={s.docMeta}>{meta}</Text> : null}
          </View>
        </View>
        <View style={s.dividerThin} />
      </>
    );
  }

  // split (classic / professional)
  return (
    <>
      <View style={s.headerRow}>
        <View>
          {b.logoUrl ? <Image src={b.logoUrl} style={s.logo} /> : null}
          <Text style={s.brandName}>{b.companyName}</Text>
          {b.address ? <Text style={s.brandContact}>{b.address}</Text> : null}
          {contact ? <Text style={s.brandContact}>{contact}</Text> : null}
        </View>
        <View>
          <Text style={s.docTitle}>{title}</Text>
          {meta ? <Text style={s.docMeta}>{meta}</Text> : null}
        </View>
      </View>
      <View style={t.dividerStyle === "thick" ? s.dividerThick : s.dividerThin} />
    </>
  );
}

function Footer({ t }: { t: PdfTheme }) {
  const s = buildStyles(t);
  const left = [t.brand.companyName, t.brand.footerText].filter(Boolean).join(" · ");
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>{left}</Text>
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
            <Field t={t} label="Principal" value={inr(terms.principal)} />
            <Field t={t} label="Interest" value={terms.rateLabel} />
            <Field t={t} label="Tenure" value={`${terms.tenureMonths} months`} />
            <Field t={t} label="Installment (EMI)" value={terms.emiAmount > 0 ? inr(terms.emiAmount) : "Flexible"} />
            <Field t={t} label="Processing fee" value={inr(terms.processingFee)} />
            <Field t={t} label="Grace period" value={`${terms.gracePeriodDays} days`} />
            <Field t={t} label="Total interest" value={inr(terms.totalInterest)} />
            <Field t={t} label="Total payable" value={inr(terms.totalPayable)} />
            <Field t={t} label="Disbursement date" value={terms.disbursementDate} />
            <Field t={t} label="Maturity date" value={terms.maturityDate} />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Terms &amp; conditions</Text>
          <Text style={s.paragraph}>
            1. The Borrower agrees to repay the loan as per the schedule and terms set out above.
          </Text>
          <Text style={s.paragraph}>
            2. Interest is computed using the {data.loanTypeLabel} method. For non-EMI loans, interest
            accrues over elapsed time at the stated rate and frequency.
          </Text>
          <Text style={s.paragraph}>
            3. A late-payment penalty applies on amounts unpaid beyond the due date and grace period.
          </Text>
          <Text style={s.paragraph}>
            4. The Borrower may prepay the outstanding principal; for reducing-balance loans this
            reduces subsequently accrued interest.
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

        <View style={s.section}>
          <View style={s.grid}>
            <Field t={t} label="Customer" value={data.customerName} />
            <Field t={t} label="Loan type" value={data.loanTypeLabel} />
          </View>
        </View>

        <View style={[s.grid, { marginBottom: 12 }]}>
          {[
            ["Principal", data.summary.principal],
            ["Interest charged", data.summary.charged],
            ["Total paid", data.summary.paid],
            ["Outstanding", data.summary.outstanding],
          ].map(([l, v]) => (
            <View key={l as string} style={s.summaryCard}>
              <Text style={s.summaryLabel}>{l as string}</Text>
              <Text style={s.summaryValue}>{inr(v as number)}</Text>
            </View>
          ))}
        </View>

        <View style={s.tHead}>
          <Text style={[s.th, { width: "16%" }]}>Date</Text>
          <Text style={[s.th, { width: "40%" }]}>Description</Text>
          <Text style={[s.th, { width: "14%", textAlign: "right" }]}>Debit</Text>
          <Text style={[s.th, { width: "14%", textAlign: "right" }]}>Credit</Text>
          <Text style={[s.th, { width: "16%", textAlign: "right" }]}>Balance</Text>
        </View>
        {data.lines.map((ln, i) => (
          <View key={i} style={s.tRow} wrap={false}>
            <Text style={[s.td, { width: "16%" }]}>{ln.date}</Text>
            <Text style={[s.td, { width: "40%" }]}>{ln.description}</Text>
            <Text style={[s.td, { width: "14%", textAlign: "right" }]}>{ln.debit}</Text>
            <Text style={[s.td, { width: "14%", textAlign: "right" }]}>{ln.credit}</Text>
            <Text style={[s.td, { width: "16%", textAlign: "right" }]}>{ln.balance}</Text>
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
        <Header t={t} title="Collection Receipt" meta={`${data.receiptNo} · ${data.date}`} />

        <View style={{ alignItems: "center", marginVertical: 10 }}>
          <Text style={{ fontSize: 9, color: t.muted }}>Amount received</Text>
          <Text style={{ fontSize: 26, fontFamily: t.fontBold, color: t.primary }}>{inr(data.amount)}</Text>
        </View>

        <View style={s.grid}>
          <Field t={t} label="Received from" value={data.customerName} />
          <Field t={t} label="Loan number" value={data.loanNumber} />
          <Field t={t} label="Payment method" value={data.method} />
          <Field t={t} label="Collected by" value={data.collectedBy} />
          <Field t={t} label="Towards principal" value={inr(data.principal)} />
          <Field t={t} label="Towards interest" value={inr(data.interest)} />
          <Field t={t} label="Towards penalty" value={inr(data.penalty)} />
          <Field t={t} label="Outstanding after" value={inr(data.outstandingAfter)} />
        </View>

        <Text style={[s.paragraph, { marginTop: 16, textAlign: "center", color: t.muted }]}>
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

        <View style={[s.grid, { marginBottom: 10 }]}>
          {[
            ["Collections", String(data.totals.count)],
            ["Total amount", inr(data.totals.amount)],
            ["Principal", inr(data.totals.principal)],
            ["Interest", inr(data.totals.interest)],
          ].map(([l, v]) => (
            <View key={l} style={s.summaryCard}>
              <Text style={s.summaryLabel}>{l}</Text>
              <Text style={s.summaryValue}>{v}</Text>
            </View>
          ))}
        </View>

        <View style={s.tHead}>
          <Text style={[s.th, { width: "16%" }]}>Date</Text>
          <Text style={[s.th, { width: "20%" }]}>Loan</Text>
          <Text style={[s.th, { width: "26%" }]}>Customer</Text>
          <Text style={[s.th, { width: "16%", textAlign: "right" }]}>Amount</Text>
          <Text style={[s.th, { width: "12%" }]}>Method</Text>
          <Text style={[s.th, { width: "10%" }]}>By</Text>
        </View>
        {data.rows.length === 0 ? (
          <View style={s.tRow}>
            <Text style={s.td}>No collections in this period.</Text>
          </View>
        ) : (
          data.rows.map((r, i) => (
            <View key={i} style={s.tRow} wrap={false}>
              <Text style={[s.td, { width: "16%" }]}>{r.date}</Text>
              <Text style={[s.td, { width: "20%" }]}>{r.loanNumber}</Text>
              <Text style={[s.td, { width: "26%" }]}>{r.customer}</Text>
              <Text style={[s.td, { width: "16%", textAlign: "right" }]}>{r.amount}</Text>
              <Text style={[s.td, { width: "12%" }]}>{r.method}</Text>
              <Text style={[s.td, { width: "10%" }]}>{r.collectedBy}</Text>
            </View>
          ))
        )}
        <View style={s.totalsRow}>
          <Text style={[s.th, { width: "62%" }]}>Total</Text>
          <Text style={[s.th, { width: "16%", textAlign: "right" }]}>{inr(data.totals.amount)}</Text>
          <Text style={[s.th, { width: "22%" }]}> </Text>
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

        <View style={[s.grid, { marginBottom: 10 }]}>
          {[
            ["Opening balance", inr(data.openingBalance)],
            ["Cash in", inr(data.totals.inflow)],
            ["Cash out", inr(data.totals.outflow)],
            ["Closing balance", inr(data.closingBalance)],
          ].map(([l, v]) => (
            <View key={l} style={s.summaryCard}>
              <Text style={s.summaryLabel}>{l}</Text>
              <Text style={s.summaryValue}>{v}</Text>
            </View>
          ))}
        </View>

        <View style={s.tHead}>
          <Text style={[s.th, { width: "14%" }]}>Date</Text>
          <Text style={[s.th, { width: "22%" }]}>Type</Text>
          <Text style={[s.th, { width: "24%" }]}>Note</Text>
          <Text style={[s.th, { width: "13%", textAlign: "right" }]}>In</Text>
          <Text style={[s.th, { width: "13%", textAlign: "right" }]}>Out</Text>
          <Text style={[s.th, { width: "14%", textAlign: "right" }]}>Balance</Text>
        </View>
        {data.rows.length === 0 ? (
          <View style={s.tRow}>
            <Text style={s.td}>No cash movement in this period.</Text>
          </View>
        ) : (
          data.rows.map((r, i) => (
            <View key={i} style={s.tRow} wrap={false}>
              <Text style={[s.td, { width: "14%" }]}>{r.date}</Text>
              <Text style={[s.td, { width: "22%" }]}>{r.type}</Text>
              <Text style={[s.td, { width: "24%" }]}>{r.note}</Text>
              <Text style={[s.td, { width: "13%", textAlign: "right" }]}>{r.inAmount}</Text>
              <Text style={[s.td, { width: "13%", textAlign: "right" }]}>{r.outAmount}</Text>
              <Text style={[s.td, { width: "14%", textAlign: "right" }]}>{r.balance}</Text>
            </View>
          ))
        )}
        <View style={s.totalsRow}>
          <Text style={[s.th, { width: "60%" }]}>Totals</Text>
          <Text style={[s.th, { width: "13%", textAlign: "right" }]}>{inr(data.totals.inflow)}</Text>
          <Text style={[s.th, { width: "13%", textAlign: "right" }]}>{inr(data.totals.outflow)}</Text>
          <Text style={[s.th, { width: "14%", textAlign: "right" }]}>{inr(data.closingBalance)}</Text>
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
