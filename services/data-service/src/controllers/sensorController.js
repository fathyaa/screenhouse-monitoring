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

module.exports = {
  getSensorData,
};