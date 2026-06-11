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

      WHERE s.status = 'active'

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

async function getScreenhouseById(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        s.id,
        s.name,
        s.address_detail,
        s.latitude,
        s.longitude,
        s.status,
        u.name AS owner_name,
        u.phone_number AS owner_phone,
        p.name AS province,
        r.name AS regency,
        d.name AS district,
        v.name AS village
      FROM screenhouses s
      JOIN provinces p ON s.province_id = p.id
      JOIN regencies r ON s.regency_id = r.id
      JOIN districts d ON s.district_id = d.id
      JOIN villages v ON s.village_id = v.id
      LEFT JOIN users u ON s.owner_user_id = u.id
      WHERE s.id = $1
      `,
      [id]
    );

    const row = result.rows[0];

    if (!row) {
      return res.status(404).json({ message: "Screenhouse tidak ditemukan" });
    }

    if (req.user.role === "petani") {
      const ownerCheck = await pool.query(
        `SELECT 1 FROM screenhouses WHERE id = $1 AND owner_user_id = $2`,
        [id, req.user.id]
      );
      if (!ownerCheck.rows[0]) {
        return res.status(403).json({ message: "Akses ditolak" });
      }
    }

    res.json(row);
  } catch (err) {
    console.log(err);

    res.status(500).json({
      message: "Internal server error",
    });
  }
}

async function getOperatorStats(req, res) {
  try {
    const result = await pool.query(
      `
      SELECT
        COUNT(DISTINCT s.id)::int AS screenhouse_count,
        COUNT(sn.id) FILTER (WHERE sn.is_active = true)::int AS device_count
      FROM screenhouses s
      LEFT JOIN sensor_nodes sn ON sn.screenhouse_id = s.id
      WHERE s.status = 'active'
      `
    );

    const row = result.rows[0] || {};
    res.json({
      screenhouse_count: row.screenhouse_count ?? 0,
      device_count: row.device_count ?? 0,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getMyDashboardStats(req, res) {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `
      SELECT
        COUNT(DISTINCT s.id)::int AS screenhouse_count,
        COUNT(sn.id) FILTER (WHERE sn.is_active = true)::int AS active_nodes,
        COUNT(DISTINCT sn.id) FILTER (
          WHERE sn.is_active = true
            AND EXISTS (
              SELECT 1
              FROM sensor_data sd
              WHERE sd.sensor_node_id = sn.id
                AND sd.created_at >= NOW() - INTERVAL '24 hours'
            )
        )::int AS active_sensors,
        (
          SELECT COUNT(*)::int
          FROM alerts a
          JOIN screenhouses sh2 ON sh2.id = a.screenhouse_id
          WHERE sh2.owner_user_id = $1 AND a.status = 'active'
        ) AS active_alerts
      FROM screenhouses s
      LEFT JOIN sensor_nodes sn ON sn.screenhouse_id = s.id
      WHERE s.owner_user_id = $1
      `,
      [userId]
    );

    const row = result.rows[0] || {};
    res.json({
      screenhouse_count: row.screenhouse_count ?? 0,
      active_nodes: row.active_nodes ?? 0,
      active_sensors: row.active_sensors ?? 0,
      active_alerts: row.active_alerts ?? 0,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  createScreenhouse,
  getScreenhouses,
  getMyScreenhouses,
  getOperatorStats,
  getMyDashboardStats,
  getScreenhouseById,
};