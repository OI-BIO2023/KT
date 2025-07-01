const { DynamoDBClient, QueryCommand } = require("@aws-sdk/client-dynamodb");
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
    const tableName = "MQTT_KT";

    // Parameter aus Querystring auslesen
    const params = event.queryStringParameters || {};
    const ident = params.ident || "Solos"; // fallback
    const start = params.start;
    const end = params.end;

    if (!start || !end) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "start and end parameters required" }),
      };
    }

    const queryParams = {
      TableName: tableName,
      KeyConditionExpression: "#ident = :ident AND #minute BETWEEN :start AND :end",
      ExpressionAttributeNames: {
        "#ident": "ident",
        "#minute": "minute"
      },
      ExpressionAttributeValues: {
        ":ident": { S: ident },
        ":start": { S: start },
        ":end": { S: end }
      }
    };

    const command = new QueryCommand(queryParams);
    const data = await client.send(command);

    const items = data.Items.map(item => unmarshall(item));

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
