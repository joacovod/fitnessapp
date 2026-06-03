import { getStore } from "@netlify/blobs";

const STORE_NAME = "ritmo";
const BLOB_KEY = "entries.json";

const baseHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-Ritmo-Key",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Content-Type": "application/json"
};

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: baseHeaders
  });
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

function authorize(request) {
  const expectedKey = process.env.RITMO_SYNC_KEY;
  const providedKey = request.headers.get("X-Ritmo-Key");

  if (!expectedKey) {
    return { ok: false, status: 500, message: "Falta configurar RITMO_SYNC_KEY en Netlify." };
  }

  if (providedKey !== expectedKey) {
    return { ok: false, status: 401, message: "Clave de sincronizacion incorrecta." };
  }

  return { ok: true };
}

export default async function handler(request) {
  if (request.method === "OPTIONS") {
    return new Response("", { status: 204, headers: baseHeaders });
  }

  const auth = authorize(request);
  if (!auth.ok) return json(auth.status, { message: auth.message });

  let store;
  try {
    store = getStore({ name: STORE_NAME, consistency: "strong" });
  } catch (error) {
    return json(500, {
      message: "Netlify Blobs no esta disponible para esta Function. Revisa que el deploy venga desde GitHub y vuelve a desplegar.",
      detail: error?.name || "BlobsError"
    });
  }

  if (request.method === "GET") {
    const saved = await store.get(BLOB_KEY, { type: "json", consistency: "strong" });
    return json(200, { entries: sanitizeEntries(saved?.entries), updatedAt: saved?.updatedAt || null });
  }

  if (request.method === "PUT") {
    const body = await request.json().catch(() => ({}));
    const entries = sanitizeEntries(body.entries);
    const payload = { entries, updatedAt: new Date().toISOString() };
    await store.setJSON(BLOB_KEY, payload);
    return json(200, payload);
  }

  return json(405, { message: "Metodo no permitido." });
}
