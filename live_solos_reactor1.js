// ident aus URL-Parameter holen
const urlParams = new URLSearchParams(window.location.search);
const ident = urlParams.get("ident") || "Solos";

// MQTT-Verbindung aufbauen
const client = mqtt.connect('wss://mqtt.flespi.io:443', {
  username: 'FlespiToken 9KrYqIGZhixeaUSnSxcsztHfPNB6tHfjQJfvMGtKvHOdiBTUeCWDLfMNhwEVgwGG'
});

client.on('connect', () => {
  console.log("MQTT verbunden");

  // Topic abonnieren für den gewählten ident
  const topic = `bioreactor/${ident}/+`;
  console.log(`Abonniere Topic: ${topic}`);
  client.subscribe(topic);
});

client.on('message', (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    console.log("Eingehende Nachricht", topic, data);

    // Prüfe ident
    if (data.ident !== ident) {
      console.log(`Ignoriere andere Anlage: ${data.ident}`);
      return;
    }

    // Beispiel: Sensoren
    if (data.sensor === "T1") {
      document.getElementById("tempT1").innerHTML = `T1: ${data.value} °C`;
    }
    if (data.sensor === "T2") {
      document.getElementById("tempT2").innerHTML = `T2: ${data.value} °C`;
    }

  } catch (err) {
    console.error("Fehler beim Parsen", err);
  }
});

client.on('error', (err) => {
  console.error("MQTT-Fehler", err);
});
