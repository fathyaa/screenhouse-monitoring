const pool =
  require("../db");

async function getAlerts(
  req,
  res
) {

  try {
    const result =
  await pool.query(
    `
    SELECT
      a.id,
      a.screenhouse_id,
      a.message,
      a.status,
      a.created_at,
      a.sensor_data_id,

      sd.nitrogen   AS actual_nitrogen,
      sd.phosphorus AS actual_phosphorus,
      sd.potassium  AS actual_potassium,
      sd.moisture   AS actual_moisture,

      t.min_nitrogen,
      t.max_nitrogen,

      t.min_phosphorus,
      t.max_phosphorus,

      t.min_potassium,
      t.max_potassium,

      t.min_moisture,
      t.max_moisture,

      sh.name AS screenhouse_name

    FROM alerts a

    LEFT JOIN sensor_data sd
      ON sd.id = a.sensor_data_id

    LEFT JOIN thresholds t
      ON t.screenhouse_id = a.screenhouse_id

    LEFT JOIN screenhouses sh
      ON sh.id = a.screenhouse_id

    WHERE sh.owner_user_id = $1

    ORDER BY a.created_at DESC
    `,
    [req.user.id]
  );
    
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

async function resolveAlert(req, res) {
  try {

    const { id } = req.params;

    const result =
      await pool.query(
        `
        UPDATE alerts
        SET status = 'resolved'
        WHERE id = $1
        RETURNING *
        `,
        [id]
      );

    if (!result.rows[0]) {
      return res.status(404).json({
        message: "Alert tidak ditemukan",
      });
    }

    res.json({
      message: "Alert resolved",
      alert: result.rows[0],
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      message: "Internal server error",
    });

  }
}

module.exports = {
  getAlerts,
  resolveAlert
};