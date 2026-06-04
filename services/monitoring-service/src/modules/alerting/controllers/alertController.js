const pool = require("../../../config/db");

async function getAlerts(req, res) {
  try {
    const result = await pool.query(
      `
      SELECT
        a.id,
        a.screenhouse_id,
        a.sensor_node_id,
        a.message,
        a.status,
        a.created_at,
        a.sensor_data_id,

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

        t.min_nitrogen, t.max_nitrogen,
        t.min_phosphorus, t.max_phosphorus,
        t.min_potassium, t.max_potassium,
        t.min_soil_moisture, t.max_soil_moisture,
        t.min_soil_temperature, t.max_soil_temperature,
        t.min_soil_ph, t.max_soil_ph,
        t.min_conductivity, t.max_conductivity,
        t.min_air_temperature, t.max_air_temperature,
        t.min_air_humidity, t.max_air_humidity,
        t.min_light_intensity, t.max_light_intensity,

        sr.screenhouse_name

      FROM alerts a
      LEFT JOIN sensor_data sd ON sd.id = a.sensor_data_id
      LEFT JOIN sensor_nodes sn ON sn.id = a.sensor_node_id
      LEFT JOIN threshold_snapshots t ON t.screenhouse_id = a.screenhouse_id
      LEFT JOIN screenhouse_registry sr ON sr.screenhouse_id = a.screenhouse_id
      WHERE sr.owner_user_id = $1
      ORDER BY a.created_at DESC
      `,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function resolveAlert(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      UPDATE alerts a
      SET status = 'resolved'
      FROM screenhouse_registry sr
      WHERE a.id = $1
        AND a.screenhouse_id = sr.screenhouse_id
        AND sr.owner_user_id = $2
      RETURNING a.*
      `,
      [id, req.user.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: "Alert tidak ditemukan" });
    }

    res.json({
      message: "Alert resolved",
      alert: result.rows[0],
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  getAlerts,
  resolveAlert,
};
