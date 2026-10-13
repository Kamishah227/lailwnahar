import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs";
import path from "path";

function formatDate(dateInput: any): string {
  if (!dateInput || dateInput === "-") return "-";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return String(dateInput);

  const day = String(date.getDate()).padStart(2, "0");
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  if (!text) return ["-"];
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  words.forEach((word) => {
    if ((currentLine + " " + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + " " + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  });

  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : ["-"];
}

function numberToWords(amount: number, currency = "AED"): string {
  const num = Number(amount) || 0;
  const intPart = Math.floor(num);
  const decimals = Math.round((num - intPart) * 100);

  const a = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  function inWords(n: number): string {
    if (n === 0) return '';
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + inWords(n % 100) : '');
    if (n < 1000000) return inWords(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + inWords(n % 1000) : '');
    return inWords(Math.floor(n / 1000000)) + ' million' + (n % 1000000 ? ' ' + inWords(n % 1000000) : '');
  }

  const words = intPart === 0 ? 'zero' : inWords(intPart);
  const capitalized = words.charAt(0).toUpperCase() + words.slice(1);
  const centText = decimals > 0 ? ` and ${decimals}/100` : '';
  return `${capitalized}${centText} ${currency} Only`;
}

interface SettingsConfig {
  businessName: string;
  businessAddress: string;
  vatNumber: string;
  phone?: string;
  email?: string;
  logoBase64?: string;
  businessSlogan?: string;
  contactPerson?: string;
}

export async function invoicePdf(
  invoice: any,
  config: SettingsConfig
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 Size (595 x 842 pt)
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Color Palette
  const PRIMARY = rgb(0 / 255, 91 / 255, 130 / 255);
  const SECONDARY_BG = rgb(240 / 255, 246 / 255, 250 / 255);
  const ACCENT_YELLOW = rgb(255 / 255, 184 / 255, 28 / 255);
  const TEXT_DARK = rgb(30 / 255, 41 / 255, 59 / 255);
  const TEXT_MUTED = rgb(100 / 255, 116 / 255, 139 / 255);
  const WHITE = rgb(1, 1, 1);
  const BORDER_COLOR = rgb(210 / 255, 220 / 255, 230 / 255);

  let headerTextX = 40;

  try {
    const publicDir = path.join(process.cwd(), "public");
    let logoPath = path.join(publicDir, "logo.png");
    let isPng = true;

    if (!fs.existsSync(logoPath)) {
      logoPath = path.join(publicDir, "logo.jpg");
      isPng = false;
    }

    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      const logoImage = isPng
        ? await pdfDoc.embedPng(logoBuffer)
        : await pdfDoc.embedJpg(logoBuffer);

      const logoDims = logoImage.scaleToFit(110, 42);

      page.drawImage(logoImage, {
        x: 40,
        y: height - 70,
        width: logoDims.width,
        height: logoDims.height,
      });

      headerTextX = 40 + logoDims.width + 12;
    }
  } catch (e) {
    console.error("Error embedding logo from public folder:", e);
  }

  // Header
  page.drawText(config.businessName || "Lail W Nahar Transport LLC", {
    x: headerTextX,
    y: height - 45,
    size: 18,
    font: fontBold,
    color: PRIMARY,
  });

  const companyAddress = config.businessAddress || "Al Jwais Street, Ras Al Khaimah, UAE";
  const companyPhone = config.phone || "+971-50-4232319";
  const companyEmail = config.email || "liaqatiqbal67@yahoo.com";
  const companyTrn = config.vatNumber || "100386937500003";

  page.drawText(companyAddress, { x: headerTextX, y: height - 62, size: 8.5, font: fontRegular, color: TEXT_MUTED });
  page.drawText(`Tel: ${companyPhone}`, { x: headerTextX, y: height - 74, size: 8.5, font: fontRegular, color: TEXT_MUTED });
  page.drawText(`Email: ${companyEmail}`, { x: headerTextX, y: height - 86, size: 8.5, font: fontRegular, color: TEXT_MUTED });
  page.drawText(`TRN / VAT: ${companyTrn}`, { x: headerTextX, y: height - 98, size: 8.5, font: fontBold, color: TEXT_DARK });

  page.drawText("TAX INVOICE", {
    x: width - 230,
    y: height - 45,
    size: 22,
    font: fontBold,
    color: PRIMARY,
  });

  page.drawRectangle({
    x: width - 230,
    y: height - 130,
    width: 190,
    height: 72,
    color: SECONDARY_BG,
  });

  const formattedIssueDate = formatDate(invoice.issueDate || invoice.date);
  const formattedDueDate = formatDate(invoice.dueDate || invoice.paymentDueDate || invoice.due_date);
  const poRefVal = invoice.poNumber || invoice.reference || invoice.po_number || invoice.poNo || "-";

  const metaData = [
    { label: "Invoice No", val: `:  ${invoice.invoiceNumber || invoice.number || "-"}` },
    { label: "Invoice Date", val: `:  ${formattedIssueDate}` },
    { label: "Due Date", val: `:  ${formattedDueDate}` },
    { label: "PO / Ref No", val: `:  ${poRefVal}` },
  ];

  let metaY = height - 70;
  metaData.forEach((m) => {
    page.drawText(m.label, { x: width - 220, y: metaY, size: 8.5, font: fontBold, color: TEXT_DARK });
    page.drawText(m.val, { x: width - 150, y: metaY, size: 8.5, font: fontRegular, color: TEXT_DARK });
    metaY -= 15;
  });

  const boxY = height - 195;
  const boxWidth = (width - 90) / 2;

  page.drawRectangle({ x: 40, y: boxY + 38, width: boxWidth, height: 18, color: PRIMARY });
  page.drawText("BILL TO", { x: 50, y: boxY + 43, size: 9, font: fontBold, color: WHITE });

  page.drawRectangle({ x: 40, y: boxY - 15, width: boxWidth, height: 53, color: SECONDARY_BG });
  page.drawText(invoice.customerName || invoice.customer?.name || "Customer", { x: 50, y: boxY + 24, size: 10, font: fontBold, color: TEXT_DARK });

  const custAddress = invoice.customerAddress || invoice.customer?.address || "P.O. Box 12345, Dubai, UAE";
  const custPhone = invoice.customerPhone || invoice.customer?.phone ? `Tel: ${invoice.customerPhone || invoice.customer?.phone}` : "";

  page.drawText(custAddress, { x: 50, y: boxY + 10, size: 8.5, font: fontRegular, color: TEXT_MUTED });
  if (custPhone) {
    page.drawText(custPhone, { x: 50, y: boxY - 2, size: 8, font: fontRegular, color: TEXT_MUTED });
  }

  page.drawRectangle({ x: 50 + boxWidth, y: boxY + 38, width: boxWidth, height: 18, color: PRIMARY });
  page.drawText("CUSTOMER VAT / TRN", { x: 60 + boxWidth, y: boxY + 43, size: 9, font: fontBold, color: WHITE });

  page.drawRectangle({ x: 50 + boxWidth, y: boxY - 15, width: boxWidth, height: 53, color: SECONDARY_BG });

  const rawTrn = (
    invoice.customerTaxId ||
    invoice.customer?.taxId ||
    invoice.vatNumber ||
    invoice.taxId ||
    invoice.trn ||
    invoice.customer?.vatNumber ||
    ""
  ).toString().trim();

  if (rawTrn && rawTrn !== "N/A" && rawTrn !== "-") {
    page.drawText(`TRN: ${rawTrn}`, { x: 60 + boxWidth, y: boxY + 22, size: 9.5, font: fontBold, color: TEXT_DARK });
  } else {
    page.drawText("TRN: -", { x: 60 + boxWidth, y: boxY + 22, size: 9.5, font: fontRegular, color: TEXT_MUTED });
  }

  const tableY = boxY - 60;
  // Columns for Invoice with Debit & Credit
  const cols = [
    { name: "Date", x: 45, w: 55 },
    { name: "Description", x: 105, w: 155 },
    { name: "Rate Basis / Qty", x: 265, w: 75 },
    { name: "Debit (AED)", x: 345, w: 65 },
    { name: "Credit (AED)", x: 415, w: 65 },
    { name: "Balance", x: 485, w: 65 },
  ];

  page.drawRectangle({ x: 40, y: tableY, width: width - 80, height: 20, color: PRIMARY });
  cols.forEach((col) => {
    page.drawText(col.name, { x: col.x, y: tableY + 5, size: 8, font: fontBold, color: WHITE });
  });

  let rowY = tableY - 18;
  const invoiceItems = invoice.items || invoice.lines || [];
  const paymentsList = invoice.payments || [];

  let runningBalance = 0;

  // 1. Draw Invoice Items as Debits
  invoiceItems.forEach((item: any, idx: number) => {
    const descLines = wrapText(item.description, 30);
    const maxLines = Math.max(descLines.length, 1);
    const lineHeight = 10;
    const rowHeight = Math.max(20, maxLines * lineHeight + 8);

    page.drawRectangle({
      x: 40,
      y: rowY - rowHeight + 14,
      width: width - 80,
      height: rowHeight,
      color: idx % 2 === 0 ? WHITE : SECONDARY_BG,
      borderColor: BORDER_COLOR,
      borderWidth: 0.5,
    });

    const qty = Number(item.quantity || 1);
    const price = Number(item.unitPrice || item.rate || 0);
    const vatRate = Number(item.vatRate ?? 5);
    const itemGross = qty * price * (1 + vatRate / 100);
    runningBalance += itemGross;

    const itemDate = idx === 0 ? formattedIssueDate : "";
    page.drawText(itemDate, { x: cols[0].x, y: rowY, size: 7.5, font: fontRegular, color: TEXT_DARK });
    page.drawText(`${item.ratePer || "Trip"} (Qty: ${qty})`, { x: cols[2].x, y: rowY, size: 7.5, font: fontRegular, color: TEXT_DARK });
    page.drawText(itemGross.toFixed(2), { x: cols[3].x, y: rowY, size: 8, font: fontRegular, color: TEXT_DARK }); // Debit
    page.drawText("-", { x: cols[4].x, y: rowY, size: 8, font: fontRegular, color: TEXT_MUTED }); // Credit
    page.drawText(runningBalance.toFixed(2), { x: cols[5].x, y: rowY, size: 8, font: fontBold, color: TEXT_DARK });

    let dY = rowY;
    descLines.forEach((line) => {
      page.drawText(line, { x: cols[1].x, y: dY, size: 7.5, font: fontRegular, color: TEXT_DARK });
      dY -= lineHeight;
    });

    rowY -= rowHeight;
  });

  // 2. Draw Payments made against this invoice as Credits
  paymentsList.forEach((pay: any, idx: number) => {
    const payDate = formatDate(pay.paymentDate || pay.date);
    const payAmount = Number(pay.amount || 0);
    runningBalance -= payAmount;

    page.drawRectangle({
      x: 40,
      y: rowY - 14,
      width: width - 80,
      height: 20,
      color: (invoiceItems.length + idx) % 2 === 0 ? WHITE : SECONDARY_BG,
      borderColor: BORDER_COLOR,
      borderWidth: 0.5,
    });

    page.drawText(payDate, { x: cols[0].x, y: rowY, size: 7.5, font: fontRegular, color: TEXT_DARK });
    page.drawText(`Payment Received (${pay.method || "Cash"})`, { x: cols[1].x, y: rowY, size: 7.5, font: fontRegular, color: TEXT_DARK });
    page.drawText(`Ref: ${pay.receiptNumber || pay.reference || "-"}`, { x: cols[2].x, y: rowY, size: 7, font: fontRegular, color: TEXT_MUTED });
    page.drawText("-", { x: cols[3].x, y: rowY, size: 8, font: fontRegular, color: TEXT_MUTED }); // Debit
    page.drawText(payAmount.toFixed(2), { x: cols[4].x, y: rowY, size: 8, font: fontRegular, color: PRIMARY }); // Credit
    page.drawText(runningBalance.toFixed(2), { x: cols[5].x, y: rowY, size: 8, font: fontBold, color: TEXT_DARK });

    rowY -= 20;
  });

  const totalsY = rowY - 22;
  const subtotalVal = Number(invoice.subtotal || 0);
  const vatTotalVal = Number(invoice.vatTotal || 0);
  const totalVal = Number(invoice.total || 0);

  // Totals Section (Right)
  page.drawRectangle({ x: width - 260, y: totalsY, width: 220, height: 18, color: SECONDARY_BG });
  page.drawText("Subtotal (AED)", { x: width - 250, y: totalsY + 4, size: 10, font: fontBold, color: TEXT_DARK });
  page.drawText(subtotalVal.toFixed(2), { x: width - 95, y: totalsY + 4, size: 10, font: fontBold, color: TEXT_DARK });

  page.drawRectangle({ x: width - 260, y: totalsY - 20, width: 220, height: 18, color: SECONDARY_BG });
  page.drawText("VAT (5%)", { x: width - 250, y: totalsY - 16, size: 8.5, font: fontBold, color: TEXT_DARK });
  page.drawText(vatTotalVal.toFixed(2), { x: width - 89, y: totalsY - 16, size: 10, font: fontBold, color: TEXT_DARK });

  page.drawRectangle({ x: width - 260, y: totalsY - 42, width: 105, height: 22, color: PRIMARY });
  page.drawText("Grand Total", { x: width - 245, y: totalsY - 35, size: 10, font: fontBold, color: WHITE });

  page.drawRectangle({ x: width - 155, y: totalsY - 42, width: 115, height: 22, color: ACCENT_YELLOW });
  page.drawText(`AED ${totalVal.toFixed(2)}`, { x: width - 120, y: totalsY - 35, size: 10, font: fontBold, color: TEXT_DARK });

  // Grand Total in Words (Bottom Left of the totals area)
  const totalInWords = numberToWords(totalVal, invoice.currency || "AED");
  page.drawText("Amount in Words:", { x: 40, y: totalsY - 10, size: 8, font: fontBold, color: TEXT_MUTED });
  page.drawText(totalInWords, { x: 40, y: totalsY - 22, size: 8.5, font: fontBold, color: PRIMARY });

  const sigY = totalsY - 205;

  page.drawLine({ start: { x: 40, y: sigY }, end: { x: 200, y: sigY }, thickness: 1, color: TEXT_MUTED });
  page.drawText("Received By (Signature)", { x: 40, y: sigY - 12, size: 8, font: fontRegular, color: TEXT_MUTED });

  page.drawLine({ start: { x: width - 200, y: sigY }, end: { x: width - 40, y: sigY }, thickness: 1, color: TEXT_MUTED });
  page.drawText("Authorized Signatory & Stamp", { x: width - 200, y: sigY - 12, size: 8, font: fontBold, color: PRIMARY });

  const bottomY = sigY - 210;

  page.drawRectangle({ x: 40, y: bottomY, width: 220, height: 68, color: SECONDARY_BG });
  page.drawText("Payment Information", { x: 50, y: bottomY + 52, size: 11, font: fontBold, color: PRIMARY });
  const bankDetails = [
    "Bank: Emirates NBD",
    "Account No.: 1234567890",
    "IBAN: AE12 3456 7890 1234 5678 901",
    "Swift: EBILAEAD",
  ];
  let bY = bottomY + 38;
  bankDetails.forEach((b) => {
    page.drawText(b, { x: 50, y: bY, size: 7.5, font: fontRegular, color: TEXT_DARK });
    bY -= 10.5;
  });

  page.drawText("Notes", { x: 280, y: bottomY + 52, size: 11, font: fontBold, color: PRIMARY });
  const notes = [
    "• Rental includes equipment only.",
    "• Fuel and operator charged separately if applicable.",
    "• Payment within 14 days.",
    "• Include invoice number in your payment reference.",
  ];
  let nY = bottomY + 38;
  notes.forEach((n) => {
    page.drawText(n, { x: 280, y: nY, size: 7.5, font: fontRegular, color: TEXT_MUTED });
    nY -= 10.5;
  });

  page.drawRectangle({ x: 0, y: 0, width: width, height: 22, color: PRIMARY });
  page.drawText(
    `${companyPhone}   |   ${companyEmail}   |   ${companyAddress}`,
    { x: 180, y: 7, size: 9, font: fontRegular, color: WHITE }
  );

  return await pdfDoc.save();
}

export async function statementPdf(
  statement: any,
  config: SettingsConfig
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const PRIMARY_BLUE = rgb(0 / 255, 68 / 255, 116 / 255);
  const SECONDARY_BG = rgb(245 / 255, 247 / 255, 250 / 255);
  const TEXT_DARK = rgb(30 / 255, 30 / 255, 30 / 255);
  const TEXT_MUTED = rgb(100 / 255, 100 / 255, 100 / 255);
  const WHITE = rgb(1, 1, 1);
  const BORDER_COLOR = rgb(215 / 255, 220 / 255, 225 / 255);

  const todayStr = new Date().toISOString().split("T")[0];

  page.drawText(config.businessName || "Lail W Nahar Transport LLC", {
    x: 95,
    y: height - 105,
    size: 18,
    font: fontBold,
    color: TEXT_DARK,
  });

  page.drawText("Statement Of Account", {
    x: width - 290,
    y: height - 45,
    size: 22,
    font: fontBold,
    color: PRIMARY_BLUE,
  });

  try {
    const publicDir = path.join(process.cwd(), "public");
    let logoPath = path.join(publicDir, "logo.png");
    let isPng = true;

    if (!fs.existsSync(logoPath)) {
      logoPath = path.join(publicDir, "logo.jpg");
      isPng = false;
    }

    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      const logoImage = isPng
        ? await pdfDoc.embedPng(logoBuffer)
        : await pdfDoc.embedJpg(logoBuffer);

      const logoDims = logoImage.scaleToFit(140, 45);

      page.drawImage(logoImage, {
        x: 40,
        y: height - 125,
        width: logoDims.width,
        height: logoDims.height,
      });
    }
  } catch (e) {
    console.error("Error embedding logo:", e);
  }

  const metaBoxY = height - 130;
  const rawStatementDate = statement.statementDate || statement.date || statement.asOf || todayStr;
  const statementDate = formatDate(rawStatementDate);
  const statementNumber = statement.statementNumber || statement.id || `ST-${statement.customerId || 1}`;
  const customerIdStr = String(statement.customerId || statement.customer?.id || "-");

  const metaLabels = [
    { label: "Date:", val: statementDate },
    { label: "Statement #", val: String(statementNumber) },
    { label: "Customer ID:", val: customerIdStr },
    { label: "Page", val: "1 of 1" },
  ];

  let metaY = metaBoxY + 45;
  metaLabels.forEach((m) => {
    page.drawText(m.label, { x: width - 230, y: metaY, size: 8.5, font: fontRegular, color: TEXT_DARK });
    page.drawRectangle({
      x: width - 145,
      y: metaY - 3,
      width: 105,
      height: 14,
      borderColor: BORDER_COLOR,
      borderWidth: 0.5,
    });
    page.drawText(m.val, { x: width - 140, y: metaY, size: 8.5, font: fontRegular, color: TEXT_DARK });
    metaY -= 16;
  });

  const boxY = height - 190;

  page.drawRectangle({ x: 40, y: boxY, width: 190, height: 18, color: PRIMARY_BLUE });
  page.drawText("Bill To:", { x: 45, y: boxY + 5, size: 9, font: fontBold, color: WHITE });

  const custName = statement.customerName || statement.customer?.name || "Customer";
  const custAddr = statement.customerAddress || statement.customer?.address || "";
  const custPhone = statement.customerPhone || statement.customer?.phone || "";
  const custTrn = statement.customerTaxId || statement.customer?.taxId || statement.customer?.vatNumber || "";

  let custY = boxY - 14;
  page.drawText(custName, { x: 40, y: custY, size: 9, font: fontBold, color: TEXT_DARK });
  if (custTrn) {
    custY -= 12;
    page.drawText(`TRN: ${custTrn}`, { x: 40, y: custY, size: 8.5, font: fontBold, color: TEXT_DARK });
  }
  if (custAddr) {
    custY -= 12;
    page.drawText(custAddr, { x: 40, y: custY, size: 8.5, font: fontRegular, color: TEXT_MUTED });
  }
  if (custPhone) {
    custY -= 12;
    page.drawText(`Tel: ${custPhone}`, { x: 40, y: custY, size: 8.5, font: fontRegular, color: TEXT_MUTED });
  }

  const prevBalance = Number(statement.previousBalance ?? statement.openingBalance ?? 0);
  const totalCredits = Number(statement.totalCredits ?? statement.totalPaid ?? statement.totalPaidSum ?? statement.totalReceived ?? 0);
  const newCharges = Number(statement.newCharges ?? statement.totalInvoiced ?? statement.periodInvoiced ?? 0);
  const totalBalanceDue = Number(
    statement.totalBalanceDue ?? statement.closingBalance ?? statement.balance ?? (prevBalance + newCharges - totalCredits)
  );

  const rightBoxX = width - 260;
  page.drawRectangle({ x: rightBoxX, y: boxY, width: 220, height: 18, color: PRIMARY_BLUE });
  page.drawText("Account Summary", { x: rightBoxX + 5, y: boxY + 5, size: 9, font: fontBold, color: WHITE });

  const summaryRows = [
    { label: "Previous Balance", val: prevBalance },
    { label: "Credits", val: totalCredits },
    { label: "New Charges", val: newCharges },
    { label: "Total Balance Due", val: totalBalanceDue, bold: true },
  ];

  let sumY = boxY - 15;
  summaryRows.forEach((row) => {
    const font = row.bold ? fontBold : fontRegular;
    page.drawText(row.label, { x: rightBoxX, y: sumY + 7, size: 8.5, font, color: TEXT_DARK });
    page.drawText("AED", { x: rightBoxX + 130, y: sumY, size: 8.5, font, color: TEXT_DARK });
    page.drawText(row.val.toFixed(2), { x: rightBoxX + 170, y: sumY, size: 8.5, font, color: TEXT_DARK });
    if (row.bold) {
      page.drawLine({
        start: { x: rightBoxX, y: sumY - 2 },
        end: { x: rightBoxX + 220, y: sumY - 2 },
        thickness: 0.8,
        color: TEXT_DARK,
      });
    }
    sumY -= 14;
  });

  const tableY = boxY - 90;
  const cols = [
    { name: "Date", x: 45, w: 55 },
    { name: "Invoice #", x: 105, w: 60 },
    { name: "Description", x: 170, w: 185 },
    { name: "Charges", x: 360, w: 60 },
    { name: "Credits", x: 425, w: 60 },
    { name: "Line Total", x: 490, w: 60 },
  ];

  page.drawRectangle({ x: 40, y: tableY, width: width - 80, height: 20, color: PRIMARY_BLUE });
  cols.forEach((col) => {
    page.drawText(col.name, { x: col.x, y: tableY + 5, size: 8.5, font: fontBold, color: WHITE });
  });

  let rowY = tableY - 18;
  const tableHeight = 310;

  page.drawRectangle({
    x: 40,
    y: tableY - tableHeight,
    width: width - 80,
    height: tableHeight,
    borderColor: BORDER_COLOR,
    borderWidth: 1,
  });

  const rawRows =
    statement.rows ||
    statement.transactions ||
    statement.entries ||
    statement.lines ||
    statement.items ||
    [];

  rawRows.forEach((tx: any, idx: number) => {
    if (idx % 2 === 1) {
      page.drawRectangle({
        x: 41,
        y: rowY - 4,
        width: width - 82,
        height: 18,
        color: SECONDARY_BG,
      });
    }

    const txDate = formatDate(tx.date || tx.issueDate || todayStr);
    const invNo = tx.reference || tx.invoiceNumber || (tx.type === "Invoice" ? `INV-${tx.entityId}` : "-");
    const desc = tx.description || (tx.type === "Payment" ? "Payment Received" : "Invoice raised");
    
    // Correctly fallback to tx.debit / tx.credit generated by buildStatement
    const chargeVal = Number(tx.debit ?? tx.charges ?? (tx.type === "Invoice" || (tx.amount && tx.amount > 0) ? Math.abs(tx.amount || 0) : 0));
    const creditVal = Number(tx.credit ?? tx.credits ?? (tx.type === "Payment" || (tx.amount && tx.amount < 0) ? Math.abs(tx.amount || 0) : 0));
    const lineTot = Number(tx.balance ?? tx.lineTotal ?? tx.runningBalance ?? 0);

    page.drawText(String(txDate), { x: cols[0].x, y: rowY, size: 8, font: fontRegular, color: TEXT_DARK });
    page.drawText(String(invNo), { x: cols[1].x, y: rowY, size: 8, font: fontRegular, color: TEXT_DARK });
    page.drawText(String(desc), { x: cols[2].x, y: rowY, size: 8, font: fontRegular, color: TEXT_DARK });

    if (chargeVal > 0) {
      page.drawText(`AED ${chargeVal.toFixed(2)}`, { x: cols[3].x, y: rowY, size: 8, font: fontRegular, color: TEXT_DARK });
    }
    if (creditVal > 0) {
      page.drawText(`AED ${creditVal.toFixed(2)}`, { x: cols[4].x, y: rowY, size: 8, font: fontRegular, color: TEXT_DARK });
    }

    page.drawText(`AED ${lineTot.toFixed(2)}`, { x: cols[5].x, y: rowY, size: 8, font: fontBold, color: TEXT_DARK });

    rowY -= 18;
  });

  const currentBalY = tableY - tableHeight - 20;
  page.drawRectangle({ x: 40, y: currentBalY, width: width - 80, height: 22, color: PRIMARY_BLUE });
  page.drawText("Account Current Balance   |", { x: width - 260, y: currentBalY + 7, size: 10, font: fontBold, color: WHITE });
  page.drawText(`AED   ${totalBalanceDue.toFixed(2)}`, { x: width - 120, y: currentBalY + 7, size: 10, font: fontBold, color: WHITE });

  const sigY = currentBalY - 85;

  page.drawLine({ start: { x: width - 200, y: sigY }, end: { x: width - 40, y: sigY }, thickness: 1, color: TEXT_MUTED });
  page.drawText("Authorized Signatory & Stamp", { x: width - 200, y: sigY - 12, size: 8, font: fontBold, color: PRIMARY_BLUE });

  const footerY = sigY - 105;

  page.drawText(
    `Your account balance is AED ${totalBalanceDue.toFixed(2)}. Please make your payment to cover the balance by the due date.`,
    { x: 120, y: footerY, size: 8, font: fontRegular, color: TEXT_DARK }
  );

  page.drawText(`Make all payments payable to ${config.businessName || "Lail W Nahar Transport LLC"}`, {
    x: 200,
    y: footerY - 16,
    size: 8.5,
    font: fontBold,
    color: TEXT_DARK,
  });

  page.drawText("Thank you for your business!", {
    x: 230,
    y: footerY - 34,
    size: 12,
    font: fontBold,
    color: PRIMARY_BLUE,
  });

  return await pdfDoc.save();
}