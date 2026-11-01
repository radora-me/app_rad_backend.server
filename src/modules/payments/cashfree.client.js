const axios = require("axios");

const API_VERSION = process.env.CASHFREE_API_VERSION || "2025-01-01";

function getConfig() {
  const environment = String(process.env.CASHFREE_ENVIRONMENT || "sandbox").toLowerCase();
  const clientId = process.env.CASHFREE_CLIENT_ID;
  const clientSecret = process.env.CASHFREE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Cashfree is not configured. Set CASHFREE_CLIENT_ID and CASHFREE_CLIENT_SECRET.");
  }
  return {
    baseUrl: environment === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg",
    clientId,
    clientSecret,
    environment,
  };
}

async function request(method, path, data, idempotencyKey) {
  const config = getConfig();
  const response = await axios({
    method,
    url: `${config.baseUrl}${path}`,
    data,
    timeout: 12_000,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-client-id": config.clientId,
      "x-client-secret": config.clientSecret,
      "x-api-version": API_VERSION,
      "x-request-id": `radora-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      ...(idempotencyKey ? { "x-idempotency-key": idempotencyKey } : {}),
    },
  });
  return response.data;
}

async function createOrder({ orderId, amount, customer, returnUrl, notifyUrl }) {
  return request("POST", "/orders", {
    order_id: orderId,
    order_amount: Number(amount).toFixed(2),
    order_currency: "INR",
    customer_details: {
      customer_id: customer.id,
      customer_name: customer.name,
      customer_email: customer.email,
      customer_phone: customer.phone,
    },
    order_meta: { return_url: returnUrl, notify_url: notifyUrl },
    order_note: "Radora student fee payment",
  }, orderId);
}

async function fetchOrder(orderId) {
  return request("GET", `/orders/${encodeURIComponent(orderId)}`);
}

async function fetchPayments(orderId) {
  return request("GET", `/orders/${encodeURIComponent(orderId)}/payments`);
}

module.exports = { createOrder, fetchOrder, fetchPayments, getConfig };
