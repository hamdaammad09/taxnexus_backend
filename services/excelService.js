const XLSX = require("xlsx");

// Helper function to convert Excel serial date to JS Date string (YYYY-MM-DD)
function excelDateToJSDate(serial) {
  if (serial === null || serial === undefined) return null;
  // If already a string date, return as-is
  if (typeof serial === "string" && serial.includes("-")) return serial;
  // Convert Excel serial number to date
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date = new Date(utc_value * 1000);
  // Format as YYYY-MM-DD
  return date.toISOString().split("T")[0];
}

exports.parseExcel = (filePath) => {
  const workbook = XLSX.readFile(filePath);

  console.log("Sheet Names:", workbook.SheetNames);

  const sheetName = workbook.SheetNames[0]; // first sheet
  const sheet = workbook.Sheets[sheetName];

  const data = XLSX.utils.sheet_to_json(sheet, {
    defval: "", // IMPORTANT: default empty string instead of null
  });

  return data.map((r, idx) => ({ ...r, _rowNo: idx + 2 }));
};

exports.transformToFBR = (rows) => {
  if (!Array.isArray(rows)) {
    throw new Error("Excel data is not in expected row-array format");
  }

  const toNumber = (v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(String(v).replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  };

  // Convert Excel serial date to formatted date string
  const toDate = (v) => excelDateToJSDate(v);

  const cleaned = rows
    .filter((r) => r && typeof r === "object")
    .map((r) => ({
      ...r,
      invoiceRefNo: r.invoiceRefNo ?? null,
      scenarioID: r.scenarioID ?? null,
      sellerNTNCNIC: r.sellerNTNCNIC ?? null,
      buyerNTNCNIC: r.buyerNTNCNIC ?? null,
      quantity: toNumber(r.quantity),
      rate: toNumber(r.rate),
      totalValues: toNumber(r.totalValues),
      valueSalesExcludingST: toNumber(r.valueSalesExcludingST),
      salesTaxApplicable: toNumber(r.salesTaxApplicable),
      fixedNotifiedValueOrRetailPrice: toNumber(r.fixedNotifiedValueOrRetailPrice),
      salesTaxWithheldAtSource: toNumber(r.salesTaxWithheldAtSource),
      extraTax: toNumber(r.extraTax),
      furtherTax: toNumber(r.furtherTax),
      fedPayable: toNumber(r.fedPayable),
      discount: toNumber(r.discount),
    }));

  const byInvoiceRef = new Map();
  for (const row of cleaned) {
    // Use invoiceRefNo if available, otherwise fall back to UniqueInvoiceID
    const key = row.invoiceRefNo || row.UniqueInvoiceID;
    if (!key) continue;
    if (!byInvoiceRef.has(key)) byInvoiceRef.set(key, []);
    byInvoiceRef.get(key).push(row);
  }

  const invoices = [];
  for (const [invoiceRefNo, invoiceRows] of byInvoiceRef.entries()) {
    const first = invoiceRows[0] ?? {};

    const invoiceHeader = {
      invoiceRefNo,
      UniqueInvoiceID: first.UniqueInvoiceID ?? null,
      invoiceType: first.invoiceType ?? null,
      invoiceDate: toDate(first.invoiceDate),
      sellerBusinessName: first.sellerBusinessName ?? null,
      sellerProvince: first.sellerProvince ?? null,
      sellerAddress: first.sellerAddress ?? null,
      sellerNTNCNIC: first.sellerNTNCNIC ?? null,
      buyerNTNCNIC: first.buyerNTNCNIC ?? null,
      buyerBusinessName: first.buyerBusinessName ?? null,
      buyerProvince: first.buyerProvince ?? null,
      buyerAddress: first.buyerAddress ?? null,
      buyerRegistrationType: first.buyerRegistrationType ?? null,
      scenarioID: first.scenarioID ?? null,
      saleType: first.saleType ?? null,
    };

    const items = invoiceRows.map((r) => ({
      _rowNo: r._rowNo ?? null,
      hsCode: r.hsCode ?? null,
      productDescription: r.productDescription ?? null,
      rate: r.rate ?? null,
      uom: r.uom ?? null,
      quantity: r.quantity ?? null,
      totalValues: r.totalValues ?? null,
      valueSalesExcludingST: r.valueSalesExcludingST ?? null,
      salesTaxApplicable: r.salesTaxApplicable ?? null,
      fixedNotifiedValueOrRetailPrice: r.fixedNotifiedValueOrRetailPrice ?? null,
      salesTaxWithheldAtSource: r.salesTaxWithheldAtSource ?? null,
      extraTax: r.extraTax ?? null,
      furtherTax: r.furtherTax ?? null,
      sroScheduleNo: r.sroScheduleNo ?? null,
      sroItemSerialNo: r.sroItemSerialNo ?? null,
      fedPayable: r.fedPayable ?? null,
      discount: r.discount ?? null,
    }));

    invoices.push({
      ...invoiceHeader,
      items,
    });
  }

  return { invoices };
};