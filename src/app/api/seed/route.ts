import { withHandler } from "@/lib/api";
import { FIXED_VAT_RATE, todayISO } from "@/lib/domain";
import {
  createCustomer,
  createInvoice,
  createPayment,
  listCustomers,
  updateSettings,
} from "@/lib/repo";

export const dynamic = "force-dynamic";

function shift(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export async function POST() {
  return withHandler(async () => {
    const existing = await listCustomers();
    if (existing.length > 0) {
      return { seeded: false, message: "Demo data is already loaded.", customers: existing.length };
    }

    await updateSettings({
      businessName: "Harbour & Vale Consulting",
      businessAddress: "Unit 7, Quayside Works\nBristol BS1 4TR\nUnited Kingdom",
      vatNumber: "GB 412 998 233",
      defaultVatRate: FIXED_VAT_RATE,
      currency: "USD",
      vatScheme: "cash",
    });

    const northwind = await createCustomer({
      name: "Northwind Fabrication Ltd",
      contactName: "Aisha Rahman",
      email: "accounts@northwind-fab.com",
      phone: "+44 117 496 0110",
      address: "14 Foundry Road\nSheffield S9 1XZ",
      taxId: "GB 334 220 118",
      notes: "Net 30 terms. Prefers PDF invoices by email.",
    });
    const dental = await createCustomer({
      name: "Blue Harbor Dental Clinic",
      contactName: "Dr. Marco Vidal",
      email: "finance@blueharbor.clinic",
      phone: "+44 131 449 8820",
      address: "2a Shore Street\nEdinburgh EH6 6QU",
      taxId: "GB 901 552 004",
      notes: "Retainer client — monthly service invoice.",
    });
    const tramore = await createCustomer({
      name: "Tramore Logistics GmbH",
      contactName: "Lena Brandt",
      email: "lena.brandt@tramore-log.de",
      phone: "+49 40 5533 1120",
      address: "Hafenstrasse 118\n20359 Hamburg\nGermany",
      taxId: "DE 812 337 905",
      notes: "Reverse-charge VAT does not apply — standard rate charged.",
    });
    await createCustomer({
      name: "Sierra Creative Studio",
      contactName: "Tomás Sierra",
      email: "hello@sierrastudio.design",
      phone: "+34 611 220 451",
      address: "Calle Mayor 19\n28013 Madrid",
      taxId: "ES X9922611B",
      notes: "New prospect — no invoices raised yet.",
    });

    const vat = FIXED_VAT_RATE;

    // Invoice 1 — Northwind, fully settled across two receipts.
    const inv1 = await createInvoice({
      customerId: northwind.id,
      issueDate: shift(120),
      paymentTerms: "30",
      poNumber: "PO-4471",
      notes: "Structural survey and reporting",
      items: [
        {
          description: "Hiring charges of JCB 3CX",
          subDescription: "Full scaffold inspection and reporting pack",
          ratePer: "Per Trip",
          quantity: 1,
          unitPrice: 3200,
          vatRate: vat,
        },
        {
          description: "Site visits",
          subDescription: "Day rate including travel within the region",
          ratePer: "Per Day",
          quantity: 4,
          unitPrice: 650,
          vatRate: vat,
        },
      ],
    });

    // Invoice 2 — Northwind, partially paid.
    const inv2 = await createInvoice({
      customerId: northwind.id,
      issueDate: shift(35),
      paymentTerms: "15",
      notes: "Fabrication QA retainer",
      items: [
        {
          description: "Monthly QA retainer",
          subDescription: "Scheduled weld and coating checks",
          ratePer: "Monthly",
          quantity: 3,
          unitPrice: 900,
          vatRate: vat,
        },
        {
          description: "SHOVEL",
          subDescription: "Certified inspection report issued per visit",
          ratePer: "Per Trip",
          quantity: 1,
          unitPrice: 480,
          vatRate: vat,
        },
      ],
    });

    // Invoice 3 — Dental clinic, fully paid early (previous quarter).
    const inv3 = await createInvoice({
      customerId: dental.id,
      issueDate: shift(200),
      paymentTerms: "60",
      notes: "Practice management system",
      items: [
        {
          description: "TRAILER",
          subDescription: "Annual licence covering 6 workstations",
          ratePer: "Per Trip",
          quantity: 1,
          unitPrice: 2450,
          vatRate: vat,
        },
        {
          description: "SIX WHEEL",
          subDescription: "Two half-day sessions for front desk staff",
          ratePer: "Per Hour",
          quantity: 14,
          unitPrice: 100,
          vatRate: vat,
        },
      ],
    });

    // Invoice 4 — Dental clinic, retainer in current period, unpaid.
    await createInvoice({
      customerId: dental.id,
      issueDate: shift(20),
      paymentTerms: "45",
      notes: "Hiring charges of JCB 3CX",
      items: [
        {
          description: "Hiring charges of JCB 3CX",
          subDescription: "Business-hours support, unlimited tickets",
          ratePer: "Monthly",
          quantity: 3,
          unitPrice: 600,
          vatRate: vat,
        },
      ],
    });

    // Invoice 5 — Tramore, mixed VAT rates, partially paid.
    const inv5 = await createInvoice({
      customerId: tramore.id,
      issueDate: shift(60),
      paymentTerms: "90",
      notes: "Fleet telematics rollout",
      items: [
        {
          description: "Telematics hardware",
          subDescription: "GPS unit with driver terminal",
          ratePer: "Per Trip",
          quantity: 25,
          unitPrice: 190,
          vatRate: vat,
        },
        {
          description: "Installation labour",
          subDescription: "Fitter time including vehicle downtime",
          ratePer: "Per Hour",
          quantity: 25,
          unitPrice: 60,
          vatRate: vat,
        },
        {
          description: "Data migration",
          subDescription: "Legacy route data imported and validated",
          ratePer: "Per Trip",
          quantity: 1,
          unitPrice: 1500,
          vatRate: vat,
        },
      ],
    });

    // Receipts — deliberately spread across quarters so the cash-basis VAT
    // report shows different results per period.
    await createPayment({ invoiceId: inv1.id, paymentDate: shift(112), amount: 2000, method: "Bank transfer", reference: "TRX-88901" });
    await createPayment({ invoiceId: inv1.id, paymentDate: shift(96), amount: 4090, method: "Bank transfer", reference: "TRX-88944" });
    await createPayment({ invoiceId: inv3.id, paymentDate: shift(188), amount: 1500, method: "Credit card", reference: "CARD-2211" });
    await createPayment({ invoiceId: inv3.id, paymentDate: shift(150), amount: 2542.50, method: "Bank transfer", reference: "TRX-99120" });
    await createPayment({ invoiceId: inv5.id, paymentDate: shift(55), amount: 3000, method: "Wire / SWIFT", reference: "SWIFT-DE-771" });
    await createPayment({ invoiceId: inv5.id, paymentDate: shift(9), amount: 1250, method: "Bank transfer", reference: "TRX-77120" });
    await createPayment({ invoiceId: inv2.id, paymentDate: shift(3), amount: 1500, method: "Cash", reference: "CASH-TILL-14", note: "Part payment — balance expected on terms" });


    // -----------------------------------------------------------------
    // Fleet: vehicles, per-vehicle revenue, operator salaries, expenses
    // -----------------------------------------------------------------
    const { ensureCategories } = await import("@/lib/expenses");
    const { saveVehicle, addVehicleIncome, addSalary } = await import("@/lib/fleet");
    const categories = await ensureCategories();
    const catId = (name: string) => categories.find((row) => row.name === name)?.id ?? null;

    const [truckOne, truckTwo, truckThree] = await Promise.all([
      saveVehicle({
        code: "TRK-001",
        make: "Mercedes-Benz",
        model: "Actros 1845",
        year: 2021,
        plateNumber: "NBK 4412",
        status: "active",
        assignedOperator: "Khalid Al Mutairi",
        operatorMonthlySalary: 1450,
        purchasedAt: "2021-03-14",
        notes: "Long-haul trunk routes, 40t curtain-side trailer.",
      }),
      saveVehicle({
        code: "TRK-002",
        make: "Volvo",
        model: "FH 460",
        year: 2019,
        plateNumber: "NBK 7781",
        status: "active",
        assignedOperator: "Khalid Al Mutairi",
        operatorMonthlySalary: 1350,
        purchasedAt: "2019-08-02",
        notes: "Regional distribution, fridge body.",
      }),
      saveVehicle({
        code: "TRK-003",
        make: "Isuzu",
        model: "NPR 400",
        year: 2016,
        plateNumber: "NBK 1180",
        status: "maintenance",
        assignedOperator: "Faisal Rahman",
        operatorMonthlySalary: 1100,
        purchasedAt: "2016-05-20",
        notes: "Urban deliveries; high maintenance cost asset.",
      }),
    ]);

    // Vehicle revenue (cash revenue booked directly against the asset)
    const incomeSpecs: { vehicleId: number; days: number; description: string; customer: string; ratePer: string; quantity: number; unitPrice: number }[] = [
      { vehicleId: truckOne.id, days: 118, description: "TRAILER", customer: "Tramore Logistics GmbH", ratePer: "Per Trip", quantity: 12, unitPrice: 1900 },
      { vehicleId: truckOne.id, days: 88, description: "TRAILER", customer: "Tramore Logistics GmbH", ratePer: "Per Trip", quantity: 9, unitPrice: 1850 },
      { vehicleId: truckOne.id, days: 12, description: "Weekend charter", customer: "Northwind Fabrication Ltd", ratePer: "Per Day", quantity: 2, unitPrice: 1450 },
      { vehicleId: truckTwo.id, days: 96, description: "Chilled distribution", customer: "Blue Harbor Dental Clinic", ratePer: "Per Trip", quantity: 22, unitPrice: 420 },
      { vehicleId: truckTwo.id, days: 30, description: "Chilled distribution", customer: "Blue Harbor Dental Clinic", ratePer: "Per Trip", quantity: 18, unitPrice: 405 },
      { vehicleId: truckThree.id, days: 75, description: "Urban delivery runs", customer: "Sierra Creative Studio", ratePer: "Per Day", quantity: 14, unitPrice: 260 },
      { vehicleId: truckThree.id, days: 20, description: "Urban delivery runs", customer: "Sierra Creative Studio", ratePer: "Per Day", quantity: 6, unitPrice: 250 },
    ];
    for (const spec of incomeSpecs) {
      await addVehicleIncome({
        vehicleId: spec.vehicleId,
        incomeDate: shift(spec.days),
        description: spec.description,
        customerName: spec.customer,
        ratePer: spec.ratePer,
        quantity: spec.quantity,
        unitPrice: spec.unitPrice,
        vatRate: FIXED_VAT_RATE,
      });
    }

    // Operator payroll tied to each vehicle
    const salarySpecs: { vehicleId: number; operator: string; days: number; amount: number; period: string }[] = [
      { vehicleId: truckOne.id, operator: "Khalid Al Mutairi", days: 120, amount: 1450, period: "2026-05" },
      { vehicleId: truckOne.id, operator: "Khalid Al Mutairi", days: 90, amount: 1450, period: "2026-06" },
      { vehicleId: truckOne.id, operator: "Khalid Al Mutairi", days: 40, amount: 1450, period: "2026-08" },
      { vehicleId: truckTwo.id, operator: "Khalid Al Mutairi", days: 95, amount: 1350, period: "2026-06" },
      { vehicleId: truckTwo.id, operator: "Khalid Al Mutairi", days: 35, amount: 1350, period: "2026-08" },
      { vehicleId: truckThree.id, operator: "Faisal Rahman", days: 80, amount: 1100, period: "2026-06" },
      { vehicleId: truckThree.id, operator: "Faisal Rahman", days: 25, amount: 1100, period: "2026-08" },
    ];
    for (const spec of salarySpecs) {
      await addSalary({
        vehicleId: spec.vehicleId,
        operatorName: spec.operator,
        periodLabel: spec.period,
        paymentDate: shift(spec.days),
        amount: spec.amount,
      });
    }

    // Direct (vehicle) and indirect (overhead) expenses with input VAT
    const { createExpense } = await import("@/lib/expenses");
    const expenseSpecs: {
      days: number; vendor: string; vendorTaxId: string; ref: string; description: string;
      category: string; type: "direct" | "indirect"; vehicleId: number | null; net: number;
    }[] = [
      { days: 115, vendor: "Gulf Fuel Card Services", vendorTaxId: "AE 100 2233 4", ref: "FC-88121", description: "Diesel - trunk routes", category: "Fuel", type: "direct", vehicleId: truckOne.id, net: 4200 },
      { days: 84, vendor: "Gulf Fuel Card Services", vendorTaxId: "AE 100 2233 4", ref: "FC-88455", description: "Diesel - regional runs", category: "Fuel", type: "direct", vehicleId: truckTwo.id, net: 2650 },
      { days: 70, vendor: "Gulf Fuel Card Services", vendorTaxId: "AE 100 2233 4", ref: "FC-88512", description: "Diesel - urban deliveries", category: "Fuel", type: "direct", vehicleId: truckThree.id, net: 1580 },
      { days: 66, vendor: "Al Jazar Heavy Motors", vendorTaxId: "AE 100 8890 1", ref: "SVC-2201", description: "Full service, brake overhaul and tyres", category: "Vehicle maintenance", type: "direct", vehicleId: truckOne.id, net: 3100 },
      { days: 48, vendor: "Northern Tyre & Axle", vendorTaxId: "AE 100 4412 9", ref: "TYR-1180", description: "Tyre replacement and balancing", category: "Tyres", type: "direct", vehicleId: truckThree.id, net: 2400 },
      { days: 21, vendor: "Salik Toll Authority", vendorTaxId: "AE 100 7712 2", ref: "TOL-9931", description: "Tolls and parking", category: "Tolls & parking", type: "direct", vehicleId: truckTwo.id, net: 640 },
      { days: 150, vendor: "Quayside Business Park", vendorTaxId: "GB 881 220 114", ref: "RENT-Q3", description: "Office and yard rent", category: "Office rent", type: "indirect", vehicleId: null, net: 9000 },
      { days: 60, vendor: "Emirates Utilities", vendorTaxId: "AE 100 3311 8", ref: "UT-5512", description: "Electricity and water", category: "Utilities", type: "indirect", vehicleId: null, net: 1850 },
      { days: 44, vendor: "Harbour & Co Chartered Accountants", vendorTaxId: "GB 334 001 552", ref: "ACC-2026-07", description: "Bookkeeping and tax filing", category: "Accounting & legal", type: "indirect", vehicleId: null, net: 2600 },
      { days: 18, vendor: "Fleetcover Insurance", vendorTaxId: "AE 100 6650 3", ref: "INS-4471", description: "Fleet insurance renewal", category: "Insurance", type: "indirect", vehicleId: null, net: 5200 },
    ];
    for (const spec of expenseSpecs) {
      await createExpense({
        expenseDate: shift(spec.days),
        vendorName: spec.vendor,
        vendorTaxId: spec.vendorTaxId,
        vendorInvoiceRef: spec.ref,
        description: spec.description,
        categoryId: catId(spec.category),
        type: spec.type,
        vehicleId: spec.vehicleId,
        netAmount: spec.net,
        vatRate: FIXED_VAT_RATE,
        paymentMethod: "Bank transfer",
        notes: null,
      });
    }

    // -----------------------------------------------------------------
    // Legal documents register
    // -----------------------------------------------------------------
    const { createDocument } = await import("@/lib/documents");
    const shiftDays = (days: number) => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().slice(0, 10);
    };
    const fleetVehicles = [truckOne, truckTwo, truckThree];
    const vehicleId = (code: string) => fleetVehicles.find((v) => v.code === code)?.id ?? null;

    const documentSpecs: {
      title: string; documentNumber: string; category: string; issuer: string;
      holderName: string | null; code: string | null; issued: number; expiry: number | null;
      notes: string;
    }[] = [
      { title: "TRK-002 registration card", documentNumber: "REG-99120-A", category: "Vehicle registration", issuer: "Road & Transport Authority", holderName: null, code: "TRK-002", issued: -1090, expiry: -3, notes: "Renewal overdue - vehicle cannot legally operate until renewed." },
      { title: "TRK-001 insurance policy", documentNumber: "INS-4471-2026", category: "Vehicle insurance", issuer: "Fleetcover Insurance", holderName: null, code: "TRK-001", issued: -730, expiry: -12, notes: "Third-party liability plus goods in transit cover." },
      { title: "TRK-003 annual inspection certificate", documentNumber: "INSPECT-77120", category: "Vehicle inspection", issuer: "Al Jazar Heavy Motors", holderName: null, code: "TRK-003", issued: -400, expiry: -40, notes: "Brake and emissions test certificate." },
      { title: "Operator driving licence - Faisal Rahman", documentNumber: "DL-4471-9982", category: "Driving licence", issuer: "Traffic Department", holderName: "Faisal Rahman", code: "TRK-003", issued: -1400, expiry: 15, notes: "Heavy vehicle category." },
      { title: "TRK-001 registration card", documentNumber: "REG-44120-A", category: "Vehicle registration", issuer: "Road & Transport Authority", holderName: null, code: "TRK-001", issued: -1000, expiry: 25, notes: "Annual registration renewal due." },
      { title: "Operator permit - Khalid Al Mutairi", documentNumber: "PERM-88213", category: "Operator permit", issuer: "Transport Authority", holderName: "Khalid Al Mutairi", code: "TRK-001", issued: -600, expiry: 48, notes: "Hazardous goods endorsement." },
      { title: "TRK-002 insurance policy", documentNumber: "INS-7781-2026", category: "Vehicle insurance", issuer: "Fleetcover Insurance", holderName: null, code: "TRK-002", issued: -165, expiry: 200, notes: "Refrigerated goods cover." },
      { title: "Business trade licence", documentNumber: "TL-2026-4471", category: "Business licence", issuer: "Department of Economic Development", holderName: "Harbour & Vale Consulting", code: null, issued: -300, expiry: 80, notes: "Head office trade licence." },
      { title: "Tax registration certificate", documentNumber: "VAT-CERT-998233", category: "Tax certificate", issuer: "Federal Tax Authority", holderName: "Harbour & Vale Consulting", code: null, issued: -900, expiry: 150, notes: "VAT registration certificate." },
      { title: "Yard lease agreement", documentNumber: "LEASE-QSP-7", category: "Lease", issuer: "Quayside Business Park", holderName: "Harbour & Vale Consulting", code: null, issued: -250, expiry: null, notes: "Rolling 12-month lease, no fixed expiry." },
      { title: "Health & safety policy statement", documentNumber: "HS-001", category: "Health & safety", issuer: "Internal", holderName: "Harbour & Vale Consulting", code: null, issued: -400, expiry: null, notes: "Reviewed annually by the operations manager." },
    ];
    for (const spec of documentSpecs) {
      await createDocument({
        title: spec.title,
        documentNumber: spec.documentNumber,
        category: spec.category,
        issuer: spec.issuer,
        holderName: spec.holderName,
        vehicleId: spec.code ? vehicleId(spec.code) : null,
        issuedDate: shiftDays(spec.issued),
        expiryDate: spec.expiry === null ? null : shiftDays(spec.expiry),
        renewalDate: spec.expiry === null ? null : shiftDays(spec.expiry - 14),
        renewalLeadDays: 30,
        notes: spec.notes,
      });
    }

    const customers = await listCustomers();
    return {
      seeded: true,
      message: "Demo dataset loaded.",
      customers: customers.length,
      asOf: todayISO(),
    };
  });
}
