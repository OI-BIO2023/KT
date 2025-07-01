const { DynamoDBClient, ScanCommand } = require("@aws-sdk/client-dynamodb");
const { unmarshall } = require("@aws-sdk/util-dynamodb");

const client = new DynamoDBClient({
  region: process.env.MY_AWS_REGION,
  credentials: {
    accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY,
  },
});

exports.handler = async function (event, context) {
  try {
    const params = {
      TableName: "MQTT_KT",   // dein Tabellenname
      Limit: 1000,            // nicht zu groß starten
    };

    const command = new ScanCommand(params);
    const data = await client.send(command);

    const items = data.Items.map((item) => unmarshall(item));

    return {
      statusCode: 200,
      body: JSON.stringify(items),
      headers: { "Content-Type": "application/json" },
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
