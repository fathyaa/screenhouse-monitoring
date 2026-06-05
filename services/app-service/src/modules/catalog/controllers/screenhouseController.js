const pool = require("../../../config/db");
const monitoringPool = require("../../../config/monitoringDb");
const { monitoringGet } = require("../../../shared/monitoringClient");

async function countActiveDevices() {
  if (monitoringPool) {
    try {
      const result = await monitoringPool.query(
        `SELECT COUNT(*)::int AS device_count FROM sensor_nodes WHERE is_active = true`
      );
      return result.rows[0]?.device_count ?? 0;
    } catch (err) {
      console.error("[operator-stats] monitoring DB:", err.message);
    }
  }

  const stats = await monitoringGet("/stats/operator");
  return stats?.device_count ?? 0;
}

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
    const shResult = await pool.query(
      `SELECT COUNT(*)::int AS screenhouse_count FROM screenhouses WHERE status = 'active'`
    );

    const deviceCount = await countActiveDevices();

    res.json({
      screenhouse_count: shResult.rows[0]?.screenhouse_count ?? 0,
      device_count: deviceCount,
    });
  } catch (err) {
    console.error("[operator-stats]", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getMyDashboardStats(req, res) {
  try {
    const shResult = await pool.query(
      `
      SELECT COUNT(*)::int AS screenhouse_count
      FROM screenhouses
      WHERE owner_user_id = $1 AND status = 'active'
      `,
      [req.user.id]
    );

    const stats = await monitoringGet(`/stats/owner/${req.user.id}`);

    res.json({
      screenhouse_count: shResult.rows[0]?.screenhouse_count ?? 0,
      active_nodes: stats?.active_nodes ?? 0,
      active_sensors: stats?.active_sensors ?? 0,
      active_alerts: stats?.active_alerts ?? 0,
    });
  } catch (err) {
    console.error("[my-stats]", err);
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