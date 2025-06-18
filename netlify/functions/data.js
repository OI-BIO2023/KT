const AWS = require('aws-sdk');
require('dotenv').config();

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

  const fromTs = `${from}T00:00:00Z`;
  const toTs = `${to}T23:59:59Z`;

  try {
    const result = await dynamo.query({
      TableName: process.env.TABLE_NAME,
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
      body: JSON.stringify(result.Items)
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
