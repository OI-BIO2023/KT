const client = mqtt.connect('wss://mqtt.flespi.io:443', {
  username: 'FlespiToken 9KrYqIGZhixeaUSnSxcsztHfPNB6tHfjQJfvMGtKvHOdiBTUeCWDLfMNhwEVgwGG'
});

client.on('connect', () => {
  client.subscribe('my/topic/#');
});

client.on('message', (topic, message) => {
  const data = JSON.parse(message.toString());
  if(data.sensor === "T1") {
    document.getElementById("tempT1").innerHTML = `T1: ${data.value} °C`;
  }
  if(data.sensor === "T2") {
    document.getElementById("tempT2").innerHTML = `T2: ${data.value} °C`;
  }
});
