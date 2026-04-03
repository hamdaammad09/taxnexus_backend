const axios = require("axios");
const pool = require("../config/db");

const safeJson = (value) => {
  try {
    return value ?? null;
  } catch (_) {
    return null;
  }
};

const logApiCall = async ({ companyId, request, response, statusCode }) => {
  if (!companyId) return;
  try {
    await pool.query(
      "INSERT INTO api_logs (company_id, request, response, status_code) VALUES ($1,$2,$3,$4)",
      [companyId, safeJson(request), safeJson(response), statusCode ?? null]
    );
  } catch (_) {
    return;
  }
};

exports.sendToFBR = async (invoiceData, token, options = {}) => {
  const url = "https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata";
  try {
    const response = await axios.post(url, invoiceData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    await logApiCall({
      companyId: options.companyId,
      request: { url, method: "POST", body: invoiceData },
      response: response.data,
      statusCode: response.status,
    });

    return response.data;
  } catch (error) {
    const statusCode = error?.response?.status;
    const respData = error?.response?.data || error.message;

    await logApiCall({
      companyId: options.companyId,
      request: { url, method: "POST", body: invoiceData },
      response: respData,
      statusCode,
    });

    return { error: error.response?.data || error.message };
  }
};

exports.validateInvoice = async (data, token, options = {}) => {
  const url = "https://gw.fbr.gov.pk/di_data/v1/di/validateinvoicedata";
  try {
    const resp = await axios.post(url, data, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });

    await logApiCall({
      companyId: options.companyId,
      request: { url, method: "POST", body: data },
      response: resp.data,
      statusCode: resp.status,
    });
    return resp;
  } catch (err) {
    const statusCode = err?.response?.status;
    const respData = err?.response?.data;
    await logApiCall({
      companyId: options.companyId,
      request: { url, method: "POST", body: data },
      response: respData ?? { message: err?.message ?? "Request failed" },
      statusCode,
    });
    throw err;
  }
};

exports.postInvoice = async (data, token, options = {}) => {
  const url = "https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata";
  try {
    const resp = await axios.post(url, data, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });

    await logApiCall({
      companyId: options.companyId,
      request: { url, method: "POST", body: data },
      response: resp.data,
      statusCode: resp.status,
    });
    return resp;
  } catch (err) {
    const statusCode = err?.response?.status;
    const respData = err?.response?.data;
    await logApiCall({
      companyId: options.companyId,
      request: { url, method: "POST", body: data },
      response: respData ?? { message: err?.message ?? "Request failed" },
      statusCode,
    });
    throw err;
  }
};