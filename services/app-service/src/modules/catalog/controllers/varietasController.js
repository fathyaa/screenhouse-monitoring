const pool = require("../../../config/db");

async function listVarietasBibit(req, res) {
  try {
    const result = await pool.query(
      `
      SELECT
        id, nama, nitrogen_min, nitrogen_max, phosphorus_min, phosphorus_max,
        potassium_min, potassium_max, moisture_min, moisture_max,
        soil_ph_min, soil_ph_max, durasi_pembibitan_hari, deskripsi, sumber_referensi
      FROM varietas_bibit
      ORDER BY nama ASC
      `
    );
    res.json(result.rows);
  } catch (err) {
    console.error("[varietas-bibit]", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getVarietasBibitById(req, res) {
  try {
    const result = await pool.query(`SELECT * FROM varietas_bibit WHERE id = $1`, [
      req.params.id,
    ]);
    if (!result.rows[0]) {
      return res.status(404).json({ message: "Varietas tidak ditemukan" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[varietas-bibit]", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = { listVarietasBibit, getVarietasBibitById };
