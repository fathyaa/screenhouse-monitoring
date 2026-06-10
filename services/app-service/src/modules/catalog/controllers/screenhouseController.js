const pool = require("../../../config/db");
const monitoringPool = require("../../../config/monitoringDb");
const { monitoringGet } = require("../../../shared/monitoringClient");

const DEFAULT_THRESHOLD = [
  20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000,
];

async function insertDefaultThreshold(client, screenhouseId) {
  await client.query(
    `
    INSERT INTO thresholds (
      screenhouse_id,
      min_nitrogen, max_nitrogen,
      min_phosphorus, max_phosphorus,
      min_potassium, max_potassium,
      min_soil_moisture, max_soil_moisture,
      min_soil_temperature, max_soil_temperature,
      min_soil_ph, max_soil_ph,
      min_conductivity, max_conductivity,
      min_air_temperature, max_air_temperature,
      min_air_humidity, max_air_humidity,
      min_light_intensity, max_light_intensity
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
    ON CONFLICT (screenhouse_id) DO NOTHING
    `,
    [screenhouseId, ...DEFAULT_THRESHOLD]
  );
}

async function activateScreenhouse(client, screenhouseId) {
  const result = await client.query(
    `
    UPDATE screenhouses
    SET status = 'active'
    WHERE id = $1 AND status = 'pending'
    RETURNING id
    `,
    [screenhouseId]
  );

  if (result.rows[0]) {
    await insertDefaultThreshold(client, screenhouseId);
  }

  return result.rows[0] ?? null;
}

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
        s.status,

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

    const rows = result.rows;
    const ids = rows.map((r) => r.id);
    let nodeCountById = {};

    if (ids.length > 0) {
      if (monitoringPool) {
        try {
          const counts = await monitoringPool.query(
            `
            SELECT screenhouse_id, COUNT(*)::int AS node_count
            FROM sensor_nodes
            WHERE screenhouse_id = ANY($1::int[])
            GROUP BY screenhouse_id
            `,
            [ids]
          );
          nodeCountById = Object.fromEntries(
            counts.rows.map((c) => [c.screenhouse_id, c.node_count])
          );
        } catch (err) {
          console.error("[my-screenhouses] node counts:", err.message);
        }
      } else {
        const counts = await monitoringGet(
          `/stats/node-counts?screenhouseIds=${ids.join(",")}`,
          []
        );
        if (Array.isArray(counts)) {
          nodeCountById = Object.fromEntries(
            counts.map((c) => [c.screenhouse_id, c.node_count])
          );
        }
      }
    }

    res.json(
      rows.map((s) => ({
        ...s,
        node_count: nodeCountById[s.id] ?? 0,
      }))
    );
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
      online_nodes: stats?.online_nodes ?? stats?.active_sensors ?? 0,
      offline_nodes: stats?.offline_nodes ?? 0,
      active_sensors: stats?.online_nodes ?? stats?.active_sensors ?? 0,
      active_alerts: stats?.active_alerts ?? 0,
    });
  } catch (err) {
    console.error("[my-stats]", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function submitMyScreenhouse(req, res) {
  try {
    const userId = req.user.id;

    const userResult = await pool.query(
      `SELECT id, status FROM users WHERE id = $1 AND role = 'petani'`,
      [userId]
    );
    const user = userResult.rows[0];

    if (!user) {
      return res.status(403).json({ message: "Hanya petani yang dapat mengajukan screenhouse" });
    }

    if (user.status !== "approved") {
      return res.status(403).json({
        message: "Akun belum disetujui operator. Selesaikan pendaftaran awal terlebih dahulu.",
      });
    }

    const {
      name,
      province_id,
      regency_id,
      district_id,
      village_id,
      address_detail,
      latitude,
      longitude,
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ message: "Nama screenhouse wajib diisi" });
    }

    for (const field of ["province_id", "regency_id", "district_id", "village_id"]) {
      if (!req.body[field]) {
        return res.status(400).json({ message: "Wilayah screenhouse wajib dipilih lengkap" });
      }
    }

    if (latitude == null || longitude == null) {
      return res.status(400).json({ message: "Titik lokasi screenhouse wajib dipilih di peta" });
    }

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
        longitude,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
      RETURNING id, name, status, created_at
      `,
      [
        name.trim(),
        province_id,
        regency_id,
        district_id,
        village_id,
        userId,
        address_detail?.trim() || null,
        Number(latitude),
        Number(longitude),
      ]
    );

    res.status(201).json({
      message: "Pengajuan screenhouse terkirim. Menunggu persetujuan operator.",
      screenhouse: result.rows[0],
    });
  } catch (err) {
    console.error("[submit-my-screenhouse]", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getPendingScreenhouses(req, res) {
  try {
    const result = await pool.query(
      `
      SELECT
        s.id,
        s.name,
        s.address_detail,
        s.latitude,
        s.longitude,
        s.status,
        s.created_at,
        u.id AS owner_id,
        u.name AS owner_name,
        u.phone_number AS owner_phone,
        p.name AS province,
        r.name AS regency,
        d.name AS district,
        v.name AS village
      FROM screenhouses s
      JOIN users u ON u.id = s.owner_user_id
      JOIN provinces p ON s.province_id = p.id
      JOIN regencies r ON s.regency_id = r.id
      JOIN districts d ON s.district_id = d.id
      JOIN villages v ON s.village_id = v.id
      WHERE s.status = 'pending' AND u.status = 'approved'
      ORDER BY s.created_at DESC
      `
    );

    res.json(result.rows);
  } catch (err) {
    console.error("[pending-screenhouses]", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getPendingScreenhouseStats(req, res) {
  try {
    const result = await pool.query(
      `
      SELECT COUNT(*)::int AS pending
      FROM screenhouses s
      JOIN users u ON u.id = s.owner_user_id
      WHERE s.status = 'pending' AND u.status = 'approved'
      `
    );

    res.json({ pending: result.rows[0]?.pending ?? 0 });
  } catch (err) {
    console.error("[pending-screenhouse-stats]", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function approveScreenhouse(req, res) {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    await client.query("BEGIN");

    const check = await client.query(
      `
      SELECT s.id, u.status AS owner_status
      FROM screenhouses s
      JOIN users u ON u.id = s.owner_user_id
      WHERE s.id = $1 AND s.status = 'pending'
      `,
      [id]
    );

    if (!check.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Screenhouse tidak ditemukan atau sudah diproses" });
    }

    if (check.rows[0].owner_status !== "approved") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Screenhouse ini bagian pendaftaran petani baru. Setujui lewat approval petani.",
      });
    }

    const activated = await activateScreenhouse(client, id);

    if (!activated) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Gagal mengaktifkan screenhouse" });
    }

    await client.query("COMMIT");

    res.json({ message: "Screenhouse disetujui dan aktif", screenhouse_id: id });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[approve-screenhouse]", err);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
}

async function rejectScreenhouse(req, res) {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    await client.query("BEGIN");

    const check = await client.query(
      `
      SELECT s.id, u.status AS owner_status
      FROM screenhouses s
      JOIN users u ON u.id = s.owner_user_id
      WHERE s.id = $1 AND s.status = 'pending'
      `,
      [id]
    );

    if (!check.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Screenhouse tidak ditemukan atau sudah diproses" });
    }

    if (check.rows[0].owner_status !== "approved") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Screenhouse ini bagian pendaftaran petani baru. Tolak lewat approval petani.",
      });
    }

    await client.query(`DELETE FROM screenhouses WHERE id = $1 AND status = 'pending'`, [id]);

    await client.query("COMMIT");

    res.json({ message: "Pengajuan screenhouse ditolak" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[reject-screenhouse]", err);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
}

module.exports = {
  createScreenhouse,
  getScreenhouses,
  getMyScreenhouses,
  getOperatorStats,
  getMyDashboardStats,
  getScreenhouseById,
  submitMyScreenhouse,
  getPendingScreenhouses,
  getPendingScreenhouseStats,
  approveScreenhouse,
  rejectScreenhouse,
};