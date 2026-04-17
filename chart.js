const IDENT = "LH";
let energyChart;
let tempChart;

const elementIds = {
  copValue: "copValue",
  eerValue: "eerValue",
  coolingValue: "coolingValue",
  heatValue: "heatValue",
  electricValue: "electricValue",
  poolValue: "poolValue",
  r1Value: "r1Value",
  r2Value: "r2Value",
  tTankValue: "tTankValue",
  tPoolValue: "tPoolValue",
  tHeatingValue: "tHeatingValue",
  tBioValue: "tBioValue",
  tBio2Value: "tBio2Value",
  lastUpdated: "lastUpdated",
  energyChart: "energyChart",
  tempChart: "tempChart",
  noDataMessage: "noDataMessage",
  copCard: "copCard",
  eerCard: "eerCard",
  heatCard: "heatCard",
};

document.addEventListener("DOMContentLoaded", () => {
  initializeDateInputs();
  document.getElementById("refreshButton").addEventListener("click", () => loadData());
  loadData();
});

async function loadData() {
  const { start, end } = getFilterValues();
  showLoadingState(true);

  try {
    const raw = await fetchData(start, end);
    const normalized = normalizeData(raw);
    const latest = normalized[normalized.length - 1];

    renderEnergyChart(normalized);
    renderTempChart(normalized);
    updateStats(latest);
    toggleNoData(normalized.length === 0);
  } catch (err) {
    console.error("Fehler beim Laden der Daten:", err);
    toggleNoData(true);
  } finally {
    showLoadingState(false);
  }
}

function initializeDateInputs() {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setHours(endDate.getHours() - 24);
  document.getElementById("startDateTime").value = formatDateTimeLocal(startDate);
  document.getElementById("endDateTime").value = formatDateTimeLocal(endDate);
}

function showLoadingState(isLoading) {
  const button = document.getElementById("refreshButton");
  button.textContent = isLoading ? "Lädt…" : "Aktualisieren";
  button.disabled = isLoading;
}

function getFilterValues() {
  const start = document.getElementById("startDateTime").value;
  const end = document.getElementById("endDateTime").value;
  return { start, end };
}

async function fetchData(start, end) {
  const startIso = toIsoOrFallback(start, true);
  const endIso = toIsoOrFallback(end, false);
  const params = new URLSearchParams({
    ident: IDENT,
    start: startIso,
    end: endIso,
  });
  const res = await fetch(`/.netlify/functions/data?${params.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API-Fehler (${res.status}): ${text}`);
  }
  return res.json();
}

function normalizeData(data) {
  const normalized = data
    .map((item) => {
      const time = parseTimestamp(item);
      const copValues = filterPositive([item.COP_1, item.COP_2]);
      const eerValues = filterPositive([item.EER_1, item.EER_2]);
      const pWpCool = sumFields(item, ["P_cool_1", "P_cool_2"]);
      const pWpHeat = sumFields(item, ["P_heat_1", "P_heat_2"]);
      const pWpEl = sumFields(item, ["P_el_1", "P_el_2"]);

      return {
        time,
        COP: copValues.length ? average(copValues) : null,
        EER: eerValues.length ? average(eerValues) : null,
        P_Heat: toNumber(item.P_Heat),
        P_Pool: toNumber(item.P_Pool),
        P_WP_cool: pWpCool,
        P_WP_el: pWpEl,
        P_WP_heat: pWpHeat,
        P_R1: sumFields(item, ["P_lat_A", "P_sen_B", "P_lat_C", "P_sen_D"]),
        P_R2: sumFields(item, ["P_lat_A_R2", "P_lat_C_R2", "P_sen_B_R2", "P_sen_D_R2"]),
        T_2000l_top: toNumber(item.T_2000l_top),
        T_VL_pool: toNumber(item.T_VL_Pool),
        T_VL_heating: toNumber(item.T_VL_heating),
        T_max_BIO: toNumber(item.T_max_BIO),
        T_max_BIO_R2: toNumber(item.T_max_BIO_R2),
      };
    })
    .filter((entry) => entry.time)
    .sort((a, b) => a.time - b.time);

  return normalized;
}

function parseTimestamp(item) {
  if (item.ts) {
    return new Date(item.ts);
  }
  if (item.server && item.server.timestamp) {
    return new Date(item.server.timestamp * 1000);
  }
  if (item.timestamp) {
    return new Date(item.timestamp * 1000);
  }
  return null;
}

function filterPositive(values) {
  return values
    .map((value) => toNumber(value))
    .filter((num) => num > 0);
}

function sumFields(item, keys) {
  return keys.reduce((acc, key) => acc + toNumber(item[key]), 0);
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

function renderEnergyChart(data) {
  const ctx = document.getElementById(elementIds.energyChart).getContext("2d");
  const datasetConfig = [
    { key: "P_Heat", label: "P_Heat", color: "#22d3ee" },
    { key: "P_Pool", label: "P_Pool", color: "#a855f7" },
    { key: "P_WP_cool", label: "P_WP_cool", color: "#fb7185" },
    { key: "P_WP_el", label: "P_WP_el", color: "#facc15" },
    { key: "P_WP_heat", label: "P_WP_heat", color: "#10b981" },
    { key: "P_R1", label: "P_R1", color: "#f97316" },
    { key: "P_R2", label: "P_R2", color: "#c084fc" },
  ];

  const datasets = datasetConfig.map(({ key, label, color }) => ({
    label,
    borderColor: color,
    backgroundColor: color,
    data: data.map((point) => ({ x: point.time, y: point[key] })),
    fill: false,
    tension: 0.25,
    pointRadius: 1.5,
    borderWidth: 2,
  }));

  if (energyChart) {
    energyChart.destroy();
  }

  energyChart = new Chart(ctx, {
    type: "line",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: "index",
      },
      scales: {
        x: {
          type: "time",
          time: {
            unit: "hour",
            tooltipFormat: "dd.MM. HH:mm",
          },
          title: { display: true, text: "Zeit" },
          ticks: { color: "#cbd5f5" },
          grid: { color: "rgba(255,255,255,0.08)" },
        },
        y: {
          title: { display: true, text: "Leistung (kW)" },
          ticks: { color: "#cbd5f5" },
          grid: { color: "rgba(255,255,255,0.08)" },
        },
      },
      plugins: {
        legend: { position: "top", labels: { color: "#e2e8f0" } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)} kW` } },
      },
    },
  });
}

function renderTempChart(data) {
  const ctx = document.getElementById(elementIds.tempChart).getContext("2d");
  const temps = [
    { key: "T_2000l_top", label: "T_2000l_top", color: "#22d3ee" },
    { key: "T_VL_pool", label: "T_VL_pool", color: "#a855f7" },
    { key: "T_VL_heating", label: "T_VL_heating", color: "#f97316" },
    { key: "T_max_BIO", label: "T_max_BIO", color: "#facc15" },
    { key: "T_max_BIO_R2", label: "T_max_BIO_R2", color: "#34d399" },
  ];

  const datasets = temps.map(({ key, label, color }) => ({
    label,
    borderColor: color,
    backgroundColor: color,
    data: data.map((point) => ({ x: point.time, y: point[key] })),
    fill: false,
    tension: 0.25,
    pointRadius: 2,
    borderWidth: 2,
  }));

  if (tempChart) {
    tempChart.destroy();
  }

  tempChart = new Chart(ctx, {
    type: "line",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "nearest",
        intersect: false,
      },
      scales: {
        x: {
          type: "time",
          time: {
            tooltipFormat: "dd.MM. HH:mm",
          },
          ticks: { color: "#cbd5f5" },
          grid: { color: "rgba(255,255,255,0.08)" },
        },
        y: {
          title: { display: true, text: "Temperatur (°C)" },
          ticks: { color: "#cbd5f5" },
          grid: { color: "rgba(255,255,255,0.08)" },
        },
      },
      plugins: {
        legend: { position: "top", labels: { color: "#e2e8f0" } },
      },
    },
  });
}

function updateStats(latest) {
  const noData = !latest;
  const copCard = document.getElementById(elementIds.copCard);
  const eerCard = document.getElementById(elementIds.eerCard);
  const heatCard = document.getElementById(elementIds.heatCard);

  setText(elementIds.lastUpdated, latest ? formatTime(latest.time) : "–");
  setText(elementIds.copValue, latest && latest.COP ? formatDecimal(latest.COP) : "–");
  setText(elementIds.eerValue, latest && latest.EER ? formatDecimal(latest.EER) : "–");
  setText(elementIds.coolingValue, latest ? formatDelta(latest.P_WP_cool) : "–");
  setText(elementIds.heatValue, latest ? formatDelta(latest.P_WP_heat) : "–");
  setText(elementIds.electricValue, latest ? formatDelta(latest.P_WP_el) : "–");
  setText(elementIds.poolValue, latest ? formatPower(latest.P_Pool) : "–");
  setText(elementIds.r1Value, latest ? formatPower(latest.P_R1) : "–");
  setText(elementIds.r2Value, latest ? formatPower(latest.P_R2) : "–");
  setText(elementIds.tTankValue, latest ? formatTemperature(latest.T_2000l_top) : "–");
  setText(elementIds.tPoolValue, latest ? formatTemperature(latest.T_VL_pool) : "–");
  setText(elementIds.tHeatingValue, latest ? formatTemperature(latest.T_VL_heating) : "–");
  setText(elementIds.tBioValue, latest ? formatTemperature(latest.T_max_BIO) : "–");
  setText(elementIds.tBio2Value, latest ? formatTemperature(latest.T_max_BIO_R2) : "–");

  const coolingActive = latest && latest.P_WP_cool > 0;
  copCard.classList.toggle("hidden", coolingActive || noData);
  eerCard.classList.toggle("hidden", !coolingActive || noData);
  heatCard.classList.toggle("hidden", coolingActive || noData);
}

function toggleNoData(show) {
  const element = document.getElementById(elementIds.noDataMessage);
  element.classList.toggle("hidden", !show);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
  }
}

function formatPower(value) {
  return `${formatDelta(value)} kW`;
}

function formatDelta(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "–";
  return (num >= 0 ? "+" : "") + num.toFixed(1);
}

function formatTemperature(value) {
  const num = Number(value);
  return Number.isFinite(num) ? `${num.toFixed(1)} °C` : "–";
}

function formatDecimal(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(2) : "–";
}

function formatTime(date) {
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function formatDateTimeLocal(date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function toIsoOrFallback(value, isStart) {
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    if (isStart) {
      parsed.setSeconds(0, 0);
    } else {
      parsed.setSeconds(59, 999);
    }
    return parsed.toISOString();
  }
  return value;
}
