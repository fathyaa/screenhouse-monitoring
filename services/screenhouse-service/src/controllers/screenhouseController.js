const pool = require("../db");

async function createScreenhouse(req, res) {
  try {
    const {
      name,
      province_id,
      regency_id,
      district_id,
      village_id,
      owner_user_id,
      address_detail,
      latitude,
      longitude,
    } = req.body;

    console.log("FULL BODY:", req.body);

    const result = await pool.query(
      `
      INSERT INTO screenhouses (
        name,
        province_id,
        regency_id,
        district_id,
        village_id,
        owner_user_id,
        address_detail,
        latitude,
        longitude
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      )
      RETURNING *
      `,
      [
        name,
        province_id,
        regency_id,
        district_id,
        village_id,
        owner_user_id,
        address_detail,
        latitude,
        longitude,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.log(err);

    res.status(500).json({
      message: "Internal server error",
    });
  }
}

async function getScreenhouses(req, res) {
  try {
    const result = await pool.query(`
      SELECT
        s.id,
        s.name,
        s.address_detail,
        u.name AS owner_name,

        s.latitude,
        s.longitude,

        s.status,

        p.name AS province,
        r.name AS regency,
        d.name AS district,
        v.name AS village

      FROM screenhouses s

      JOIN provinces p
      ON s.province_id = p.id

      JOIN regencies r
      ON s.regency_id = r.id

      JOIN districts d
      ON s.district_id = d.id

      JOIN villages v
      ON s.village_id = v.id

      JOIN users u
      ON s.owner_user_id = u.id

      ORDER BY s.id DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.log(err);

    res.status(500).json({
      message: "Internal server error",
    });
  }
}

async function getMyScreenhouses(
  req,
  res
) {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `
      SELECT
        s.id,
        s.name,

        s.address_detail,

        s.latitude,
        s.longitude,

        p.name AS province,
        r.name AS regency,
        d.name AS district,
        v.name AS village

      FROM screenhouses s

      JOIN provinces p
      ON s.province_id = p.id

      JOIN regencies r
      ON s.regency_id = r.id

      JOIN districts d
      ON s.district_id = d.id

      JOIN villages v
      ON s.village_id = v.id

      WHERE s.owner_user_id = $1

      ORDER BY s.id DESC
      `,
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.log(err);

    res.status(500).json({
      message: "Internal server error",
    });
  }
}

module.exports = {
  createScreenhouse,
  getScreenhouses,
  getMyScreenhouses,
};