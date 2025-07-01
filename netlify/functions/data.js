import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

const client = new DynamoDBClient({
  region: process.env.MY_AWS_REGION,
  credentials: {
    accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY,
  },
});

export async function handler(event, context) {
  try {
    const params = {
      TableName: "MQTT_KT", // hier deinen DynamoDB Tabellennamen einsetzen
      Limit: 1000, // zum Start nicht gleich Millionen abrufen
    };

    const command = new ScanCommand(params);
    const data = await client.send(command);

    // DynamoDB liefert Daten als Attribute-Map
    const items = data.Items.map((item) => unmarshall(item));

    return {
      statusCode: 200,
      body: JSON.stringify({
        count: items.length,
        preview: items.slice(0,5), // zeige nur die ersten 5
        allItems: items,
      }),
      headers: { "Content-Type": "application/json" },
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Fehler beim Abruf aus DynamoDB" }),
    };
  }
}
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
