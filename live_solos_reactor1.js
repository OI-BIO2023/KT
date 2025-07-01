// ident fix Solos
const ident = "Solos";

// MQTT WebSocket
const client = mqtt.connect('wss://mqtt.flespi.io:443', {
  username: 'FlespiToken 9KrYqIGZhixeaUSnSxcsztHfPNB6tHfjQJfvMGtKvHOdiBTUeCWDLfMNhwEVgwGG'
});

client.on('connect', () => {
  console.log("MQTT verbunden");

  // nur Topic event abonnieren
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

    // K.T1
    if (data["K.T1"] !== undefined) {
      console.log("Schreibe in tempT1", data["K.T1"]);
      document.getElementById("tempT1").innerHTML = `T1: ${data["K.T1"].toFixed(1)} °C`;
    }

    // K.T2
    if (data["K.T2"] !== undefined) {
      document.getElementById("tempT2").innerHTML = `T2: ${data["K.T2"].toFixed(1)} °C`;
    }

  } catch (err) {
    console.error("Fehler beim Parsen", err);
  }
});

client.on('error', (err) => {
  console.error("MQTT-Fehler", err);
});
