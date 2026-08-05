const pool = require("../../config/db");
const { THRESHOLD_METRICS } = require("./thresholdMetrics");
const { publishEvent } = require("../../shared/events/eventBus");
const { RK } = require("../../shared/events/routingKeys");
const { setActuators } = require("../ingest/actuatorService");
const { resolveActuatorActions, resolveActuatorRecoveryActions } = require("../../shared/actuatorRules");
const {
  OFFLINE_ALERT_MESSAGE_SUFFIX,
  buildOfflineAlertMessage,
  consolidateOfflineAlerts,
  consolidateAllOfflineDuplicates,
} = require("../../shared/offlineAlert");
const { staleThresholdMs } = require("../../shared/nodeLiveness");
// Kontrol aktuator otomatis dari alert. Set AUTO_ACTUATOR_ENABLED=false untuk
// menonaktifkan global (mis. saat uji koneksi device supaya app tidak menyetir
// valve), atau AUTO_ACTUATOR_EXCLUDE untuk mengecualikan screenhouse tertentu
// (mis. gh01 yang slot `fan`-nya sebenarnya katup air tray 2).
// Alert tetap dibuat/di-resolve seperti biasa — yang dimatikan hanya aksi aktuator.
const { isAutoActuatorEnabled } = require("../../shared/actuatorCapabilities");

// Ambang toleransi (hysteresis) agar alert tidak langsung resolve begitu nilai
// baru saja balik melewati batas — mencegah alert "kedap-kedip" saat pembacaan
// sensor jitter tipis di sekitar min/max (paling terasa di parameter tanpa
// aktuator penstabil, mis. conductivity, yang tidak punya kipas/irigasi yang
// menariknya balik ke tengah rentang aman).
const HYSTERESIS_RATIO = 0.05;

// Log per-pesan dimatikan default; set ALERT_DEBUG=true untuk mengaktifkan.
const DEBUG = process.env.ALERT_DEBUG === "true";

// Threshold snapshot per screenhouse jarang berubah tapi sebelumnya di-SELECT
// untuk SETIAP pesan sensor. Cache ber-TTL + invalidasi saat snapshot di-upsert
// (routing key config.threshold) memangkas satu round-trip DB per pesan.
//
// Cache ini adalah salah satu alasan listener alert dijalankan satu instance:
// invalidasinya lokal, jadi replica kedua tidak akan tahu ambangnya sudah basi
// sampai TTL habis.
const THRESHOLD_TTL_MS = Number(process.env.THRESHOLD_CACHE_TTL_MS || 60000);
const thresholdCache = new Map();

async function getThresholdSnapshot(screenhouseId) {
  const key = String(screenhouseId);
  const hit = thresholdCache.get(key);
  if (hit && Date.now() - hit.t < THRESHOLD_TTL_MS) return hit.value;
  const result = await pool.query(
    `SELECT * FROM threshold_snapshots WHERE screenhouse_id = $1`,
    [screenhouseId]
  );
  const value = result.rows[0] ?? null;
  thresholdCache.set(key, { value, t: Date.now() });
  return value;
}

async function resolveOfflineAlertsForNode(screenhouseId, sensorNodeId) {
  const result = await pool.query(
    `
    UPDATE alerts
    SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP
    WHERE screenhouse_id = $1
      AND sensor_node_id = $2
      AND status = 'active'
      AND message ILIKE $3
    RETURNING id
    `,
    [screenhouseId, sensorNodeId, `%${OFFLINE_ALERT_MESSAGE_SUFFIX}%`]
  );

  for (const row of result.rows) {
    console.log("OFFLINE ALERT auto-resolved for node", sensorNodeId);
    const enriched = await enrichAlert(row.id);
    if (enriched) {
      await publishEvent(RK.ALERT_RESOLVED, enriched);
    }
  }

  return result.rows.length > 0;
}

async function checkOfflineNodes() {
  const result = await pool.query(
    `
    SELECT
      sn.id AS sensor_node_id,
      sn.screenhouse_id,
      sn.node_name,
      sn.send_interval_seconds,
      (
        SELECT MAX(sd.created_at)
        FROM sensor_data sd
        WHERE sd.sensor_node_id = sn.id
      ) AS last_seen
    FROM sensor_nodes sn
    INNER JOIN screenhouse_registry sr ON sr.screenhouse_id = sn.screenhouse_id
    WHERE sn.is_active = true
      AND sr.status = 'active'
    `
  );

  const now = Date.now();
  let created = 0;
  let resolved = 0;

  for (const row of result.rows) {
    const { sensor_node_id, screenhouse_id, node_name, send_interval_seconds, last_seen } = row;

    // Lewati node yang belum pernah kirim data (bukan "tiba-tiba" offline).
    if (!last_seen) continue;

    const ageMs = now - new Date(last_seen).getTime();
    const isOffline = ageMs > staleThresholdMs(send_interval_seconds);
    const message = buildOfflineAlertMessage(node_name);

    if (isOffline) {
      const { keptId } = await consolidateOfflineAlerts(pool, {
        screenhouseId: screenhouse_id,
        sensorNodeId: sensor_node_id,
        message,
      });

      if (!keptId) {
        const isNew = await ensureAlert({
          sensorDataId: null,
          screenhouseId: screenhouse_id,
          sensorNodeId: sensor_node_id,
          message,
        });
        if (isNew) created += 1;
      }
    } else if (await resolveOfflineAlertsForNode(screenhouse_id, sensor_node_id)) {
      resolved += 1;
    }
  }

  if (created || resolved) {
    console.log(`[offline-check] alert baru: ${created}, resolved: ${resolved}`);
  }
}

const SNAPSHOT_FIELDS = [
  "min_nitrogen", "max_nitrogen",
  "min_phosphorus", "max_phosphorus",
  "min_potassium", "max_potassium",
  "min_soil_moisture", "max_soil_moisture",
  "min_soil_temperature", "max_soil_temperature",
  "min_soil_ph", "max_soil_ph",
  "min_conductivity", "max_conductivity",
  "min_air_temperature", "max_air_temperature",
  "min_air_humidity", "max_air_humidity",
  "min_light_intensity", "max_light_intensity",
];

async function upsertThresholdSnapshot(row) {
  const screenhouseId = Number(row.screenhouse_id);
  if (!screenhouseId) return;

  const cols = ["screenhouse_id", ...SNAPSHOT_FIELDS];
  const values = [screenhouseId, ...SNAPSHOT_FIELDS.map((f) => row[f] ?? null)];
  const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
  const setClause = SNAPSHOT_FIELDS.map((f) => `${f} = EXCLUDED.${f}`).join(", ");

  await pool.query(
    `
    INSERT INTO threshold_snapshots (${cols.join(", ")}, updated_at)
    VALUES (${placeholders}, NOW())
    ON CONFLICT (screenhouse_id) DO UPDATE SET
      ${setClause},
      updated_at = NOW()
    `,
    values
  );

  // Buang cache agar pembacaan berikutnya memuat ambang terbaru.
  thresholdCache.delete(String(screenhouseId));
}

async function upsertScreenhouseRegistry(row) {
  const screenhouseId = Number(row.screenhouse_id);
  if (!screenhouseId) return;

  await pool.query(
    `
    INSERT INTO screenhouse_registry (screenhouse_id, owner_user_id, screenhouse_name, status, updated_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (screenhouse_id) DO UPDATE SET
      owner_user_id = EXCLUDED.owner_user_id,
      screenhouse_name = EXCLUDED.screenhouse_name,
      status = EXCLUDED.status,
      updated_at = NOW()
    `,
    [
      screenhouseId,
      row.owner_user_id ?? null,
      row.screenhouse_name ?? `Screenhouse ${screenhouseId}`,
      row.status ?? "active",
    ]
  );
}

async function enrichAlert(alertId) {
  const enriched = await pool.query(
    `SELECT a.id, a.screenhouse_id, a.sensor_node_id, a.message, a.status, a.created_at, a.sensor_data_id,
            sd.nitrogen AS actual_nitrogen,
            sd.phosphorus AS actual_phosphorus,
            sd.potassium AS actual_potassium,
            sd.soil_moisture AS actual_soil_moisture,
            sd.soil_temperature AS actual_soil_temperature,
            sd.soil_ph AS actual_soil_ph,
            sd.conductivity AS actual_conductivity,
            sd.air_temperature AS actual_air_temperature,
            sd.air_humidity AS actual_air_humidity,
            sd.light_intensity AS actual_light_intensity,
            sn.node_name AS sensor_node_name,
            sn.node_code,
            t.*,
            sr.screenhouse_name,
            sr.owner_user_id AS user_id
     FROM alerts a
     LEFT JOIN sensor_data sd ON sd.id = a.sensor_data_id
     LEFT JOIN sensor_nodes sn ON sn.id = a.sensor_node_id
     LEFT JOIN threshold_snapshots t ON t.screenhouse_id = a.screenhouse_id
     LEFT JOIN screenhouse_registry sr ON sr.screenhouse_id = a.screenhouse_id
     WHERE a.id = $1`,
    [alertId]
  );
  return enriched.rows[0] ?? null;
}

async function findActiveAlert({ screenhouseId, sensorNodeId, message }) {
  const result = await pool.query(
    `
    SELECT id FROM alerts
    WHERE screenhouse_id = $1
      AND sensor_node_id = $2
      AND message = $3
      AND status = 'active'
    LIMIT 1
    `,
    [screenhouseId, sensorNodeId, message]
  );
  return result.rows[0] ?? null;
}

/** Perbarui nilai aktual alert yang masih active — tanpa notifikasi baru. */
async function touchActiveAlert(alertId, sensorDataId) {
  await pool.query(`UPDATE alerts SET sensor_data_id = $1 WHERE id = $2`, [
    sensorDataId,
    alertId,
  ]);
}

/** Buat alert hanya jika belum ada yang active untuk kombinasi screenhouse + node + pesan. */
async function ensureAlert({ sensorDataId, screenhouseId, sensorNodeId, message }) {
  try {
    const result = await pool.query(
      `INSERT INTO alerts (sensor_data_id, screenhouse_id, sensor_node_id, message, status)
       VALUES ($1, $2, $3, $4, 'active') RETURNING id`,
      [sensorDataId, screenhouseId, sensorNodeId, message]
    );
    console.log("ALERT CREATED:", message);
    const row = await enrichAlert(result.rows[0].id);
    if (row) {
      await publishEvent(RK.ALERT_CREATED, row);
    }
    return true;
  } catch (err) {
    if (err.code !== "23505") throw err;

    const existing = await findActiveAlert({ screenhouseId, sensorNodeId, message });
    if (existing) {
      await touchActiveAlert(existing.id, sensorDataId);
    }
    console.log("ALERT already active (skipped notify):", message);
    return false;
  }
}

/** Tutup alert active otomatis bila parameter sudah kembali normal. */
async function resolveActiveAlertIfAny({ screenhouseId, sensorNodeId, message }) {
  const result = await pool.query(
    `
    UPDATE alerts
    SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP
    WHERE screenhouse_id = $1
      AND sensor_node_id = $2
      AND message = $3
      AND status = 'active'
    RETURNING id
    `,
    [screenhouseId, sensorNodeId, message]
  );
  if (!result.rows[0]) return false;

  console.log("ALERT auto-resolved:", message);
  const row = await enrichAlert(result.rows[0].id);
  if (row) {
    await publishEvent(RK.ALERT_RESOLVED, row);
  }
  return true;
}

/**
 * Handler untuk routing key `sensor.persisted`.
 *
 * Sengaja TIDAK berlangganan `sensor.raw`: alerts.sensor_data_id adalah foreign
 * key ke sensor_data(id), jadi evaluasi ambang baru boleh jalan setelah barisnya
 * benar-benar commit. Itulah alasan listener ini berada di hilir persistence,
 * bukan sejajar dengannya.
 */
async function handleSensorPersisted(event) {
  const { sensorDataId, screenhouseId, sensorNodeId, data: sensorData } = event;

  await resolveOfflineAlertsForNode(screenhouseId, sensorNodeId);

  if (DEBUG) console.log("Checking threshold...");

  const threshold = await getThresholdSnapshot(screenhouseId);
  if (!threshold) {
    if (DEBUG) console.log("Threshold snapshot tidak ditemukan");
    return;
  }

  const violations = [];
  const recoveries = [];

  for (const m of THRESHOLD_METRICS) {
    const value = sensorData[m.key];
    if (value == null) continue;

    const num = Number(value);
    const min = threshold[m.minCol] != null ? Number(threshold[m.minCol]) : null;
    const max = threshold[m.maxCol] != null ? Number(threshold[m.maxCol]) : null;
    const range = min != null && max != null ? max - min : null;
    const margin = range != null ? range * HYSTERESIS_RATIO : 0;
    const lowMsg = `${m.label} di bawah batas minimum`;
    const highMsg = `${m.label} melebihi batas maksimum`;

    const isLow = min != null && num < min;
    // Baru dianggap "pulih" (dan boleh resolve) setelah nilai jelas melewati
    // batas + margin, bukan cuma nyentuh batas — mencegah flap saat nilai
    // berosilasi tepat di garis min/max.
    const lowRecovered = min == null || num >= min + margin;

    const isHigh = max != null && num > max;
    const highRecovered = max == null || num <= max - margin;

    if (isLow) {
      violations.push({ key: m.key, direction: "low", label: m.label });
      await ensureAlert({ sensorDataId, screenhouseId, sensorNodeId, message: lowMsg });
    } else if (lowRecovered) {
      const resolved = await resolveActiveAlertIfAny({
        screenhouseId,
        sensorNodeId,
        message: lowMsg,
      });
      if (resolved) recoveries.push({ key: m.key, direction: "low", label: m.label });
    }

    if (isHigh) {
      violations.push({ key: m.key, direction: "high", label: m.label });
      await ensureAlert({ sensorDataId, screenhouseId, sensorNodeId, message: highMsg });
    } else if (highRecovered) {
      const resolved = await resolveActiveAlertIfAny({
        screenhouseId,
        sensorNodeId,
        message: highMsg,
      });
      if (resolved) recoveries.push({ key: m.key, direction: "high", label: m.label });
    }
  }

  if (isAutoActuatorEnabled(screenhouseId) && (violations.length || recoveries.length)) {
    // Aksi ON (violation) menang atas OFF (recovery) untuk aktuator yang sama
    // (mis. kipas dipakai bareng air_temperature & air_humidity) — kalau salah
    // satu masih melanggar, jangan sampai recovery parameter lain mematikannya.
    const actions = {
      ...resolveActuatorRecoveryActions(recoveries),
      ...resolveActuatorActions(violations),
    };
    if (Object.keys(actions).length) {
      try {
        const reason = [...violations, ...recoveries].map((v) => v.label).join(", ");
        await setActuators({
          screenhouseId: Number(screenhouseId),
          fan: actions.fan,
          irrigation: actions.irrigation,
          lamp: actions.lamp,
          source: "auto",
          reason: `Alert: ${reason}`,
        });
        console.log("[auto-actuator]", screenhouseId, actions);
      } catch (err) {
        console.error("[auto-actuator]", err.message);
      }
    }
  }
}

module.exports = {
  handleSensorPersisted,
  upsertThresholdSnapshot,
  upsertScreenhouseRegistry,
  checkOfflineNodes,
  consolidateAllOfflineDuplicates,
  ensureAlert,
  enrichAlert,
};
