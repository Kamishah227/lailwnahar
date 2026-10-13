import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs";
import path from "path";

interface StatementTransaction {
  date: string;
  invoiceNumber?: string;
  description: string;
  charges?: number;
  credits?: number;
  lineTotal: number;
}

interface CustomerStatementData {
  statementNumber: string;
  statementDate: string;
  customerId: string;
  paymentDueDate?: string;
  customerName: string;
  customerCompany?: string;
  customerAddress?: string;
  customerPhone?: string;
  previousBalance: number;
  totalCredits: number;
  newCharges: number;
  totalBalanceDue: number;
  transactions: StatementTransaction[];
}

interface SettingsConfig {
  businessName: string;
  businessSlogan?: string;
  businessAddress: string;
  vatNumber?: string;
  phone?: string;
  email?: string;
  website?: string;
  contactPerson?: string;
}

export async function customerStatementPdf(
  statement: CustomerStatementData,
  config: SettingsConfig
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 Size
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Color Palette
  const PRIMARY_BLUE = rgb(0 / 255, 68 / 255, 116 / 255);
  const SECONDARY_BG = rgb(245 / 255, 247 / 255, 250 / 255);
  const TEXT_DARK = rgb(30 / 255, 30 / 255, 30 / 255);
  const TEXT_MUTED = rgb(100 / 255, 100 / 255, 100 / 255);
  const WHITE = rgb(1, 1, 1);
  const BORDER_COLOR = rgb(215 / 255, 220 / 255, 225 / 255);

  // --- HEADER SECTION ---
  page.drawText(config.businessName || "Lail W Nahar Transport LLC", {
    x: 40,
    y: height - 45,
    size: 20,
    font: fontBold,
    color: TEXT_DARK,
  });

  if (config.businessSlogan) {
    page.drawText(config.businessSlogan, {
      x: 40,
      y: height - 60,
      size: 9,
      font: fontRegular,
      color: TEXT_MUTED,
    });
  }

  page.drawText("Statement", {
    x: width - 170,
    y: height - 45,
    size: 36,
    font: fontBold,
    color: PRIMARY_BLUE,
  });

  // --- LOGO EMBEDDING FROM PUBLIC FOLDER ---
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

  // Statement Metadata Box
  const metaBoxY = height - 130;
  const metaLabels = [
    { label: "Date:", val: statement.statementDate },
    { label: "Statement #", val: statement.statementNumber },
    { label: "Customer ID:", val: statement.customerId },
    { label: "Page", val: "1 of 1" },
  ];

  let metaY = metaBoxY + 35;
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

  // --- BILL TO & ACCOUNT SUMMARY ---
  const boxY = height - 190;

  // Bill To Box
  page.drawRectangle({ x: 40, y: boxY, width: 190, height: 18, color: PRIMARY_BLUE });
  page.drawText("Bill To:", { x: 45, y: boxY + 5, size: 9, font: fontBold, color: WHITE });

  let custY = boxY - 14;
  page.drawText(statement.customerName || "Customer Name", { x: 40, y: custY, size: 9, font: fontBold, color: TEXT_DARK });
  if (statement.customerCompany) {
    custY -= 12;
    page.drawText(statement.customerCompany, { x: 40, y: custY, size: 8.5, font: fontRegular, color: TEXT_DARK });
  }
  if (statement.customerAddress) {
    custY -= 12;
    page.drawText(statement.customerAddress, { x: 40, y: custY, size: 8.5, font: fontRegular, color: TEXT_MUTED });
  }

  // Account Summary Box
  const rightBoxX = width - 260;
  page.drawRectangle({ x: rightBoxX, y: boxY, width: 220, height: 18, color: PRIMARY_BLUE });
  page.drawText("Account Summary", { x: rightBoxX + 5, y: boxY + 5, size: 9, font: fontBold, color: WHITE });

  const summaryRows = [
    { label: "Previous Balance", val: statement.previousBalance },
    { label: "Credits", val: statement.totalCredits },
    { label: "New Charges", val: statement.newCharges },
    { label: "Total Balance Due", val: statement.totalBalanceDue, bold: true },
  ];

  let sumY = boxY - 14;
  summaryRows.forEach((row) => {
    const font = row.bold ? fontBold : fontRegular;
    page.drawText(row.label, { x: rightBoxX, y: sumY, size: 8.5, font, color: TEXT_DARK });
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

  // --- TRANSACTIONS TABLE ---
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
  const tableHeight = 350;

  page.drawRectangle({
    x: 40,
    y: tableY - tableHeight,
    width: width - 80,
    height: tableHeight,
    borderColor: BORDER_COLOR,
    borderWidth: 1,
  });

  statement.transactions.forEach((tx, idx) => {
    if (idx % 2 === 1) {
      page.drawRectangle({
        x: 41,
        y: rowY - 4,
        width: width - 82,
        height: 18,
        color: SECONDARY_BG,
      });
    }

    page.drawText(tx.date, { x: cols[0].x, y: rowY, size: 8, font: fontRegular, color: TEXT_DARK });
    page.drawText(tx.invoiceNumber || "", { x: cols[1].x, y: rowY, size: 8, font: fontRegular, color: TEXT_DARK });
    page.drawText(tx.description, { x: cols[2].x, y: rowY, size: 8, font: fontRegular, color: TEXT_DARK });

    if (tx.charges && tx.charges > 0) {
      page.drawText(`AED ${tx.charges.toFixed(2)}`, { x: cols[3].x, y: rowY, size: 8, font: fontRegular, color: TEXT_DARK });
    }
    if (tx.credits && tx.credits > 0) {
      page.drawText(`AED ${tx.credits.toFixed(2)}`, { x: cols[4].x, y: rowY, size: 8, font: fontRegular, color: TEXT_DARK });
    }

    page.drawText(`AED ${tx.lineTotal.toFixed(2)}`, { x: cols[5].x, y: rowY, size: 8, font: fontBold, color: TEXT_DARK });

    rowY -= 18;
  });

  // --- ACCOUNT CURRENT BALANCE BANNER ---
  const currentBalY = tableY - tableHeight - 20;
  page.drawRectangle({
    x: 40,
    y: currentBalY,
    width: width - 80,
    height: 22,
    color: PRIMARY_BLUE,
  });

  page.drawText("Account Current Balance", {
    x: width - 260,
    y: currentBalY + 6,
    size: 10,
    font: fontBold,
    color: WHITE,
  });

  page.drawText(`AED   ${statement.totalBalanceDue.toFixed(2)}`, {
    x: width - 120,
    y: currentBalY + 6,
    size: 10,
    font: fontBold,
    color: WHITE,
  });

  // --- FOOTER & REMITTANCE NOTES ---
  const footerY = currentBalY - 35;

  page.drawText(
    `Your account balance is AED ${statement.totalBalanceDue.toFixed(2)}. Please make your payment to cover the balance by the due date.`,
    { x: 40, y: footerY, size: 8, font: fontRegular, color: TEXT_DARK }
  );

  page.drawText(`Make all payments payable to ${config.businessName || "Lail W Nahar Transport LLC"}`, {
    x: 130,
    y: footerY - 18,
    size: 9,
    font: fontBold,
    color: TEXT_DARK,
  });

  page.drawText("Thank you for your business!", {
    x: 190,
    y: footerY - 40,
    size: 14,
    font: fontBold,
    color: PRIMARY_BLUE,
  });

  return await pdfDoc.save();
}