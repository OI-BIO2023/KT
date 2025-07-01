let chart;

async function fetchData() {
  const res = await fetch("/.netlify/functions/data");
  return res.json();
}

async function init() {
  const data = await fetchData();

  // Alle verschiedenen idents (Anlagen)
  const idents = [...new Set(data.map((item) => item.ident))];

  const identSelect = document.getElementById("identSelect");
  idents.forEach((ident) => {
    const option = document.createElement("option");
    option.value = ident;
    option.textContent = ident;
    identSelect.appendChild(option);
  });

  identSelect.addEventListener("change", () => renderChart(data, identSelect.value));

  // Standard erstes ident
  renderChart(data, idents[0]);
}

function renderChart(data, ident) {
  const filtered = data.filter((item) => item.ident === ident);

  const labels = filtered.map((item) => item.minute);
  const temperatures = filtered.map((item) => Number(item["K.T1"]));

  if (chart) chart.destroy();

  const ctx = document.getElementById("tempChart").getContext("2d");
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: `Temperatur K.T1 (${ident})`,
          data: temperatures,
          borderColor: "blue",
          fill: false,
          pointRadius: 4,
          pointHoverRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        tooltip: {
          mode: "nearest",
        },
      },
      scales: {
        x: {
          title: { display: true, text: "Zeit" },
        },
        y: {
          title: { display: true, text: "°C" },
        },
      },
    },
  });
}

init();
