// immer ident Solos
const ident = "Solos";

// MQTT-Verbindung über WebSocket
const client = mqtt.connect('wss://mqtt.flespi.io:443', {
  username: 'FlespiToken 9KrYqIGZhixeaUSnSxcsztHfPNB6tHfjQJfvMGtKvHOdiBTUeCWDLfMNhwEVgwGG'
});

client.on('connect', () => {
  console.log("MQTT verbunden");

  // nur Topic "value" abonnieren
  client.subscribe("value");
});

client.on('message', (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    console.log("Eingehend", topic, data);

    if (data.ident !== ident) {
      console.log(`Ignoriere andere Anlage: ${data.ident}`);
      return;
    }

    // Beispiel: T1 und T2 aus JSON
    if (data.sensor === "K.T1") {
      document.getElementById("tempT1").innerHTML = `K.T1: ${data.value} °C`;
    }
    if (data.sensor === "K.T2") {
      document.getElementById("tempT2").innerHTML = `K.T2: ${data.value} °C`;
    }

  } catch (err) {
    console.error("Fehler beim Parsen", err);
  }
});

client.on('error', (err) => {
  console.error("MQTT-Fehler", err);
});
