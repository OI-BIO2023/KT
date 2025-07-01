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

const sensorLabels = {
  "K.T1": "T IN Puffer",
  "K.T2": "T Puffer oben",
  "K.T3": "T Puffer unten",
  "K.T4": "T IN Biomasse R1",
  "K.T5": "T Außen",
  "K.T6": "T IN Biomasse R2",
  "K.T7": "Puffer R2 unten",
  "K.T8": "Puffer R2 oben",
  "K.T9": "T OUT R2 zu WT",
  "K.T10": "T Biomasse R1 Seite A unten",
  "K.T11": "T Biomasse R1 Seite A mitte",
  "K.T12": "T Biomasse R1 Seite A oben",
  "K.T13": "T Biomasse R1 Seite B unten",
  "K.T14": "T Biomasse R1 Seite B mitte",
  "K.T15": "T Biomasse R1 Seite B oben",
  "K.T16": "T Biomasse R1 Seite C unten",
  "K.T17": "T Biomasse R1 Seite C mitte",
  "K.T18": "T Biomasse R1 Seite C oben",
  "K.T20": "T Biomasse R2 Seite A unten",
  "K.T21": "T Biomasse R2 Seite A mitte",
  "K.T22": "T Biomasse R2 Seite A oben",
  "K.T23": "T Biomasse R2 Seite B unten",
  "K.T24": "T Biomasse R2 Seite B mitte",
  "K.T25": "T Biomasse R2 Seite B oben",
  "K.T26": "T Biomasse R2 Seite C unten",
  "K.T27": "T Biomasse R2 Seite C mitte",
  "K.T28": "T Biomasse R2 Seite C oben",
  "T1": "T VL Free Heating",
  "T2": "T Puffer Verbraucher unten",
  "T4": "T WT Verbraucherseite",
  "K.TF1": "T OUT Puffer",
  "K.TF4": "T IN Frischwasser",
  "K.TF2": "T OUT EX latent A",
  "K.TF3": "T OUT EX sensible B",
  "K.TF7": "T OUT EX R2 latent A",
  "K.TF8": "T OUT EX R2 sensible B",
  "K.TF11": "T IN Frischwasser R2",
  "TF1": "T RL Free Heating"
};


const userSensors = [
  "T2", "T4", "TF1"
];

async function fetchData(start, end, ident) {
  const url = `/.netlify/functions/data?ident=${ident}&start=${start}&end=${end}`;
  console.log("Daten abrufen von", url);
  const res = await fetch(url);
  return res.json();
}

async function init() {
  // alle idents einmal laden
  const res = await fetch("/.netlify/functions/data?ident=Solos&start=1970-01-01T00:00:00Z&end=2100-01-01T00:00:00Z");
  allData = await res.json();

  const idents = [...new Set(allData.map((item) => item.ident))];

  const identSelect = document.getElementById("identSelect");
  idents.forEach((ident) => {
    const option = document.createElement("option");
    option.value = ident;
    option.textContent = ident;
    identSelect.appendChild(option);
  });

  // Standard-Filter auf letzten 24h setzen
  const end = new Date();
  const start = new Date();
  start.setHours(end.getHours() - 24);

  document.getElementById("endDateTime").value = formatDateTimeLocal(end);
  document.getElementById("startDateTime").value = formatDateTimeLocal(start);

  identSelect.addEventListener("change", () => renderCharts());
  document.getElementById("filterButton").addEventListener("click", () => renderCharts());

  // Checkboxen generieren
  generateCheckboxes("reactorCheckboxes", reactorSensors);
  generateCheckboxes("biomassCheckboxes", biomassSensors);
  generateCheckboxes("userCheckboxes", userSensors);

  // direkt Render
  await renderCharts();
}

function generateCheckboxes(containerId, sensorList) {
  const container = document.getElementById(containerId);
  container.innerHTML = ""; // leeren, falls mehrfach gerendert
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

async function renderCharts() {
  const selectedIdent = document.getElementById("identSelect").value;
  const startTime = document.getElementById("startDateTime").value;
  const endTime = document.getElementById("endDateTime").value;

  if (!selectedIdent || !startTime || !endTime) {
    console.log("Fehlende Filterparameter, Abbruch");
    return;
  }

  allData = await fetchData(startTime, endTime, selectedIdent);
  let filtered = allData;

  // Reactor
  const reactorActiveSensors = getActiveSensors("reactorCheckboxes");
  const reactorDatasets = buildDatasets(filtered, reactorActiveSensors);
  renderChart("reactorChart", reactorDatasets, "Reactor Temperaturen", filtered);

  // Biomass
  const biomassActiveSensors = getActiveSensors("biomassCheckboxes");
  const biomassDatasets = buildDatasets(filtered, biomassActiveSensors);
  renderChart("biomassChart", biomassDatasets, "Biomass Temperaturen", filtered);

  // User
  const userActiveSensors = getActiveSensors("userCheckboxes");
  const userDatasets = buildDatasets(filtered, userActiveSensors);
  renderChart("userChart", userDatasets, "User Temperaturen", filtered);
}


function getActiveSensors(containerId) {
  const checkboxes = document.getElementById(containerId).querySelectorAll("input[type=checkbox]");
  return Array.from(checkboxes)
    .filter(cb => cb.checked)
    .map(cb => cb.value);
}

function buildDatasets(data, sensors) {
  return sensors.map(sensor => {
    const values = data.map(item => ({
      x: item.minute,
      y: Number(item[sensor] || 0)
    }));
    return {
      label: sensorLabels[sensor] || sensor,
      data: values,
      fill: false,
      borderColor: randomColor(sensor),
      tension: 0.2,
      pointRadius: 2
    };
  });
}

function renderChart(canvasId, datasets, chartLabel, filteredData) {
  if (window[canvasId + "_instance"]) {
    window[canvasId + "_instance"].destroy();
  }

  const ctx = document.getElementById(canvasId).getContext("2d");
  const chart = new Chart(ctx, {
    type: "line",
    data: {
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
            tooltipFormat: "yyyy-MM-dd HH:mm",
            displayFormats: {
              unit: window.innerWidth < 600 ? "day" : "hour",
              hour: "dd.MM HH:mm"
            },
            unit: "minute",
            stepSize: 5
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
}

// Hilfsfunktion für gerundetes Datum im 5-Minuten-Raster
function formatDateTimeLocal(date) {
  date.setMilliseconds(0);
  date.setSeconds(0);
  const minutes = date.getMinutes();
  date.setMinutes(minutes - (minutes % 5));
  return date.toISOString().slice(0,16);
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
