const IDENT = "LH";

const client = mqtt.connect("wss://mqtt.flespi.io:443", {
  username: "FlespiToken 9KrYqIGZhixeaUSnSxcsztHfPNB6tHfjQJfvMGtKvHOdiBTUeCWDLfMNhwEVgwGG",
});

client.on("connect", () => {
  setText("connState", "verbunden");
  client.subscribe("#");
});

client.on("reconnect", () => setText("connState", "verbinde..."));
client.on("offline", () => setText("connState", "offline"));
client.on("error", (err) => {
  setText("connState", "fehler");
  console.error("MQTT-Fehler", err);
});

client.on("message", (topic, message) => {
  try {
    const payload = JSON.parse(message.toString());
    const data = pickLhPayload(payload);
    if (!data) return;

    const pWpCool = sum(data, ["P_cool_1", "P_cool_2"]);
    const pWpEl = sum(data, ["P_el_1", "P_el_2"]);
    const pWpHeat = sum(data, ["P_heat_1", "P_heat_2"]);
    const pR1 = sum(data, ["P_lat_A", "P_sen_B", "P_lat_C", "P_sen_D"]);
    const pR2 = sum(data, ["P_lat_A_R2", "P_lat_C_R2", "P_sen_B_R2", "P_sen_D_R2"]);
    const cop = avgPositive([data.COP_1, data.COP_2]);
    const eer = avgPositive([data.EER_1, data.EER_2]);

    setText("identValue", String(data.ident || "-"));
    setText("topicValue", topic);
    setText("tsValue", String(data.ts || "-"));
    setText("lastSeen", new Date().toLocaleString("de-DE"));

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
  } catch (err) {
    console.error("Fehler beim Parsen", err);
  }
});

function pickLhPayload(payload) {
  if (!payload) return null;
  if (Array.isArray(payload)) {
    return payload.find((p) => p && p.ident === IDENT) || null;
  }
  if (payload.ident === IDENT) return payload;
  return null;
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
