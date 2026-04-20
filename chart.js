const IDENT = "LH";
const WP_DIVISOR = 10;
const WP_SCALE_KEYS = new Set(["P_heat_1", "P_cool_1", "P_el_1", "P_heat_2", "P_cool_2", "P_el_2"]);
const COLORS = {
  wp: "#6b7280",
  wp2: "#38bdf8",
  r1: "#a3291b",
  r2: "#d4552f",
  air: "#1e3a8a",
  hotel: "#d4af37",
  pool: "#3b82f6",
  puffer: "#6b7280",
};

let energyChart;
let tempChart;

document.addEventListener("DOMContentLoaded", () => {
  initializeDateInputs();
  document.getElementById("refreshButton").addEventListener("click", loadData);
  loadData();
});

async function loadData() {
  const { start, end } = getFilterValues();
  setLoadingState(true);
  try {
    const raw = await fetchData(start, end);
    const normalized = normalizeData(raw);
    renderEnergyChart(normalized);
    renderTempChart(normalized);
    updateHighlights(normalized);
    toggleNoData(normalized.length === 0);
  } catch (err) {
    console.error("Fehler beim Laden der Historie:", err);
    toggleNoData(true);
  } finally {
    setLoadingState(false);
  }
}

function initializeDateInputs() {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
  document.getElementById("startDateTime").value = formatDateTimeLocal(startDate);
  document.getElementById("endDateTime").value = formatDateTimeLocal(endDate);
}

function getFilterValues() {
  return {
    start: document.getElementById("startDateTime").value,
    end: document.getElementById("endDateTime").value,
  };
}

function setLoadingState(isLoading) {
  const button = document.getElementById("refreshButton");
  button.textContent = isLoading ? "Laedt..." : "Aktualisieren";
  button.disabled = isLoading;
}

async function fetchData(start, end) {
  const startIso = toIsoOrFallback(start, true);
  const endIso = toIsoOrFallback(end, false);
  const params = new URLSearchParams({
    ident: IDENT,
    type: "value",
    start: startIso,
    end: endIso,
  });
  const res = await fetch(`/.netlify/functions/data?${params.toString()}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

function normalizeData(items) {
  return items
    .map((row) => {
      const time = parseTimestamp(row);
      if (!time) return null;

      const scaled = maybeScaleWpValues(row);
      const pWp1Heat = toNumber(scaled.P_heat_1);
      const pWp2Heat = toNumber(scaled.P_heat_2);
      const pWp1Cool = toNumber(scaled.P_cool_1);
      const pWp2Cool = toNumber(scaled.P_cool_2);
      const pWp1El = toNumber(scaled.P_el_1);
      const pWp2El = toNumber(scaled.P_el_2);

      const pWpHeat = pWp1Heat + pWp2Heat;
      const pWpCool = pWp1Cool + pWp2Cool;
      const pWpEl = pWp1El + pWp2El;
      const pR1 = sumFields(scaled, ["P_lat_A", "P_sen_B", "P_lat_C", "P_sen_D"]);
      const pR2 = sumFields(scaled, ["P_lat_A_R2", "P_lat_C_R2", "P_sen_B_R2", "P_sen_D_R2"]);
      const pL = pWpEl > 0 ? (pWpHeat + pWpCool - pR1 - pR2) : 0;
      const cop = averagePositive([scaled.COP_1, scaled.COP_2]);

      return {
        time,
        COP: cop,
        P_WP1: pWp1Heat + pWp1Cool,
        P_WP2: pWp2Heat + pWp2Cool,
        P_R1: pR1,
        P_R2: pR2,
        P_L: pL,
        T_VL_hotel: toNumber(scaled.T_VL_heating),
        T_VL_pool: toNumber(scaled.T_VL_Pool),
        T_puffer_2000l: toNumber(scaled.T_2000l_top),
        T_max_R1: toNumber(scaled.T_max_BIO),
        T_max_R2: toNumber(scaled.T_max_BIO_R2),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.time - b.time);
}

function maybeScaleWpValues(row) {
  const copy = { ...row };
  const maybeUnscaled = Math.max(
    Math.abs(toNumber(copy.P_heat_1)),
    Math.abs(toNumber(copy.P_heat_2)),
    Math.abs(toNumber(copy.P_el_1)),
    Math.abs(toNumber(copy.P_el_2))
  );
  if (maybeUnscaled > 120) {
    for (const key of WP_SCALE_KEYS) {
      if (key in copy) copy[key] = toNumber(copy[key]) / WP_DIVISOR;
    }
  }
  return copy;
}

function parseTimestamp(item) {
  const d = item?.ts ? new Date(item.ts) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

function renderEnergyChart(points) {
  const ctx = document.getElementById("energyChart").getContext("2d");
  const bounds = computeBounds(
    points.flatMap((p) => [p.P_WP1, p.P_WP2, p.P_R1, p.P_R2, p.P_L]),
    { includeZero: true, symmetric: true, absQ: 0.8 }
  );

  const datasets = [
    {
      type: "line",
      label: "Leistung Waermepumpe 1",
      data: points.map((p) => ({ x: p.time, y: p.P_WP1 })),
      borderColor: COLORS.wp,
      backgroundColor: "rgba(107,114,128,0.58)",
      fill: "origin",
      tension: 0.22,
      pointRadius: 0,
      borderWidth: 2,
      stack: "wp",
    },
    {
      type: "line",
      label: "Leistung Waermepumpe 2",
      data: points.map((p) => ({ x: p.time, y: p.P_WP2 })),
      borderColor: COLORS.wp2,
      backgroundColor: "rgba(56,189,248,0.34)",
      fill: "-1",
      tension: 0.22,
      pointRadius: 0,
      borderWidth: 2,
      stack: "wp",
    },
    {
      type: "line",
      label: "Leistung Reaktor 1",
      data: points.map((p) => ({ x: p.time, y: p.P_R1 })),
      borderColor: COLORS.r1,
      backgroundColor: COLORS.r1,
      fill: false,
      tension: 0.22,
      pointRadius: 0,
      borderWidth: 2,
    },
    {
      type: "line",
      label: "Leistung Reaktor 2",
      data: points.map((p) => ({ x: p.time, y: p.P_R2 })),
      borderColor: COLORS.r2,
      backgroundColor: COLORS.r2,
      fill: false,
      tension: 0.22,
      pointRadius: 0,
      borderWidth: 2,
    },
    {
      type: "line",
      label: "Leistung Luft",
      data: points.map((p) => ({ x: p.time, y: p.P_L })),
      borderColor: COLORS.air,
      backgroundColor: COLORS.air,
      fill: false,
      tension: 0.22,
      pointRadius: 0,
      borderWidth: 2.2,
    },
  ];

  if (energyChart) energyChart.destroy();
  energyChart = new Chart(ctx, {
    type: "line",
    data: { datasets },
    options: buildChartOptions("Leistung (kW)", "kW", bounds),
  });
}

function renderTempChart(points) {
  const ctx = document.getElementById("tempChart").getContext("2d");
  const bounds = computeBounds(
    points.flatMap((p) => [p.T_VL_hotel, p.T_VL_pool, p.T_puffer_2000l, p.T_max_R1, p.T_max_R2]),
    { includeZero: false, symmetric: false, lowQ: 0.15, highQ: 0.85 }
  );

  const datasets = [
    { label: "Temperatur VL Hotel", data: points.map((p) => ({ x: p.time, y: p.T_VL_hotel })), borderColor: COLORS.hotel, backgroundColor: COLORS.hotel },
    { label: "Temperatur VL Pool", data: points.map((p) => ({ x: p.time, y: p.T_VL_pool })), borderColor: COLORS.pool, backgroundColor: COLORS.pool },
    { label: "Temperatur Puffer 2000 l", data: points.map((p) => ({ x: p.time, y: p.T_puffer_2000l })), borderColor: COLORS.puffer, backgroundColor: COLORS.puffer },
    { label: "Temperatur Max R1", data: points.map((p) => ({ x: p.time, y: p.T_max_R1 })), borderColor: COLORS.r1, backgroundColor: COLORS.r1 },
    { label: "Temperatur Max R2", data: points.map((p) => ({ x: p.time, y: p.T_max_R2 })), borderColor: COLORS.r2, backgroundColor: COLORS.r2 },
  ].map((d) => ({ ...d, fill: false, tension: 0.22, pointRadius: 0, borderWidth: 2 }));

  if (tempChart) tempChart.destroy();
  tempChart = new Chart(ctx, {
    type: "line",
    data: { datasets },
    options: buildChartOptions("Temperatur (\u00b0C)", "\u00b0C", bounds),
  });
}

function buildChartOptions(yTitle, unit, yBounds) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: "index" },
    scales: {
      x: {
        type: "time",
        time: { tooltipFormat: "dd.MM. HH:mm" },
        ticks: { color: "#c9d6ee" },
        grid: { color: "rgba(255,255,255,0.08)" },
        title: { display: true, text: "Zeit", color: "#b4c3de" },
      },
      y: {
        min: yBounds.min,
        max: yBounds.max,
        ticks: { color: "#c9d6ee" },
        grid: { color: "rgba(255,255,255,0.08)" },
        title: { display: true, text: yTitle, color: "#b4c3de" },
      },
    },
    plugins: {
      legend: { labels: { color: "#e4ecfb" } },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${formatNumber(ctx.parsed.y)} ${unit}`,
        },
      },
    },
  };
}

function computeBounds(values, opts) {
  const clean = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!clean.length) return { min: opts.includeZero ? 0 : -1, max: 1 };
  const low = percentile(clean, opts.lowQ ?? 0.05);
  const high = percentile(clean, opts.highQ ?? 0.95);
  let min = low;
  let max = high;
  if (opts.includeZero) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }
  if (opts.symmetric) {
    const absSorted = clean.map((v) => Math.abs(v)).sort((a, b) => a - b);
    const m = percentile(absSorted, opts.absQ ?? 0.9);
    min = -m;
    max = m;
  }
  const span = Math.max(0.01, max - min);
  const pad = span * 0.12;
  return { min: min - pad, max: max + pad };
}

function percentile(sorted, q) {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  return sorted[base];
}

function updateHighlights(points) {
  const latest = points[points.length - 1];
  setText("lastUpdated", latest ? formatTime(latest.time) : "-");
  if (!points.length) {
    setText("copValue", "-");
    setText("sumR1Value", "-");
    setText("sumR2Value", "-");
    setText("sumLValue", "-");
    setText("tMaxPairValue", "-");
    return;
  }

  const copAvg = average(points.map((p) => p.COP).filter((v) => Number.isFinite(v) && v > 0));
  const r1Kwh = integrateKwh(points, "P_R1");
  const r2Kwh = integrateKwh(points, "P_R2");
  const lKwh = integrateKwh(points, "P_L");
  const tMaxR1 = maxOf(points, "T_max_R1");
  const tMaxR2 = maxOf(points, "T_max_R2");

  setText("copValue", Number.isFinite(copAvg) ? formatNumber(copAvg) : "-");
  setText("sumR1Value", `${formatNumber(r1Kwh)} kWh`);
  setText("sumR2Value", `${formatNumber(r2Kwh)} kWh`);
  setText("sumLValue", `${formatNumber(lKwh)} kWh`);
  setText("tMaxPairValue", `${formatNumber(tMaxR1)} \u00b0C / ${formatNumber(tMaxR2)} \u00b0C`);
}

function integrateKwh(points, key) {
  if (points.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const cur = points[i];
    const dtHours = (cur.time - prev.time) / 3600000;
    if (!Number.isFinite(dtHours) || dtHours <= 0) continue;
    const y0 = toNumber(prev[key]);
    const y1 = toNumber(cur[key]);
    sum += ((y0 + y1) / 2) * dtHours;
  }
  return sum;
}

function maxOf(points, key) {
  let m = Number.NEGATIVE_INFINITY;
  for (const p of points) {
    const v = toNumber(p[key]);
    if (v > m) m = v;
  }
  return Number.isFinite(m) ? m : 0;
}

function sumFields(obj, keys) {
  return keys.reduce((acc, key) => acc + toNumber(obj[key]), 0);
}

function averagePositive(values) {
  return average(values.map(toNumber).filter((v) => v > 0));
}

function average(values) {
  if (!values.length) return NaN;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(1) : "-";
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function toggleNoData(show) {
  const el = document.getElementById("noDataMessage");
  if (el) el.classList.toggle("hidden", !show);
}

function formatTime(date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDateTimeLocal(date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function toIsoOrFallback(value, isStart) {
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    if (isStart) parsed.setSeconds(0, 0);
    else parsed.setSeconds(59, 999);
    return parsed.toISOString();
  }
  return value;
}
