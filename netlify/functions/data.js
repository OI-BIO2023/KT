const AWS = require('aws-sdk');

// Kein dotenv im Netlify-Environment notwendig
const dynamo = new AWS.DynamoDB.DocumentClient({
  region: process.env.MY_AWS_REGION,
  accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY
});

exports.handler = async (event) => {
  const { ident, from, to } = event.queryStringParameters || {};

  if (!ident || !from || !to) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing ident, from, or to." })
    };
  }

  // ISO-Zeiten erzeugen für DynamoDB-Vergleich
  const fromTs = new Date(`${from}T00:00:00Z`).toISOString();
  const toTs = new Date(`${to}T23:59:59Z`).toISOString();

  try {
    const result = await dynamo.query({
      TableName: process.env.MY_TABLE_NAME || 'MQTT_KT',
      KeyConditionExpression: "#ident = :ident AND #minute BETWEEN :from AND :to",
      ExpressionAttributeNames: {
        "#ident": "ident",
        "#minute": "minute"
      },
      ExpressionAttributeValues: {
        ":ident": ident,
        ":from": fromTs,
        ":to": toTs
      }
    }).promise();

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(result.Items || [])
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
