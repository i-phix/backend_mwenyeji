// Safaricom Daraja (Lipa Na M-Pesa Online / STK Push) integration.
//
// Requires these env vars (see .env.example):
//   MPESA_ENV               "sandbox" | "production"
//   MPESA_CONSUMER_KEY
//   MPESA_CONSUMER_SECRET
//   MPESA_SHORTCODE         Till/Paybill number used as BusinessShortCode
//   MPESA_PASSKEY           Lipa Na M-Pesa Online passkey for that shortcode
//   MPESA_TRANSACTION_TYPE  "CustomerBuyGoodsOnline" (Till) or
//                           "CustomerPayBillOnline" (Paybill) — defaults to Till
//   MPESA_CALLBACK_URL      Public HTTPS URL Safaricom will POST the result to
//                           (must be reachable from the internet — not localhost)
//
// Until all of these are set, stkPush() throws a clear "not configured"
// error rather than failing with a confusing HTTP error, so the rest of
// Phase 3 (settings, disbursements, invoices) works even before Daraja
// credentials are dropped in.

const BASE_URLS = {
  sandbox: "https://sandbox.safaricom.co.ke",
  production: "https://api.safaricom.co.ke",
};

function isConfigured() {
  return !!(
    process.env.MPESA_CONSUMER_KEY &&
    process.env.MPESA_CONSUMER_SECRET &&
    process.env.MPESA_SHORTCODE &&
    process.env.MPESA_PASSKEY &&
    process.env.MPESA_CALLBACK_URL
  );
}

function getBaseUrl() {
  const env = (process.env.MPESA_ENV || "sandbox").toLowerCase();
  return BASE_URLS[env] || BASE_URLS.sandbox;
}

async function getAccessToken() {
  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  const auth = Buffer.from(`${key}:${secret}`).toString("base64");

  const res = await fetch(`${getBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`M-Pesa auth failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  return data.access_token;
}

// Normalizes 07xx/01xx/+2547xx/2547xx into 2547xxxxxxxx / 2541xxxxxxxx.
function normalizePhone(phone) {
  let digits = String(phone || "").replace(/\D+/g, "");
  if (digits.startsWith("0")) digits = "254" + digits.slice(1);
  if (digits.startsWith("7") || digits.startsWith("1")) digits = "254" + digits;
  return digits;
}

function timestampNow() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

// stkPush({ phone, amount, accountReference, transactionDesc })
// -> { checkoutRequestId, merchantRequestId, raw }
async function stkPush({ phone, amount, accountReference, transactionDesc }) {
  if (!isConfigured()) {
    throw new Error(
      "M-Pesa is not configured yet — set MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY and MPESA_CALLBACK_URL in .env",
    );
  }

  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;
  const timestamp = timestampNow();
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
  const transactionType = process.env.MPESA_TRANSACTION_TYPE || "CustomerBuyGoodsOnline";
  const msisdn = normalizePhone(phone);

  const token = await getAccessToken();

  const res = await fetch(`${getBaseUrl()}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: transactionType,
      Amount: Math.max(1, Math.round(Number(amount) || 0)),
      PartyA: msisdn,
      PartyB: shortcode,
      PhoneNumber: msisdn,
      CallBackURL: process.env.MPESA_CALLBACK_URL,
      AccountReference: String(accountReference).slice(0, 12),
      TransactionDesc: (transactionDesc || "Mwenyeji payment").slice(0, 13),
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.errorCode || data.ResponseCode !== "0") {
    const message = data.errorMessage || data.ResponseDescription || `STK push failed (${res.status})`;
    throw new Error(message);
  }

  return {
    checkoutRequestId: data.CheckoutRequestID,
    merchantRequestId: data.MerchantRequestID,
    raw: data,
  };
}

module.exports = { isConfigured, stkPush, normalizePhone };
