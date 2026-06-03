const STORAGE_KEY = "ritmo.entries.v1";
const SYNC_KEY_STORAGE = "ritmo.syncKey.v1";
const API_URL = "/.netlify/functions/entries";
const state = {
  entries: [],
  range: 14,
  syncKey: "",
  isSyncing: false,
  deferredInstallPrompt: null
};

const els = {
  form: document.querySelector("#entryForm"),
  date: document.querySelector("#dateInput"),
  weight: document.querySelector("#weightInput"),
  fasting: document.querySelector("#fastingInput"),
  note: document.querySelector("#noteInput"),
  todayDate: document.querySelector("#todayDate"),
  streakText: document.querySelector("#streakText"),
  avgWeight: document.querySelector("#avgWeight"),
  weightChange: document.querySelector("#weightChange"),
  avgFasting: document.querySelector("#avgFasting"),
  chart: document.querySelector("#trendChart"),
  insight: document.querySelector("#insightText"),
  historyList: document.querySelector("#historyList"),
  template: document.querySelector("#historyItemTemplate"),
  exportButton: document.querySelector("#exportButton"),
  syncButton: document.querySelector("#syncButton"),
  resetSyncButton: document.querySelector("#resetSyncButton"),
  syncStatus: document.querySelector("#syncStatus"),
  installButton: document.querySelector("#installButton"),
  rangeButtons: document.querySelectorAll(".range-button")
};

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long"
});

const shortDateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short"
});

function todayKey() {
  return dateKeyFromDate(new Date());
}

function dateKeyFromDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
}

function mergeEntries(localEntries, remoteEntries) {
  const byDate = new Map();
  [...localEntries, ...remoteEntries].forEach((entry) => {
    if (!entry?.date) return;
    byDate.set(entry.date, entry);
  });
  return sortEntries([...byDate.values()]);
}

function sortEntries(entries) {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date));
}

function average(values) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return null;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function formatKg(value) {
  return value === null ? "--" : `${value.toFixed(1)} kg`;
}

function formatHours(value) {
  return value === null ? "--" : `${value.toFixed(1)} h`;
}

function parseDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getRecentEntries(days) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days + 1);
  return sortEntries(state.entries).filter((entry) => parseDate(entry.date) >= start);
}

function calculateStreak() {
  const dates = new Set(state.entries.map((entry) => entry.date));
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  while (dates.has(dateKeyFromDate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function selectedDateKey() {
  return els.date.value || todayKey();
}

function prefillSelectedDate() {
  const current = state.entries.find((entry) => entry.date === selectedDateKey());
  els.weight.value = current?.weight ?? "";
  els.fasting.value = current?.fasting ?? "";
  els.note.value = current?.note ?? "";
}

function renderToday() {
  const now = new Date();
  const readableDate = dateFormatter.format(now);
  els.todayDate.textContent = readableDate.charAt(0).toUpperCase() + readableDate.slice(1);

  const streak = calculateStreak();
  if (streak === 0) {
    els.streakText.textContent = "Hoy puede ser el primer punto de una serie interesante.";
  } else if (streak === 1) {
    els.streakText.textContent = "Ya tenés el registro de hoy. Bien ahí.";
  } else {
    els.streakText.textContent = `Racha activa: ${streak} mañanas seguidas.`;
  }
}

function renderStats() {
  const last7 = getRecentEntries(7);
  const last30 = getRecentEntries(30);
  const ordered = sortEntries(last30);
  const avg7Weight = average(last7.map((entry) => entry.weight));
  const avg7Fasting = average(last7.map((entry) => entry.fasting));

  els.avgWeight.textContent = formatKg(avg7Weight);
  els.avgFasting.textContent = formatHours(avg7Fasting);

  if (ordered.length >= 2) {
    const diff = ordered.at(-1).weight - ordered[0].weight;
    const sign = diff > 0 ? "+" : "";
    els.weightChange.textContent = `${sign}${diff.toFixed(1)} kg`;
  } else {
    els.weightChange.textContent = "--";
  }
}

function drawChart() {
  const canvas = els.chart;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const data = getRecentEntries(state.range);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const padding = { top: 34, right: 42, bottom: 48, left: 52 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  ctx.strokeStyle = "rgba(21, 32, 31, 0.09)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = padding.top + (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  if (data.length < 2) {
    ctx.fillStyle = "#68706e";
    ctx.font = "700 22px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Necesitás al menos 2 registros", width / 2, height / 2 - 8);
    ctx.font = "600 15px system-ui";
    ctx.fillText("Después aparece la tendencia de peso y ayuno.", width / 2, height / 2 + 22);
    return;
  }

  const weights = data.map((entry) => entry.weight);
  const minWeight = Math.min(...weights) - 0.4;
  const maxWeight = Math.max(...weights) + 0.4;
  const weightSpan = Math.max(maxWeight - minWeight, 1);
  const maxFast = Math.max(24, ...data.map((entry) => entry.fasting || 0));

  const xFor = (index) => padding.left + (chartWidth / Math.max(data.length - 1, 1)) * index;
  const yForWeight = (weight) => padding.top + chartHeight - ((weight - minWeight) / weightSpan) * chartHeight;
  const yForFast = (fasting) => padding.top + chartHeight - ((fasting || 0) / maxFast) * chartHeight;

  ctx.strokeStyle = "#18a999";
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  data.forEach((entry, index) => {
    const x = xFor(index);
    const y = yForWeight(entry.weight);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.strokeStyle = "#ff6b57";
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  data.forEach((entry, index) => {
    const x = xFor(index);
    const y = yForFast(entry.fasting);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.setLineDash([]);

  data.forEach((entry, index) => {
    const x = xFor(index);
    const y = yForWeight(entry.weight);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#08796e";
    ctx.lineWidth = 3;
    ctx.stroke();
  });

  ctx.fillStyle = "#15201f";
  ctx.font = "800 14px system-ui";
  ctx.textAlign = "left";
  ctx.fillText("Peso", padding.left, 22);
  ctx.fillStyle = "#ff6b57";
  ctx.fillText("Ayuno", padding.left + 58, 22);

  ctx.fillStyle = "#68706e";
  ctx.font = "650 12px system-ui";
  ctx.textAlign = "center";
  [0, Math.floor(data.length / 2), data.length - 1].forEach((index) => {
    const label = shortDateFormatter.format(parseDate(data[index].date));
    ctx.fillText(label, xFor(index), height - 18);
  });
}

function renderInsight() {
  const data = getRecentEntries(state.range);
  if (data.length < 2) {
    els.insight.textContent = "Agregá algunos registros para ver patrones.";
    return;
  }

  const first = data[0];
  const last = data.at(-1);
  const diff = last.weight - first.weight;
  const avgFast = average(data.map((entry) => entry.fasting));
  const direction = diff < -0.2 ? "bajó" : diff > 0.2 ? "subió" : "se mantuvo bastante estable";
  const amount = Math.abs(diff).toFixed(1);
  els.insight.textContent = `En los últimos ${state.range} días el peso ${direction}${Math.abs(diff) > 0.2 ? ` ${amount} kg` : ""}. Ayuno promedio: ${formatHours(avgFast)}.`;
}

function renderHistory() {
  const newestFirst = sortEntries(state.entries).reverse();
  els.historyList.innerHTML = "";

  if (!newestFirst.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Todavía no hay registros guardados.";
    els.historyList.append(empty);
    return;
  }

  newestFirst.forEach((entry) => {
    const item = els.template.content.firstElementChild.cloneNode(true);
    item.querySelector(".history-date").textContent = shortDateFormatter.format(parseDate(entry.date));
    item.querySelector(".history-note").textContent = entry.note || "Sin nota";
    item.querySelector(".history-weight").textContent = `${entry.weight.toFixed(1)} kg`;
    item.querySelector(".history-fast").textContent = `${entry.fasting.toFixed(1)} h`;
    item.querySelector(".delete-button").addEventListener("click", () => {
      state.entries = state.entries.filter((saved) => saved.date !== entry.date);
      saveEntries();
      pushToNetlify({ silent: true });
      render();
      prefillSelectedDate();
    });
    els.historyList.append(item);
  });
}

function render() {
  renderToday();
  renderStats();
  drawChart();
  renderInsight();
  renderHistory();
}

function upsertEntry(entry) {
  const existingIndex = state.entries.findIndex((saved) => saved.date === entry.date);
  if (existingIndex >= 0) {
    state.entries[existingIndex] = entry;
  } else {
    state.entries.push(entry);
  }
  state.entries = sortEntries(state.entries);
  saveEntries();
}

function setSyncStatus(message) {
  els.syncStatus.textContent = message;
}

function getSyncKey({ forcePrompt = false } = {}) {
  if (!forcePrompt && state.syncKey) return state.syncKey;
  const key = window.prompt("Ingresá tu clave privada de sincronización de Netlify:");
  if (!key) return "";
  state.syncKey = key.trim();
  localStorage.setItem(SYNC_KEY_STORAGE, state.syncKey);
  return state.syncKey;
}

async function requestNetlify(method, body) {
  const syncKey = getSyncKey();
  if (!syncKey) throw new Error("Falta la clave de sincronización.");

  const response = await fetch(API_URL, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Ritmo-Key": syncKey
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "No se pudo sincronizar con Netlify.");
  }

  return response.json();
}

async function syncToNetlify({ silent = false } = {}) {
  if (state.isSyncing) return;
  if (!state.syncKey && silent) return;

  state.isSyncing = true;
  if (!silent) setSyncStatus("Sincronizando...");

  try {
    const remote = await requestNetlify("GET");
    state.entries = mergeEntries(state.entries, remote.entries || []);
    saveEntries();
    await requestNetlify("PUT", { entries: state.entries });
    render();
    prefillSelectedDate();
    setSyncStatus(`Sincronizado: ${state.entries.length} registros guardados en Netlify.`);
  } catch (error) {
    if (!silent) setSyncStatus(error.message);
  } finally {
    state.isSyncing = false;
  }
}

async function pushToNetlify({ silent = false } = {}) {
  if (state.isSyncing) return;
  if (!state.syncKey && silent) return;

  state.isSyncing = true;
  if (!silent) setSyncStatus("Guardando en Netlify...");

  try {
    await requestNetlify("PUT", { entries: state.entries });
    setSyncStatus(`Guardado en Netlify: ${state.entries.length} registros.`);
  } catch (error) {
    if (!silent) setSyncStatus(error.message);
  } finally {
    state.isSyncing = false;
  }
}

function exportCsv() {
  if (!state.entries.length) return;
  const header = ["fecha", "peso_kg", "ayuno_horas", "nota"];
  const rows = sortEntries(state.entries).map((entry) => [
    entry.date,
    entry.weight.toFixed(1),
    entry.fasting.toFixed(1),
    `"${(entry.note || "").replaceAll('"', '""')}"`
  ]);
  const csv = [header, ...rows].map((row) => row.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ritmo-${todayKey()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const weight = Number(els.weight.value);
  const fasting = Number(els.fasting.value || 0);
  const date = selectedDateKey();

  if (!date || !Number.isFinite(weight) || weight <= 0 || !Number.isFinite(fasting) || fasting < 0) {
    return;
  }

  upsertEntry({
    date,
    weight,
    fasting,
    note: els.note.value.trim()
  });
  pushToNetlify({ silent: true });
  render();
});

els.date.addEventListener("change", prefillSelectedDate);

els.rangeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.range = Number(button.dataset.range);
    els.rangeButtons.forEach((candidate) => candidate.classList.toggle("active", candidate === button));
    drawChart();
    renderInsight();
  });
});

els.exportButton.addEventListener("click", exportCsv);

els.syncButton.addEventListener("click", () => syncToNetlify());

els.resetSyncButton.addEventListener("click", () => {
  localStorage.removeItem(SYNC_KEY_STORAGE);
  state.syncKey = "";
  getSyncKey({ forcePrompt: true });
  if (state.syncKey) syncToNetlify();
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  state.deferredInstallPrompt = event;
  els.installButton.hidden = false;
});

els.installButton.addEventListener("click", async () => {
  if (!state.deferredInstallPrompt) return;
  state.deferredInstallPrompt.prompt();
  await state.deferredInstallPrompt.userChoice;
  state.deferredInstallPrompt = null;
  els.installButton.hidden = true;
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js");
  });
}

state.entries = readEntries();
state.syncKey = localStorage.getItem(SYNC_KEY_STORAGE) || "";
els.date.value = todayKey();
prefillSelectedDate();
render();
syncToNetlify({ silent: true });
