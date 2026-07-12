/**
 * Adapter MQTT dari format infra cloud (greenhouse/cianjur/seedling/SN-01/sensor)
 * ke kontrak internal app (nitrogen, soil_moisture, screenhouse/...).
 */

const FIELD_ALIASES = [
  ["npk_n", "nitrogen"],
  ["npk_p", "phosphorus"],
  ["npk_k", "potassium"],
  ["moisture", "soil_moisture"],
];

function parseScreenhouseMap() {
  const raw = process.env.INFRA_MQTT_SCREENHOUSE_MAP || "";
  const map = new Map();
  for (const entry of raw.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const path = trimmed.slice(0, eq).trim();
    const id = trimmed.slice(eq + 1).trim();
    if (path && id) map.set(path, id);
  }
  return map;
}

const SCREENHOUSE_MAP = parseScreenhouseMap();

function normalizeInfraPayload(data) {
  const out = { ...data };
  for (const [alias, canonical] of FIELD_ALIASES) {
    if (out[canonical] == null && out[alias] != null) {
      out[canonical] = out[alias];
    }
  }
  return out;
}

function isGreenhouseInfraTopic(parts) {
  return parts[0] === "greenhouse" && parts[parts.length - 1] === "sensor";
}

function getInfraSubscribeTopics() {
  const raw = process.env.INFRA_MQTT_TOPICS || "greenhouse/+/+/+/sensor";
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Normalisasi topic + payload sebelum masuk ingestPipeline.
 * @returns {{ data: object, parts: string[], screenhouseIdFromTopic: string|null }}
 */
function adaptMqttMessage(topic, rawData) {
  const parts = topic.split("/");

  if (parts[0] === "screenhouse") {
    return {
      data: rawData,
      parts,
      screenhouseIdFromTopic: parts[1] ?? null,
    };
  }

  if (isGreenhouseInfraTopic(parts)) {
    const data = normalizeInfraPayload(rawData);
    const nodeFromTopic = parts[parts.length - 2];

    if (
      nodeFromTopic &&
      data.node_id == null &&
      data.nodeId == null &&
      data.node_code == null &&
      data.nodeCode == null
    ) {
      data.node_id = nodeFromTopic;
    }

    const locationKey = `${parts[1]}/${parts[2]}`;
    const screenhouseIdFromTopic = SCREENHOUSE_MAP.get(locationKey) ?? null;

    return { data, parts, screenhouseIdFromTopic };
  }

  return {
    data: rawData,
    parts,
    screenhouseIdFromTopic: null,
  };
}

module.exports = {
  normalizeInfraPayload,
  adaptMqttMessage,
  getInfraSubscribeTopics,
  isGreenhouseInfraTopic,
};
