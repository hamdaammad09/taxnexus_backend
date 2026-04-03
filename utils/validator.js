
const isBlank = (v) => v === null || v === undefined || String(v).trim() === "";

// Helper function to convert Excel serial date to JS Date
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

const addError = (errors, { rowNo, fieldName, errorMessage }) => {
  errors.push({
    rowNo: rowNo ?? null,
    fieldName: fieldName ?? null,
    errorMessage: errorMessage ?? "Invalid value",
  });
};

exports.validateTransformedPayload = (payload) => {
  const errors = [];

  if (!payload || typeof payload !== "object") {
    addError(errors, { errorMessage: "Payload is missing" });
    return errors;
  }

  // Check if data is an array (raw Excel data) or has invoices property (transformed)
  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      addError(errors, { fieldName: "invoices", errorMessage: "No invoices found" });
      return errors;
    }
  } else if (!Array.isArray(payload.invoices) || payload.invoices.length === 0) {
    addError(errors, { fieldName: "invoices", errorMessage: "No invoices found" });
    return errors;
  }

  for (const inv of payload.invoices) {
    if (isBlank(inv.invoiceRefNo)) {
      addError(errors, { fieldName: "invoiceRefNo", errorMessage: "invoiceRefNo is required" });
    }
    if (isBlank(inv.invoiceType)) {
      addError(errors, { fieldName: "invoiceType", errorMessage: "invoiceType is required" });
    }
    if (isBlank(inv.invoiceDate)) {
      addError(errors, { fieldName: "invoiceDate", errorMessage: "invoiceDate is required" });
    }
    if (isBlank(inv.sellerNTNCNIC)) {
      addError(errors, { fieldName: "sellerNTNCNIC", errorMessage: "sellerNTNCNIC is required" });
    }
    if (isBlank(inv.buyerNTNCNIC)) {
      addError(errors, { fieldName: "buyerNTNCNIC", errorMessage: "buyerNTNCNIC is required" });
    }
    if (isBlank(inv.buyerRegistrationType)) {
      addError(errors, { fieldName: "buyerRegistrationType", errorMessage: "buyerRegistrationType is required" });
    }
    if (isBlank(inv.scenarioID)) {
      addError(errors, { fieldName: "scenarioID", errorMessage: "scenarioID is required" });
    }

    if (!Array.isArray(inv.items) || inv.items.length === 0) {
      addError(errors, { fieldName: "items", errorMessage: "At least one item row is required" });
      continue;
    }

    for (const item of inv.items) {
      const rowNo = item._rowNo ?? null;
      if (isBlank(item.hsCode)) {
        addError(errors, { rowNo, fieldName: "hsCode", errorMessage: "hsCode is required" });
      }
      if (isBlank(item.productDescription)) {
        addError(errors, { rowNo, fieldName: "productDescription", errorMessage: "productDescription is required" });
      }
      if (item.quantity === null || item.quantity === undefined) {
        addError(errors, { rowNo, fieldName: "quantity", errorMessage: "quantity is required" });
      }
      if (item.rate === null || item.rate === undefined) {
        addError(errors, { rowNo, fieldName: "rate", errorMessage: "rate is required" });
      }
      if (item.valueSalesExcludingST === null || item.valueSalesExcludingST === undefined) {
        addError(errors, {
          rowNo,
          fieldName: "valueSalesExcludingST",
          errorMessage: "valueSalesExcludingST is required",
        });
      }
    }
  }

  return errors;
};

