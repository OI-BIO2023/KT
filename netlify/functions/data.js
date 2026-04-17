const { DynamoDBClient, QueryCommand } = require("@aws-sdk/client-dynamodb");
const { unmarshall } = require("@aws-sdk/util-dynamodb");

const client = new DynamoDBClient({
  region: process.env.MY_AWS_REGION,
  credentials: {
    accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY,
  },
});

const TABLE_NAME = process.env.MY_DDB_TABLE || "MQTT_KT";
const WP_SCALE_DIVISOR = Number(process.env.MY_WP_DIVISOR || "10");

exports.handler = async function (event) {
  try {
    const params = event.queryStringParameters || {};
    const ident = params.ident || "LH";
    const type = (params.type || "value").toLowerCase();
    const startIso = parseIso(params.start, new Date(Date.now() - 24 * 60 * 60 * 1000));
    const endIso = parseIso(params.end, new Date());

    if (startIso > endIso) {
      return badRequest("start must be before end");
    }

    const queryParams = {
      TableName: TABLE_NAME,
      KeyConditionExpression: "#pk = :pk AND #sk BETWEEN :skStart AND :skEnd",
      ExpressionAttributeNames: {
        "#pk": "pk",
        "#sk": "sk",
      },
      ExpressionAttributeValues: {
        ":pk": { S: `DEVICE#${ident}` },
        ":skStart": { S: `TS#${startIso}` },
        ":skEnd": { S: `TS#${endIso}#~` },
      },
      ScanIndexForward: true,
    };

    if (type !== "all") {
      queryParams.FilterExpression = "#type = :type";
      queryParams.ExpressionAttributeNames["#type"] = "type";
      queryParams.ExpressionAttributeValues[":type"] = { S: type };
    }

    const rows = [];
    let lastKey;
    do {
      const page = await client.send(new QueryCommand({ ...queryParams, ExclusiveStartKey: lastKey }));
      (page.Items || []).forEach((item) => rows.push(unmarshall(item)));
      lastKey = page.LastEvaluatedKey;
    } while (lastKey);

    const items = rows.map(flattenRecord).filter((x) => x && x.ts);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(items),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

function badRequest(message) {
  return {
    statusCode: 400,
    body: JSON.stringify({ error: message }),
  };
}

function parseIso(value, fallbackDate) {
  const date = value ? new Date(value) : fallbackDate;
  if (Number.isNaN(date.getTime())) {
    return fallbackDate.toISOString();
  }
  return date.toISOString();
}

function flattenRecord(item) {
  const payload = applyWpScaling(normalizePayload(item.payload));
  return {
    ...payload,
    ident: item.ident,
    ts: item.ts,
    type: item.type,
    pk: item.pk,
    sk: item.sk,
  };
}

function applyWpScaling(payload) {
  if (!payload || typeof payload !== "object") return payload;
  const keys = ["P_heat_1", "P_cool_1", "P_el_1", "P_heat_2", "P_cool_2", "P_el_2"];
  const out = { ...payload };
  const divisor = Number.isFinite(WP_SCALE_DIVISOR) && WP_SCALE_DIVISOR > 0 ? WP_SCALE_DIVISOR : 10;
  keys.forEach((key) => {
    if (typeof out[key] === "number") {
      out[key] = out[key] / divisor;
    }
  });
  return out;
}

function normalizePayload(payload) {
  if (!payload) return {};
  if (typeof payload === "string") {
    try {
      return unwrapAwsJson(JSON.parse(payload));
    } catch {
      return {};
    }
  }
  return unwrapAwsJson(payload);
}

function unwrapAwsJson(value) {
  if (Array.isArray(value)) {
    return value.map(unwrapAwsJson);
  }
  if (value && typeof value === "object") {
    if (Object.keys(value).length === 1) {
      if ("N" in value) return Number(value.N);
      if ("S" in value) return String(value.S);
      if ("BOOL" in value) return Boolean(value.BOOL);
      if ("NULL" in value) return null;
      if ("M" in value) return unwrapAwsJson(value.M);
      if ("L" in value) return unwrapAwsJson(value.L);
    }
    const out = {};
    Object.entries(value).forEach(([key, val]) => {
      out[key] = unwrapAwsJson(val);
    });
    return out;
  }
  return value;
}
