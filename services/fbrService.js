const axios = require("axios");

exports.validateInvoice = async (data, token) => {
  return axios.post(
    "https://gw.fbr.gov.pk/di_data/v1/di/validateinvoicedata",
    data,
    { headers: { Authorization: `Bearer ${token}` } }
  );
};

exports.postInvoice = async (data, token) => {
  return axios.post(
    "https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata",
    data,
    { headers: { Authorization: `Bearer ${token}` } }
  );
};