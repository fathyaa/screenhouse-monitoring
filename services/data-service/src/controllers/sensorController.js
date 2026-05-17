const pool = require("../db");

async function getSensorData(req, res) {
  try {
    const result = await pool.query(`
      SELECT *
      FROM sensor_data
      ORDER BY created_at DESC
      LIMIT 50
    `);

    res.json(result.rows);
  } catch (err) {
    console.log(err);

    res.status(500).json({
      message: "Internal server error",
    });
  }
}

async function getLatestSensorData(
  req,
  res
) {
  try {

    const {
      screenhouseId,
    } = req.params;

    const result =
      await pool.query(
        `
        SELECT *
        FROM sensor_data
        WHERE screenhouse_id = $1
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [screenhouseId]
      );

    res.json(result.rows[0]);

  } catch (err) {

    console.log(err);

    res.status(500).json({
      message:
        "Internal server error",
    });

  }
}

module.exports = {
  getLatestSensorData,
  getSensorData,
};