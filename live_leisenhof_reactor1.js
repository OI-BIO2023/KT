const IDENT = "LH";
const POLL_MS = 10000;
const LOOKBACK_WINDOWS_HOURS = [1, 24, 24 * 7];

bootstrap();

function bootstrap() {
  refresh();
  setInterval(refresh, POLL_MS);
}

async function refresh() {
  try {
    const latest = await fetchLatestValueRecord();

    if (!latest) {
      setText("connState", "keine Daten gefunden");
      return;
    }

    render(latest);
    setText("connState", "verbunden");
    setText("lastSeen", new Date().toLocaleString("de-DE"));
  } catch (err) {
    setText("connState", "api-fehler");
    console.error("Live refresh failed", err);
  }
}

async function fetchLatestValueRecord() {
  const end = new Date();
  for (const hours of LOOKBACK_WINDOWS_HOURS) {
    const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
    const params = new URLSearchParams({
      ident: IDENT,
      type: "value",
      start: start.toISOString(),
      end: end.toISOString(),
    });

    const res = await fetch(`/.netlify/functions/data?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`API ${res.status}`);
    }
    const rows = await res.json();
    if (Array.isArray(rows) && rows.length) {
      return rows[rows.length - 1];
    }
  }
  return null;
}

function render(data) {
  const pWpCool = sum(data, ["P_cool_1", "P_cool_2"]);
  const pWpEl = sum(data, ["P_el_1", "P_el_2"]);
  const pWpHeat = sum(data, ["P_heat_1", "P_heat_2"]);
  const pR1 = sum(data, ["P_lat_A", "P_sen_B", "P_lat_C", "P_sen_D"]);
  const pR2 = sum(data, ["P_lat_A_R2", "P_lat_C_R2", "P_sen_B_R2", "P_sen_D_R2"]);
  const cop = avgPositive([data.COP_1, data.COP_2]);
  const eer = avgPositive([data.EER_1, data.EER_2]);

  setText("identValue", String(data.ident || IDENT));
  setText("topicValue", String(data.type || "value"));
  setText("tsValue", String(data.ts || "-"));

  setMetric("P_Heat", data.P_Heat, "kW");
  setMetric("P_Pool", data.P_Pool, "kW");
  setMetric("P_WP_cool", pWpCool, "kW");
  setMetric("P_WP_el", pWpEl, "kW");
  setMetric("P_WP_heat", pWpHeat, "kW");
  setMetric("P_R1", pR1, "kW");
  setMetric("P_R2", pR2, "kW");
  setMetric("COP", cop, "");
  setMetric("EER", eer, "");
  setMetric("T_2000l_top", data.T_2000l_top, "degC");
  setMetric("T_VL_pool", data.T_VL_Pool, "degC");
  setMetric("T_VL_heating", data.T_VL_heating, "degC");
  setMetric("T_max_BIO", data.T_max_BIO, "degC");
  setMetric("T_max_BIO_R2", data.T_max_BIO_R2, "degC");
}

function sum(obj, keys) {
  return keys.reduce((acc, key) => acc + toNumber(obj[key]), 0);
}

function avgPositive(values) {
  const positive = values.map(toNumber).filter((v) => v > 0);
  if (!positive.length) return null;
  return positive.reduce((a, b) => a + b, 0) / positive.length;
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function setMetric(id, value, unit) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    setText(id, "-");
    return;
  }
  const suffix = unit === "degC" ? " °C" : unit ? ` ${unit}` : "";
  setText(id, `${num.toFixed(1)}${suffix}`);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
