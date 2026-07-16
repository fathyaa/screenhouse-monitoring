/**
 * Generate realistic sensor telemetry JSON matching monitoring-service ingest schema.
 */

function rand(min, max, decimals = 0) {
  const v = min + Math.random() * (max - min);
  return decimals ? Math.round(v * 10 ** decimals) / 10 ** decimals : Math.round(v);
}

export function buildSensorPayload({ nodeCode, sinkCode, seq, runId }) {
  const publishedAt = Date.now();
  return {
    node_id: nodeCode,
    node_code: nodeCode,
    destination_id: sinkCode,
    nitrogen: rand(15, 55),
    phosphorus: rand(8, 35),
    potassium: rand(10, 60),
    soil_temperature: rand(18, 38, 1),
    soil_moisture: rand(35, 85, 1),
    soil_ph: rand(5.2, 7.5, 2),
    conductivity: rand(150, 1200, 1),
    air_temperature: rand(20, 36, 1),
    air_humidity: rand(40, 95, 1),
    light_intensity: rand(2000, 45000),
    _loadtest: {
      runId,
      seq,
      publishedAt,
      nodeCode,
    },
  };
}

export function buildTopic(topicPattern, sensor) {
  return topicPattern
    .replaceAll("{nodeCode}", sensor.nodeCode)
    .replaceAll("{screenhouseId}", String(sensor.screenhouseId))
    .replaceAll("{sinkCode}", sensor.sinkCode);
}
