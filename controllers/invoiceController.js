const pool = require("../config/db");
const { parseExcel } = require("../services/excelService");
const { validateInvoice, postInvoice } = require("../services/fbrService");

exports.uploadInvoice = async (req, res) => {
  const data = parseExcel(req.file.path);

  // Transform to FBR JSON (you already have logic)
  const invoice = transformToFBR(data);

  // Get company token
  const company = await pool.query(
    "SELECT * FROM companies WHERE id=$1",
    [req.user.companyId]
  );

  const token = company.rows[0].api_token;

  // Validate
  const validation = await validateInvoice(invoice, token);

  if (validation.data.validationResponse.status === "Invalid") {
    return res.json(validation.data);
  }

  // Send to FBR
  const result = await postInvoice(invoice, token);

  // Save in DB
  await pool.query(
    "INSERT INTO invoices (company_id, invoice_data, status, fbr_invoice_number) VALUES ($1,$2,$3,$4)",
    [
      req.user.companyId,
      invoice,
      "sent",
      result.data.invoiceNumber,
    ]
  );

  res.json(result.data);
};