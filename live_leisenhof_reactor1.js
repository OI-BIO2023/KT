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
    setText("tsValue", String(latest.ts || "-"));
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
  const pL = pWpHeat + pWpCool - pR1 - pR2;

  setMetric("technikPWpEl", pWpEl, "kW");
  setMetric("technikPWpHeat", pWpHeat, "kW");
  setMetric("r1Power", pR1, "kW");
  setMetric("r2Power", pR2, "kW");
  setMetric("r1Temp", data.T_max_BIO, "degC");
  setMetric("r2Temp", data.T_max_BIO_R2, "degC");
  setMetric("hotelPHeat", data.P_Heat, "kW");
  setMetric("hotelTVlHeat", data.T_VL_heating, "degC");
  setMetric("poolPower", data.P_Pool, "kW");
  setMetric("poolTemp", data.T_VL_Pool, "degC");
  setMetric("airPower", pL, "kW");

}

function sum(obj, keys) {
  return keys.reduce((acc, key) => acc + toNumber(obj[key]), 0);
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
