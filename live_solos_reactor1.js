const ident = "Solos";

const client = mqtt.connect('wss://mqtt.flespi.io:443', {
  username: 'FlespiToken 9KrYqIGZhixeaUSnSxcsztHfPNB6tHfjQJfvMGtKvHOdiBTUeCWDLfMNhwEVgwGG'
});

client.on('connect', () => {
  console.log("MQTT verbunden");
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

    // Einfache Temperaturen
    if (data["K.T1"] !== undefined) {
      document.getElementById("tempT1").innerHTML = `T1: ${data["K.T1"].toFixed(1)}°C`;
    }
    if (data["K.T2"] !== undefined) {
      document.getElementById("tempT2").innerHTML = `T2: ${data["K.T2"].toFixed(1)}°C`;
    }
    if (data["K.T3"] !== undefined) {
      document.getElementById("tempT3").innerHTML = `T3: ${data["K.T3"].toFixed(1)}°C`;
    }
    if (data["K.T5"] !== undefined) {
      document.getElementById("tempT5").innerHTML = `T5: ${data["K.T5"].toFixed(1)}°C`;
    }
    if (data["K.TF1"] !== undefined) {
      document.getElementById("tempTF1").innerHTML = `TF1: ${data["K.TF1"].toFixed(1)}°C`;
    }

    // Biomasse Temperaturen (Mittelwerte)
    const kT12 = data["K.T12"] ?? null;
    const kT15 = data["K.T15"] ?? null;
    const kT18 = data["K.T18"] ?? null;
    const kT11 = data["K.T11"] ?? null;
    const kT14 = data["K.T14"] ?? null;
    const kT17 = data["K.T17"] ?? null;
    const kT10 = data["K.T10"] ?? null;
    const kT13 = data["K.T13"] ?? null;
    const kT16 = data["K.T16"] ?? null;

    if (kT12 && kT15 && kT18) {
      const T_up = (kT12 + kT15 + kT18) / 3;
      document.getElementById("tempBioLow").innerHTML = `T_low: ${T_low.toFixed(1)}°C`;
    }
    if (kT11 && kT14 && kT17) {
      const T_mid = (kT11 + kT14 + kT17) / 3;
      document.getElementById("tempBioMid").innerHTML = `T_mid: ${T_mid.toFixed(1)}°C`;
    }
    if (kT10 && kT13 && kT16) {
      const T_low = (kT10 + kT13 + kT16) / 3;
      document.getElementById("tempBioUp").innerHTML = `T_up: ${T_up.toFixed(1)}°C`;
    }

  } catch (err) {
    console.error("Fehler beim Parsen", err);
  }
});

client.on('error', (err) => {
  console.error("MQTT-Fehler", err);
});
