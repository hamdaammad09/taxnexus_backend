const fs = require("fs");
const pool = require("../config/db");
const { parseExcel, transformToFBR } = require("../services/excelService");
const { validateInvoice, postInvoice } = require("../services/fbrService");
const { validateTransformedPayload } = require("../utils/validator");

const extractValidationErrors = (validationData) => {
  const status = validationData?.validationResponse?.status;
  if (status !== "Invalid") return [];

  const candidateLists = [
    validationData?.validationResponse?.errorList,
    validationData?.validationResponse?.errors,
    validationData?.errors,
  ].filter(Boolean);

  const list = candidateLists.find((v) => Array.isArray(v)) ?? [];

  return list
    .filter((e) => e && typeof e === "object")
    .map((e) => ({
      rowNo: e.rowNo ?? e.row_no ?? e.row ?? null,
      fieldName: e.fieldName ?? e.field_name ?? e.field ?? null,
      errorMessage: e.errorMessage ?? e.error_message ?? e.message ?? null,
    }))
    .filter((e) => e.errorMessage);
};

exports.uploadInvoice = async (req, res) => {
  try {
    if (!req.user?.companyId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Debug: Log req.file
    console.log("req.file:", req.file);

    if (!req.file?.path) {
      return res.status(400).json({ message: "Excel file is required" });
    }

    // Debug: Log file path
    console.log("File path:", req.file.path);

    // Check if file exists before parsing
    if (!fs.existsSync(req.file.path)) {
      return res.status(400).json({ error: "File not found after upload" });
    }

    const filePath = req.file.path;

    console.log("FILE PATH:", filePath);

    const data = parseExcel(filePath);

    console.log("PARSED DATA:", data);
    console.log("DATA LENGTH:", data.length);

    const invoice = transformToFBR(data);

    console.log("TRANSFORMED INVOICE:", invoice);

    await pool.query(
      "INSERT INTO uploads (company_id, file_name, file_path) VALUES ($1,$2,$3)",
      [req.user.companyId, req.file.originalname ?? req.file.filename ?? null, req.file.path]
    );

    const companyResult = await pool.query(
      "SELECT id, api_token FROM companies WHERE id=$1",
      [req.user.companyId]
    );

    const company = companyResult.rows[0];
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    if (!company.api_token) {
      return res.status(400).json({ message: "Company API token is not configured" });
    }

    const invoiceRefNo =
      invoice?.invoices?.[0]?.invoiceRefNo ??
      invoice?.invoiceRefNo ??
      invoice?.invoice_ref_no ??
      null;

    const invoiceInsert = await pool.query(
      "INSERT INTO invoices (company_id, invoice_ref_no, invoice_data, status) VALUES ($1,$2,$3,$4) RETURNING id",
      [req.user.companyId, invoiceRefNo, JSON.stringify(invoice), "pending"]
    );
    const invoiceId = invoiceInsert.rows[0]?.id;

    console.log("VALIDATING INVOICE:", JSON.stringify(invoice, null, 2));
    console.log("INVOICES ARRAY:", invoice?.invoices);
    console.log("FIRST INVOICE:", invoice?.invoices?.[0]);

    const localErrors = validateTransformedPayload(invoice);
    console.log("VALIDATION ERRORS:", localErrors);

    // Determine status based on validation
    let status = "validated";
    if (localErrors.length > 0) {
      status = "failed";
    }

    // Save validation errors if any
    if (invoiceId && localErrors.length > 0) {
      for (const e of localErrors) {
        await pool.query(
          "INSERT INTO validation_errors (invoice_id, row_no, field_name, error_message) VALUES ($1,$2,$3,$4)",
          [invoiceId, e.rowNo, e.fieldName, e.errorMessage]
        );
      }
    }

    // Update invoice status
    if (invoiceId) {
      await pool.query("UPDATE invoices SET status=$1 WHERE id=$2", [status, invoiceId]);
    }

    // Return if validation failed
    if (localErrors.length > 0) {
      return res.status(422).json({
        message: "Local validation failed",
        invoiceId,
        status: "failed",
        errors: localErrors,
      });
    }

    let validation;
    try {
      validation = await validateInvoice(invoice, company.api_token, {
        companyId: req.user.companyId,
      });
    } catch (err) {
      if (err.response?.status === 401) {
        return res.status(401).json({
          message: "FBR API authentication failed",
          error: "Invalid or expired API token. Please update your company API token.",
          invoiceId,
        });
      }
      throw err;
    }

    if (validation?.data?.validationResponse?.status === "Invalid") {
      const errors = extractValidationErrors(validation.data);

      if (invoiceId && errors.length) {
        for (const e of errors) {
          await pool.query(
            "INSERT INTO validation_errors (invoice_id, row_no, field_name, error_message) VALUES ($1,$2,$3,$4)",
            [invoiceId, e.rowNo, e.fieldName, e.errorMessage]
          );
        }
      }

      if (invoiceId) {
        await pool.query("UPDATE invoices SET status=$1 WHERE id=$2", ["failed", invoiceId]);
      }

      return res.status(422).json({
        invoiceId,
        status: "failed",
        validation: validation.data,
      });
    }

    const result = await postInvoice(invoice, company.api_token, {
      companyId: req.user.companyId,
    });

    if (invoiceId) {
      await pool.query(
        "UPDATE invoices SET status=$1, fbr_invoice_number=$2 WHERE id=$3",
        ["sent", result?.data?.invoiceNumber ?? null, invoiceId]
      );
    }

    return res.json({
      message: "Invoice sent",
      invoiceId,
      status: "sent",
      fbr: result.data,
    });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    console.error("ERROR MESSAGE:", err.message);
    console.error("ERROR STACK:", err.stack);
    return res.status(500).json({
      message: "Failed to process invoice upload",
      error: err.message,
      stack: err.stack,
    });
  }
};

exports.getInvoiceHistory = async (req, res) => {
  try {
    if (!req.user?.companyId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const result = await pool.query(
      "SELECT id, invoice_ref_no, fbr_invoice_number, status, created_at FROM invoices WHERE company_id=$1 ORDER BY created_at DESC",
      [req.user.companyId]
    );

    return res.json({ invoices: result.rows });
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch invoice history" });
  }
};

exports.getInvoiceById = async (req, res) => {
  try {
    if (!req.user?.companyId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid invoice id" });
    }

    const invoiceResult = await pool.query(
      "SELECT id, company_id, invoice_ref_no, invoice_data, fbr_invoice_number, status, created_at FROM invoices WHERE id=$1 AND company_id=$2",
      [id, req.user.companyId]
    );

    const invoice = invoiceResult.rows[0];
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const errorsResult = await pool.query(
      "SELECT id, row_no, field_name, error_message, created_at FROM validation_errors WHERE invoice_id=$1 ORDER BY id ASC",
      [id]
    );

    return res.json({
      invoice,
      errors: errorsResult.rows,
      validation_errors: errorsResult.rows,
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch invoice" });
  }
};

exports.sendInvoiceToFBR = async (req, res) => {
  try {
    if (!req.user?.companyId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid invoice id" });
    }

    const invoiceResult = await pool.query(
      "SELECT id, invoice_data, status, fbr_invoice_number FROM invoices WHERE id=$1 AND company_id=$2",
      [id, req.user.companyId]
    );

    const invoiceRow = invoiceResult.rows[0];
    if (!invoiceRow) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    if (invoiceRow.status === "sent") {
      return res.status(409).json({
        message: "Invoice already sent",
        fbr_invoice_number: invoiceRow.fbr_invoice_number ?? null,
      });
    }

    const companyResult = await pool.query(
      "SELECT id, api_token FROM companies WHERE id=$1",
      [req.user.companyId]
    );

    const company = companyResult.rows[0];
    if (!company?.api_token) {
      return res.status(400).json({ message: "Company API token is not configured" });
    }

    let payload = invoiceRow.invoice_data;

    // Parse if stored as string
    if (typeof payload === "string") {
      payload = JSON.parse(payload);
    }

    console.log("Fetched Data:", payload);
    console.log("Payload Type:", typeof payload);
    console.log("Is Array:", Array.isArray(payload));
    console.log("Has invoices:", payload?.invoices ? "yes" : "no");

    const localErrors = validateTransformedPayload(payload);
    if (localErrors.length) {
      for (const e of localErrors) {
        await pool.query(
          "INSERT INTO validation_errors (invoice_id, row_no, field_name, error_message) VALUES ($1,$2,$3,$4)",
          [id, e.rowNo, e.fieldName, e.errorMessage]
        );
      }

      await pool.query("UPDATE invoices SET status=$1 WHERE id=$2 AND company_id=$3", ["failed", id, req.user.companyId]);

      return res.status(422).json({ message: "Local validation failed", errors: localErrors });
    }

    const validation = await validateInvoice(payload, company.api_token, {
      companyId: req.user.companyId,
    });

    if (validation?.data?.validationResponse?.status === "Invalid") {
      const errors = extractValidationErrors(validation.data);
      if (errors.length) {
        for (const e of errors) {
          await pool.query(
            "INSERT INTO validation_errors (invoice_id, row_no, field_name, error_message) VALUES ($1,$2,$3,$4)",
            [id, e.rowNo, e.fieldName, e.errorMessage]
          );
        }
      }

      await pool.query("UPDATE invoices SET status=$1 WHERE id=$2 AND company_id=$3", ["failed", id, req.user.companyId]);

      return res.status(422).json(validation.data);
    }

    const result = await postInvoice(payload, company.api_token, {
      companyId: req.user.companyId,
    });

    await pool.query(
      "UPDATE invoices SET status=$1, fbr_invoice_number=$2 WHERE id=$3 AND company_id=$4",
      ["sent", result?.data?.invoiceNumber ?? null, id, req.user.companyId]
    );

    return res.json(result.data);
  } catch (err) {
    return res.status(500).json({ message: "Failed to send invoice to FBR" });
  }
};