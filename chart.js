let reactorChart, biomassChart, userChart;
let allData = [];  // alle geladenen Items

// Sensor-Gruppen
const reactorSensors = [
  "K.T1", "K.T2", "K.T3", "K.T4", "K.T5", "K.T6", "K.T7", "K.T8", "K.T9",
  "K.TF1", "K.TF4", "K.TF2", "K.TF3", "K.TF7", "K.TF8", "K.TF11", "T1"
];

const biomassSensors = [
  "K.T10","K.T11","K.T12","K.T13","K.T14","K.T15","K.T16","K.T17","K.T18",
  "K.T20","K.T21","K.T22","K.T23","K.T24","K.T25","K.T26","K.T27","K.T28"
];

const userSensors = [
  "T2", "T4", "TF1"
];

async function fetchData() {
  const res = await fetch("/.netlify/functions/data");
  return res.json();
}

async function init() {
  allData = await fetchData();

  const idents = [...new Set(
    allData
      .filter((item) => item.ident && item.ident !== "")
      .map((item) => item.ident)
  )];

  // Standardwerte für den Zeitfilter setzen (letzte 24h)
  const end = new Date();
  const start = new Date();
  start.setHours(end.getHours() - 24);
  
  document.getElementById("endDateTime").value = end.toISOString().slice(0,16);
  document.getElementById("startDateTime").value = start.toISOString().slice(0,16);


  const identSelect = document.getElementById("identSelect");
  idents.forEach((ident) => {
    const option = document.createElement("option");
    option.value = ident;
    option.textContent = ident;
    identSelect.appendChild(option);
  });

  identSelect.addEventListener("change", () => renderCharts());
  document.getElementById("filterButton").addEventListener("click", () => renderCharts());

  // Checkboxen generieren
  generateCheckboxes("reactorCheckboxes", reactorSensors);
  generateCheckboxes("biomassCheckboxes", biomassSensors);
  generateCheckboxes("userCheckboxes", userSensors);

  renderCharts();
}

function generateCheckboxes(containerId, sensorList) {
  const container = document.getElementById(containerId);
  sensorList.forEach(sensor => {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = sensor;
    checkbox.checked = true;  // standardmäßig an
    checkbox.addEventListener("change", () => renderCharts());
    label.appendChild(checkbox);
    label.append(` ${sensor} `);
    container.appendChild(label);
  });
}

function renderCharts() {
  const selectedIdent = document.getElementById("identSelect").value;
  const startTime = document.getElementById("startDateTime").value;
  const endTime = document.getElementById("endDateTime").value;

  let filtered = allData.filter(item => item.ident === selectedIdent);

  // Zeitfilter
  if (startTime) {
    filtered = filtered.filter(item => new Date(item.minute) >= new Date(startTime));
  }
  if (endTime) {
    filtered = filtered.filter(item => new Date(item.minute) <= new Date(endTime));
  }

  // REACTOR
  const reactorActiveSensors = getActiveSensors("reactorCheckboxes");
  const reactorDatasets = buildDatasets(filtered, reactorActiveSensors);
  renderChart("reactorChart", reactorDatasets, "Reactor Temperaturen", reactorChart => reactorChart = reactorChart);

  // BIOMASS
  const biomassActiveSensors = getActiveSensors("biomassCheckboxes");
  const biomassDatasets = buildDatasets(filtered, biomassActiveSensors);
  renderChart("biomassChart", biomassDatasets, "Biomass Temperaturen", biomassChart => biomassChart = biomassChart);

  // USER
  const userActiveSensors = getActiveSensors("userCheckboxes");
  const userDatasets = buildDatasets(filtered, userActiveSensors);
  renderChart("userChart", userDatasets, "User Temperaturen", userChart => userChart = userChart);
}

function getActiveSensors(containerId) {
  const checkboxes = document.getElementById(containerId).querySelectorAll("input[type=checkbox]");
  return Array.from(checkboxes)
    .filter(cb => cb.checked)
    .map(cb => cb.value);
}

function buildDatasets(data, sensors) {
  return sensors.map(sensor => {
    const values = data.map(item => Number(item[sensor] || 0));
    const labels = data.map(item => item.minute);
    return {
      label: sensor,
      data: values,
      fill: false,
      borderColor: randomColor(sensor),
      tension: 0.2,
      pointRadius: 2
    };
  });
}

function renderChart(canvasId, datasets, chartLabel, saveChartCallback) {
  if (window[canvasId + "_instance"]) {
    window[canvasId + "_instance"].destroy();
  }

  // wir nehmen Labels aus den Zeitstempeln
  const labels = allData
    .filter(item => item.ident === document.getElementById("identSelect").value)
    .map(item => item.minute);

  const ctx = document.getElementById(canvasId).getContext("2d");
  const chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "top" },
        title: { display: true, text: chartLabel }
      },
      scales: {
        x: {
          type: "time",
          time: {
            parser: "yyyy-MM-dd'T'HH:mm:ss'Z'",
            tooltipFormat: "yyyy-MM-dd HH:mm",
            unit: "hour"
          },
          title: { display: true, text: "Zeit" }
        },
        y: {
          title: { display: true, text: "°C" }
        }
      }
    }
  });
  window[canvasId + "_instance"] = chart;
  saveChartCallback(chart);
}


// einfache Farbzuweisung
function randomColor(seed) {
  const colors = [
    "red", "blue", "green", "orange", "purple", "brown", "black", "gray", "pink", "teal"
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash += seed.charCodeAt(i);
  }
  return colors[hash % colors.length];
}

init();
