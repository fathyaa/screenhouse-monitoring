const pool = require("../../../config/db");
const monitoringPool = require("../../../config/monitoringDb");
const { MAX_TRAY_COUNT, formatTrayCode } = require("../../../shared/provisionScreenhouse");

const MONITORING_UNAVAILABLE = {
  message: "Layanan monitoring tidak tersedia. Coba lagi setelah monitoring-service aktif.",
};

/** Rak bibit disimpan sebagai `sensor_nodes` di DB monitoring (1 rak = 1 alat pengukur). */
async function fetchTrays(screenhouseId) {
  const result = await monitoringPool.query(
    `
    SELECT
      sn.id,
      sn.node_code,
      sn.node_name,
      sn.is_active,
      sn.send_interval_seconds,
      sn.created_at,
      (
        SELECT MAX(sd.created_at)
        FROM sensor_data sd
        WHERE sd.sensor_node_id = sn.id
      ) AS last_reading_at
    FROM sensor_nodes sn
    WHERE sn.screenhouse_id = $1
    ORDER BY sn.id
    `,
    [screenhouseId]
  );
  return result.rows;
}

async function findScreenhouse(screenhouseId) {
  const result = await pool.query(
    `SELECT id, name, status, tray_count FROM screenhouses WHERE id = $1`,
    [screenhouseId]
  );
  return result.rows[0] ?? null;
}

/** Jaga `screenhouses.tray_count` (app DB) tetap sama dengan jumlah node nyata di monitoring DB. */
async function syncTrayCount(screenhouseId, trayCount) {
  const clamped = Math.min(Math.max(trayCount, 1), MAX_TRAY_COUNT);
  await pool.query(`UPDATE screenhouses SET tray_count = $1 WHERE id = $2`, [
    clamped,
    screenhouseId,
  ]);
  return clamped;
}

/**
 * Cari indeks tray bebas berikutnya. `node_code` unik global, jadi indeks dipilih
 * dari kode yang sudah dipakai screenhouse ini lalu diverifikasi ulang ke DB —
 * node gh01 yang didaftarkan sendiri oleh perangkat bisa punya pola kode lain.
 */
async function nextFreeTrayIndex(screenhouseId, existingCodes) {
  let index = 0;
  for (const code of existingCodes) {
    const match = String(code ?? "").match(/-T(\d+)$/i);
    if (match) index = Math.max(index, Number(match[1]));
  }

  for (let i = index + 1; i <= index + MAX_TRAY_COUNT + 1; i++) {
    const code = formatTrayCode(screenhouseId, i);
    const taken = await monitoringPool.query(
      `SELECT 1 FROM sensor_nodes WHERE node_code = $1`,
      [code]
    );
    if (!taken.rows[0]) return { index: i, code };
  }

  return null;
}

async function listScreenhouseTrays(req, res) {
  const screenhouseId = Number(req.params.id);
  if (!Number.isInteger(screenhouseId)) {
    return res.status(400).json({ message: "ID screenhouse tidak valid" });
  }
  if (!monitoringPool) {
    return res.status(503).json(MONITORING_UNAVAILABLE);
  }

  try {
    const screenhouse = await findScreenhouse(screenhouseId);
    if (!screenhouse) {
      return res.status(404).json({ message: "Screenhouse tidak ditemukan" });
    }

    const trays = await fetchTrays(screenhouseId);
    res.json({
      screenhouse: {
        id: screenhouse.id,
        name: screenhouse.name,
        status: screenhouse.status,
        tray_count: screenhouse.tray_count,
      },
      max_tray_count: MAX_TRAY_COUNT,
      trays,
    });
  } catch (err) {
    console.error("[admin-tray:list]", err);
    res.status(500).json({ message: "Gagal memuat daftar rak bibit" });
  }
}

async function createScreenhouseTray(req, res) {
  const screenhouseId = Number(req.params.id);
  if (!Number.isInteger(screenhouseId)) {
    return res.status(400).json({ message: "ID screenhouse tidak valid" });
  }
  if (!monitoringPool) {
    return res.status(503).json(MONITORING_UNAVAILABLE);
  }

  const rawName = typeof req.body?.node_name === "string" ? req.body.node_name.trim() : "";
  if (rawName.length > 50) {
    return res.status(400).json({ message: "Nama rak bibit maksimal 50 karakter" });
  }

  try {
    const screenhouse = await findScreenhouse(screenhouseId);
    if (!screenhouse) {
      return res.status(404).json({ message: "Screenhouse tidak ditemukan" });
    }

    // sensor_nodes.screenhouse_id punya FK ke screenhouse_registry — screenhouse
    // yang belum diaktifkan belum punya baris registry, jadi tolak lebih awal
    // dengan pesan yang bisa ditindaklanjuti admin.
    const registry = await monitoringPool.query(
      `SELECT 1 FROM screenhouse_registry WHERE screenhouse_id = $1`,
      [screenhouseId]
    );
    if (!registry.rows[0]) {
      return res.status(409).json({
        message:
          "Screenhouse belum diaktifkan, jadi belum punya perangkat monitoring. Setujui/aktifkan screenhouse dulu.",
      });
    }

    const existing = await fetchTrays(screenhouseId);
    if (existing.length >= MAX_TRAY_COUNT) {
      return res
        .status(400)
        .json({ message: `Maksimal ${MAX_TRAY_COUNT} rak bibit per screenhouse` });
    }

    const slot = await nextFreeTrayIndex(
      screenhouseId,
      existing.map((t) => t.node_code)
    );
    if (!slot) {
      return res.status(409).json({ message: "Tidak ada kode alat pengukur yang tersedia" });
    }

    const nodeName = rawName || `Rak bibit ${slot.index}`;
    const inserted = await monitoringPool.query(
      `
      INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, send_interval_seconds, is_active)
      VALUES ($1, $2, $3, 60, true)
      ON CONFLICT (node_code) DO NOTHING
      RETURNING id, node_code, node_name, is_active, send_interval_seconds, created_at
      `,
      [screenhouseId, slot.code, nodeName]
    );

    if (!inserted.rows[0]) {
      return res
        .status(409)
        .json({ message: "Kode alat pengukur sudah dipakai, coba tambah sekali lagi" });
    }

    const trayCount = await syncTrayCount(screenhouseId, existing.length + 1);

    res.status(201).json({
      message: "Rak bibit ditambahkan",
      tray: { ...inserted.rows[0], last_reading_at: null },
      tray_count: trayCount,
    });
  } catch (err) {
    console.error("[admin-tray:create]", err);
    res.status(500).json({ message: "Gagal menambah rak bibit" });
  }
}

/**
 * Hapus satu rak bibit beserta seluruh data turunannya di DB monitoring.
 * Tidak ada ON DELETE CASCADE, jadi urutannya alerts → sensor_data → sensor_nodes.
 * Alert bisa menunjuk sensor_data node ini tanpa sensor_node_id, jadi keduanya dicakup.
 */
async function deleteScreenhouseTray(req, res) {
  const screenhouseId = Number(req.params.id);
  const nodeId = Number(req.params.nodeId);
  if (!Number.isInteger(screenhouseId) || !Number.isInteger(nodeId)) {
    return res.status(400).json({ message: "ID tidak valid" });
  }
  if (!monitoringPool) {
    return res.status(503).json(MONITORING_UNAVAILABLE);
  }

  try {
    const screenhouse = await findScreenhouse(screenhouseId);
    if (!screenhouse) {
      return res.status(404).json({ message: "Screenhouse tidak ditemukan" });
    }

    const existing = await fetchTrays(screenhouseId);
    const target = existing.find((t) => t.id === nodeId);
    if (!target) {
      return res.status(404).json({ message: "Rak bibit tidak ditemukan di screenhouse ini" });
    }
    if (existing.length <= 1) {
      return res.status(400).json({
        message:
          "Screenhouse harus punya minimal 1 rak bibit. Hapus screenhouse-nya bila memang tidak dipakai.",
      });
    }

    const client = await monitoringPool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `
        DELETE FROM alerts
        WHERE sensor_node_id = $1
           OR sensor_data_id IN (SELECT id FROM sensor_data WHERE sensor_node_id = $1)
        `,
        [nodeId]
      );
      await client.query(`DELETE FROM sensor_data WHERE sensor_node_id = $1`, [nodeId]);
      await client.query(`DELETE FROM sensor_nodes WHERE id = $1 AND screenhouse_id = $2`, [
        nodeId,
        screenhouseId,
      ]);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    const trayCount = await syncTrayCount(screenhouseId, existing.length - 1);

    res.json({
      message: "Rak bibit dihapus",
      id: nodeId,
      node_name: target.node_name,
      tray_count: trayCount,
    });
  } catch (err) {
    console.error("[admin-tray:delete]", err);
    res.status(500).json({ message: "Gagal menghapus rak bibit" });
  }
}

module.exports = {
  listScreenhouseTrays,
  createScreenhouseTray,
  deleteScreenhouseTray,
};
