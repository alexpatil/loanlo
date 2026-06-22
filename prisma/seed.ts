/**
 * Loanlo seed script.
 *
 * Creates demo staff accounts, customers, loans, EMI schedules and payments.
 * Run with: pnpm db:seed
 *
 * NOTE: MongoDB + Prisma requires a replica set for transactions. Ensure your
 * DATABASE_URL points at a replica set (Atlas works out of the box).
 */
import type { LoanStatus, LoanType } from "@prisma/client";
import { subMonths } from "date-fns";
import { auth } from "../src/lib/auth";
import {
  calculateLoan,
  calculateMaturityDate,
  generateSchedule,
  type LoanMethod,
} from "../src/lib/finance";
import { prisma } from "../src/lib/prisma";

const PASSWORD = "Password123";

async function hashPassword(plain: string) {
  const ctx = await auth.$context;
  return ctx.password.hash(plain);
}

async function createStaff(
  name: string,
  email: string,
  role: "SUPER_ADMIN" | "ADMIN" | "AGENT",
  phone: string,
) {
  const password = await hashPassword(PASSWORD);
  return prisma.user.create({
    data: {
      name,
      email,
      role,
      phone,
      emailVerified: true,
      accounts: {
        create: { accountId: email, providerId: "credential", password },
      },
    },
  });
}

const FIRST = ["Aarav", "Vivaan", "Ananya", "Diya", "Ishaan", "Kavya", "Rohan", "Sara", "Arjun", "Meera", "Kabir", "Riya"];
const LAST = ["Sharma", "Verma", "Patel", "Gupta", "Reddy", "Nair", "Iyer", "Khan", "Singh", "Bose", "Mehta", "Das"];
const CITIES = [
  ["Mumbai", "Maharashtra", "400001"],
  ["Bengaluru", "Karnataka", "560001"],
  ["Delhi", "Delhi", "110001"],
  ["Pune", "Maharashtra", "411001"],
  ["Chennai", "Tamil Nadu", "600001"],
];

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log("🌱 Seeding Loanlo…");

  // Clean slate (order matters for referential clarity)
  await prisma.payment.deleteMany();
  await prisma.emiSchedule.deleteMany();
  await prisma.document.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.counter.deleteMany();

  // Staff
  const superAdmin = await createStaff("Super Admin", "superadmin@loanlo.com", "SUPER_ADMIN", "9000000001");
  await createStaff("Admin User", "admin@loanlo.com", "ADMIN", "9000000002");
  const agents = await Promise.all([
    createStaff("Priya Agent", "priya@loanlo.com", "AGENT", "9000000003"),
    createStaff("Rahul Agent", "rahul@loanlo.com", "AGENT", "9000000004"),
  ]);
  console.log("✅ Created staff accounts");

  // Customers
  let custSeq = 0;
  const customers = [];
  for (let i = 0; i < 14; i++) {
    custSeq++;
    const firstName = rand(FIRST);
    const lastName = rand(LAST);
    const [city, state, pincode] = rand(CITIES);
    const agent = rand(agents);
    const customer = await prisma.customer.create({
      data: {
        customerCode: `CUS-${String(custSeq).padStart(6, "0")}`,
        firstName,
        lastName,
        phone: `9${randInt(100000000, 999999999)}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`,
        gender: rand(["MALE", "FEMALE", "OTHER"] as const),
        occupation: rand(["Salaried", "Self-employed", "Business", "Professional"]),
        monthlyIncome: randInt(25000, 150000),
        aadhaarNumber: String(randInt(100000000000, 999999999999)),
        panNumber: `ABCDE${randInt(1000, 9999)}F`,
        kycStatus: rand(["PENDING", "VERIFIED", "VERIFIED", "REJECTED"] as const),
        addressLine1: `${randInt(1, 200)}, Main Road`,
        city,
        state,
        pincode,
        assignedAgentId: agent.id,
        createdById: agent.id,
      },
    });
    customers.push(customer);
  }
  await prisma.counter.create({ data: { id: "customer", value: custSeq } });
  console.log(`✅ Created ${customers.length} customers`);

  // Loans
  const statuses: LoanStatus[] = ["PENDING", "APPROVED", "ACTIVE", "ACTIVE", "ACTIVE", "OVERDUE", "CLOSED", "REJECTED"];
  let loanSeq = 0;
  const year = new Date().getFullYear();

  for (let i = 0; i < 22; i++) {
    loanSeq++;
    const customer = rand(customers);
    const status = rand(statuses);
    const principal = randInt(20, 500) * 1000;
    const rate = rand([12, 14, 16, 18, 20, 24]);
    const tenure = rand([6, 9, 12, 18, 24, 36]);
    const fee = Math.round(principal * 0.01);
    const loanType = rand(["EMI", "FLAT_INTEREST", "REDUCING_BALANCE"] as const) as LoanType;
    const gracePeriodDays = rand([0, 0, 3, 5, 7]);
    const calc = calculateLoan(
      { principal, annualInterestRate: rate, tenureMonths: tenure, processingFee: fee },
      loanType as LoanMethod,
    );

    const isDisbursed = ["ACTIVE", "OVERDUE", "CLOSED"].includes(status);
    const monthsAgo = status === "OVERDUE" ? randInt(4, 10) : status === "CLOSED" ? tenure + 1 : randInt(1, 3);
    const disbursementDate = isDisbursed ? subMonths(new Date(), monthsAgo) : null;

    const loan = await prisma.loan.create({
      data: {
        loanNumber: `LN-${year}-${String(loanSeq).padStart(6, "0")}`,
        customerId: customer.id,
        loanType,
        gracePeriodDays,
        principalAmount: principal,
        interestRate: rate,
        processingFee: fee,
        tenureMonths: tenure,
        emiAmount: calc.emiAmount,
        totalInterest: calc.totalInterest,
        totalPayable: calc.totalPayable,
        outstandingPrincipal: principal,
        status,
        purpose: rand(["Business expansion", "Medical", "Education", "Home renovation", "Personal"]),
        disbursementDate,
        maturityDate: disbursementDate ? calculateMaturityDate(disbursementDate, tenure) : null,
        assignedAgentId: customer.assignedAgentId,
        createdById: customer.assignedAgentId,
        approvedById: status !== "PENDING" && status !== "REJECTED" ? superAdmin.id : null,
      },
    });

    if (isDisbursed && disbursementDate) {
      const schedule = generateSchedule(
        { principal, annualInterestRate: rate, tenureMonths: tenure },
        loanType as LoanMethod,
        disbursementDate,
      );
      await prisma.emiSchedule.createMany({
        data: schedule.map((s) => ({
          loanId: loan.id,
          installmentNumber: s.installmentNumber,
          dueDate: s.dueDate,
          emiAmount: s.emiAmount,
          principalComponent: s.principalComponent,
          interestComponent: s.interestComponent,
          remainingBalance: s.remainingBalance,
        })),
      });

      const emis = await prisma.emiSchedule.findMany({
        where: { loanId: loan.id },
        orderBy: { installmentNumber: "asc" },
      });

      // How many installments to mark paid
      let paidCount = 0;
      if (status === "CLOSED") paidCount = emis.length;
      else if (status === "ACTIVE") paidCount = Math.min(emis.length, randInt(1, Math.max(1, monthsAgo)));
      else if (status === "OVERDUE")
        paidCount = Math.min(emis.length - 1, Math.max(0, monthsAgo - randInt(2, 3)));

      let principalPaid = 0;
      for (let p = 0; p < paidCount; p++) {
        const emi = emis[p];
        principalPaid += emi.principalComponent;
        await prisma.emiSchedule.update({
          where: { id: emi.id },
          data: { status: "PAID", paidAmount: emi.emiAmount, paidDate: emi.dueDate },
        });
        await prisma.payment.create({
          data: {
            loanId: loan.id,
            customerId: customer.id,
            emiScheduleId: emi.id,
            amount: emi.emiAmount,
            principalAmount: emi.principalComponent,
            interestAmount: emi.interestComponent,
            paymentMethod: rand(["CASH", "UPI", "BANK_TRANSFER"] as const),
            paymentDate: emi.dueDate,
            collectedById: customer.assignedAgentId,
          },
        });
      }

      // Track live outstanding principal after the paid installments.
      await prisma.loan.update({
        where: { id: loan.id },
        data: { outstandingPrincipal: Math.max(0, Math.round(principal - principalPaid)) },
      });

      // Mark past-due unpaid installments (beyond grace) as OVERDUE
      if (status === "OVERDUE") {
        const graceCutoff = subMonths(new Date(), 0);
        graceCutoff.setDate(graceCutoff.getDate() - gracePeriodDays);
        await prisma.emiSchedule.updateMany({
          where: { loanId: loan.id, status: { not: "PAID" }, dueDate: { lt: graceCutoff } },
          data: { status: "OVERDUE" },
        });
      }
    }
  }
  await prisma.counter.create({ data: { id: "loan", value: loanSeq } });
  console.log(`✅ Created ${loanSeq} loans with schedules & payments`);

  console.log("\n🎉 Seed complete!\n");
  console.log("Login credentials (password for all: Password123):");
  console.log("  • Super Admin : superadmin@loanlo.com");
  console.log("  • Admin       : admin@loanlo.com");
  console.log("  • Agent       : priya@loanlo.com");
  console.log("  • Agent       : rahul@loanlo.com\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
