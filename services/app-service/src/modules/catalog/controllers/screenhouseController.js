const pool = require("../../../config/db");
const monitoringPool = require("../../../config/monitoringDb");
const { monitoringGet } = require("../../../shared/monitoringClient");
const {
  parseTrayCount,
  activateScreenhouseRecord,
  postActivationProvisioning,
} = require("../../../shared/provisionScreenhouse");

async function activateScreenhouse(client, screenhouseId, trayCountOverride = null) {
  return activateScreenhouseRecord(client, screenhouseId, trayCountOverride);
}

const ONLINE_SINK_EXISTS = `
  EXISTS (
    SELECT 1
    FROM sensor_nodes sn
    INNER JOIN sensor_data sd ON sd.sensor_node_id = sn.id
    WHERE sn.screenhouse_id = sk.screenhouse_id
      AND sn.is_active = true
      AND sd.created_at >= NOW() - (
        GREATEST(GREATEST(COALESCE(sn.send_interval_seconds, 60), 60) * 3, 900)
        || ' seconds'
      )::interval
  )
`;

async function getOperatorMonitoringStats() {
  const query = `
    SELECT
      (SELECT COUNT(*)::int FROM sink_nodes WHERE is_active = true) AS sink_node_count,
      (SELECT COUNT(*)::int
         FROM sink_nodes sk
         INNER JOIN screenhouse_registry sr
           ON sr.screenhouse_id = sk.screenhouse_id AND sr.status = 'active'
         WHERE sk.is_active = true
           AND ${ONLINE_SINK_EXISTS}) AS online_sink_node_count
  `;

  if (monitoringPool) {
    try {
      const result = await monitoringPool.query(query);
      return result.rows[0] ?? { sink_node_count: 0, online_sink_node_count: 0 };
    } catch (err) {
      console.error("[operator-stats] monitoring DB:", err.message);
    }
  }

  const stats = await monitoringGet("/stats/operator");
  return {
    sink_node_count: stats?.sink_node_count ?? 0,
    online_sink_node_count: stats?.online_sink_node_count ?? 0,
  };
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

    const sinkStats = await getOperatorMonitoringStats();

    res.json({
      screenhouse_count: shResult.rows[0]?.screenhouse_count ?? 0,
      sink_node_count: sinkStats.sink_node_count ?? 0,
      online_sink_node_count: sinkStats.online_sink_node_count ?? 0,
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
      tray_count,
    } = req.body;

    const parsedTrayCount = parseTrayCount(tray_count, 1);
    if (parsedTrayCount == null) {
      return res.status(400).json({ message: "Jumlah tray harus bilangan bulat antara 1 dan 20" });
    }

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
        tray_count,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
      RETURNING id, name, status, tray_count, created_at
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
        parsedTrayCount,
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
        s.tray_count,
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
    const trayOverride = req.body?.tray_count != null ? parseTrayCount(req.body.tray_count) : null;
    if (req.body?.tray_count != null && trayOverride == null) {
      return res.status(400).json({ message: "Jumlah tray harus bilangan bulat antara 1 dan 20" });
    }

    await client.query("BEGIN");

    const check = await client.query(
      `
      SELECT s.id, s.tray_count, u.status AS owner_status
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

    const effectiveTray = trayOverride ?? check.rows[0].tray_count ?? 1;
    const activated = await activateScreenhouse(client, id, effectiveTray);

    if (!activated) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Gagal mengaktifkan screenhouse" });
    }

    await client.query("COMMIT");

    await postActivationProvisioning(activated);

    res.json({
      message: "Screenhouse disetujui dan aktif",
      screenhouse_id: id,
      tray_count: activated.tray_count,
    });
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