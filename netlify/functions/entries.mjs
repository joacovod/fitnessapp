import { getStore } from "@netlify/blobs";

const STORE_NAME = "ritmo";
const BLOB_KEY = "entries.json";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-Ritmo-Key",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Content-Type": "application/json"
};

function json(statusCode, payload) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(payload)
  };
}

function sanitizeEntry(entry) {
  const date = String(entry?.date || "");
  const weight = Number(entry?.weight);
  const fasting = Number(entry?.fasting || 0);
  const note = String(entry?.note || "").slice(0, 160);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!Number.isFinite(weight) || weight <= 0 || weight > 300) return null;
  if (!Number.isFinite(fasting) || fasting < 0 || fasting > 48) return null;

  return { date, weight, fasting, note };
}

function sanitizeEntries(entries) {
  const byDate = new Map();
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const clean = sanitizeEntry(entry);
    if (clean) byDate.set(clean.date, clean);
  });
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function isAuthorized(event) {
  const expectedKey = process.env.RITMO_SYNC_KEY;
  const providedKey = event.headers["x-ritmo-key"] || event.headers["X-Ritmo-Key"];

  if (!expectedKey) return { ok: false, status: 500, message: "Falta configurar RITMO_SYNC_KEY en Netlify." };
  if (providedKey !== expectedKey) return { ok: false, status: 401, message: "Clave de sincronizacion incorrecta." };
  return { ok: true };
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  const auth = isAuthorized(event);
  if (!auth.ok) return json(auth.status, { message: auth.message });

  const store = getStore(STORE_NAME);

  if (event.httpMethod === "GET") {
    const saved = await store.get(BLOB_KEY, { type: "json" });
    return json(200, { entries: sanitizeEntries(saved?.entries), updatedAt: saved?.updatedAt || null });
  }

  if (event.httpMethod === "PUT") {
    const body = JSON.parse(event.body || "{}");
    const entries = sanitizeEntries(body.entries);
    const payload = { entries, updatedAt: new Date().toISOString() };
    await store.setJSON(BLOB_KEY, payload);
    return json(200, payload);
  }

  return json(405, { message: "Metodo no permitido." });
}
