const pool = require("../../../config/db");
const { resolveVarietasId, upsertThresholdFromVarietas } = require("../../../shared/varietasThreshold");
const { publishEvent, RK } = require("../../../shared/events/publisher");
const { buildEstimasiTanam } = require("../../../shared/estimasiTanamService");
const {
  addCalendarDays,
  wibDateStr,
  TARGET_OPTIMAL_HSS,
} = require("../../../shared/estimasiTanam");
const { buildCycleAnalytics } = require("../../../shared/cycleAnalyticsService");

async function assertPetaniOwnsScreenhouse(client, screenhouseId, userId) {
  const result = await client.query(
    `SELECT id, name, status FROM screenhouses WHERE id = $1 AND owner_user_id = $2`,
    [screenhouseId, userId]
  );
  return result.rows[0] ?? null;
}

async function getActiveCycle(client, screenhouseId) {
  const result = await client.query(
    `
    SELECT sc.*, sh.name AS screenhouse_name
    FROM semai_cycles sc
    INNER JOIN screenhouses sh ON sh.id = sc.screenhouse_id
    WHERE sc.screenhouse_id = $1 AND sc.status = 'active'
    LIMIT 1
    `,
    [screenhouseId]
  );
  return result.rows[0] ?? null;
}

async function syncScreenhouseFromCycle(client, screenhouseId, cycle, estimasi) {
  await client.query(
    `
    UPDATE screenhouses
    SET varietas_id = $2,
        seed_variety = $3,
        tanggal_semai = $4::date,
        seedling_start_date = $4::date,
        estimasi_siap_tanam = $5::date,
        status_estimasi = $6
    WHERE id = $1
    `,
    [
      screenhouseId,
      cycle.varietas_id,
      cycle.varietas_nama,
      cycle.tanggal_mulai,
      estimasi?.estimasi_siap ?? cycle.estimasi_siap,
      estimasi?.status ?? null,
    ]
  );
}

async function clearScreenhouseCycleFields(client, screenhouseId) {
  await client.query(
    `
    UPDATE screenhouses
    SET varietas_id = NULL,
        seed_variety = NULL,
        tanggal_semai = NULL,
        seedling_start_date = NULL,
        estimasi_siap_tanam = NULL,
        status_estimasi = NULL
    WHERE id = $1
    `,
    [screenhouseId]
  );
}

async function startSemaiCycle(req, res) {
  const client = await pool.connect();
  try {
    const screenhouseId = Number(req.params.id);
    const { varietas_id, tanggal_mulai } = req.body ?? {};

    if (!varietas_id) {
      return res.status(400).json({ message: "Varietas bibit wajib dipilih" });
    }
    if (!tanggal_mulai) {
      return res.status(400).json({ message: "Tanggal mulai semai wajib diisi" });
    }

    const tanggalMulai = String(tanggal_mulai).slice(0, 10);

    await client.query("BEGIN");

    const sh = await assertPetaniOwnsScreenhouse(client, screenhouseId, req.user.id);
    if (!sh) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Screenhouse tidak ditemukan" });
    }
    if (sh.status !== "active") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Screenhouse belum aktif" });
    }

    const existing = await getActiveCycle(client, screenhouseId);
    if (existing) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message:
          "Masih ada siklus semai aktif. Akhiri siklus saat ini terlebih dahulu sebelum memulai yang baru.",
        active_cycle_id: existing.id,
      });
    }

    const varietas = await resolveVarietasId(client, varietas_id);
    // Jendela tanam sama untuk semua varietas: target awal = 18 HSS (target optimal).
    const estimasiSiap = addCalendarDays(tanggalMulai, TARGET_OPTIMAL_HSS);

    const inserted = await client.query(
      `
      INSERT INTO semai_cycles (
        screenhouse_id, varietas_id, varietas_nama,
        tanggal_mulai, estimasi_siap, durasi_target_hari, status
      )
      VALUES ($1, $2, $3, $4::date, $5::date, $6, 'active')
      RETURNING *
      `,
      [
        screenhouseId,
        varietas.id,
        varietas.nama,
        tanggalMulai,
        estimasiSiap,
        TARGET_OPTIMAL_HSS,
      ]
    );

    const cycle = inserted.rows[0];

    const tCheck = await client.query(
      `SELECT manual_override FROM thresholds WHERE screenhouse_id = $1`,
      [screenhouseId]
    );
    if (!tCheck.rows[0]?.manual_override) {
      const payload = await upsertThresholdFromVarietas(client, screenhouseId, varietas, {
        manualOverride: false,
      });
      await publishEvent(RK.CONFIG_THRESHOLD, payload);
    }

    await syncScreenhouseFromCycle(client, screenhouseId, cycle, {
      estimasi_siap: estimasiSiap,
      status: "on_track",
    });

    await client.query("COMMIT");

    let estimasi = null;
    try {
      estimasi = await buildEstimasiTanam(screenhouseId, { persist: true });
      if (estimasi?.estimasi_siap) {
        await pool.query(
          `UPDATE semai_cycles SET estimasi_siap = $2::date, updated_at = NOW() WHERE id = $1`,
          [cycle.id, estimasi.estimasi_siap]
        );
      }
    } catch (err) {
      console.error("[start-cycle] estimasi:", err.message);
    }

    res.status(201).json({
      ...cycle,
      estimasi_siap: estimasi?.estimasi_siap ?? cycle.estimasi_siap,
      estimasi,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.status === 400) {
      return res.status(400).json({ message: err.message });
    }
    console.error("[start-cycle]", err);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
}

async function endSemaiCycle(req, res) {
  const client = await pool.connect();
  try {
    const screenhouseId = Number(req.params.id);
    const { tanggal_selesai, catatan } = req.body ?? {};
    const endDate = tanggal_selesai ? String(tanggal_selesai).slice(0, 10) : wibDateStr();

    await client.query("BEGIN");

    const sh = await assertPetaniOwnsScreenhouse(client, screenhouseId, req.user.id);
    if (!sh) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Screenhouse tidak ditemukan" });
    }

    const cycle = await getActiveCycle(client, screenhouseId);
    if (!cycle) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Tidak ada siklus semai aktif" });
    }

    const cycleForAnalytics = { ...cycle, tanggal_selesai: endDate };
    const analytics = await buildCycleAnalytics(cycleForAnalytics);
    const grade = analytics.grade?.letter ?? null;

    const updated = await client.query(
      `
      UPDATE semai_cycles
      SET tanggal_selesai = $2::date,
          status = 'completed',
          grade = $3,
          analytics = $4::jsonb,
          catatan = $5,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [cycle.id, endDate, grade, JSON.stringify(analytics), catatan?.trim?.() || null]
    );

    await clearScreenhouseCycleFields(client, screenhouseId);
    await client.query("COMMIT");

    res.json({
      ...updated.rows[0],
      analytics,
      screenhouse_name: sh.name,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[end-cycle]", err);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
}

async function listScreenhouseCycles(req, res) {
  try {
    const screenhouseId = Number(req.params.id);

    if (req.user.role === "petani") {
      const allowed = await pool.query(
        `SELECT 1 FROM screenhouses WHERE id = $1 AND owner_user_id = $2`,
        [screenhouseId, req.user.id]
      );
      if (!allowed.rows[0]) {
        return res.status(403).json({ message: "Akses ditolak" });
      }
    }

    const result = await pool.query(
      `
      SELECT
        sc.*,
        sh.name AS screenhouse_name
      FROM semai_cycles sc
      INNER JOIN screenhouses sh ON sh.id = sc.screenhouse_id
      WHERE sc.screenhouse_id = $1
      ORDER BY sc.tanggal_mulai DESC, sc.id DESC
      `,
      [screenhouseId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("[list-cycles]", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getSemaiCycleById(req, res) {
  try {
    const screenhouseId = Number(req.params.id);
    const cycleId = Number(req.params.cycleId);

    const result = await pool.query(
      `
      SELECT sc.*, sh.name AS screenhouse_name
      FROM semai_cycles sc
      INNER JOIN screenhouses sh ON sh.id = sc.screenhouse_id
      WHERE sc.id = $1 AND sc.screenhouse_id = $2
      `,
      [cycleId, screenhouseId]
    );

    const cycle = result.rows[0];
    if (!cycle) {
      return res.status(404).json({ message: "Siklus tidak ditemukan" });
    }

    if (req.user.role === "petani") {
      const allowed = await pool.query(
        `SELECT 1 FROM screenhouses WHERE id = $1 AND owner_user_id = $2`,
        [screenhouseId, req.user.id]
      );
      if (!allowed.rows[0]) {
        return res.status(403).json({ message: "Akses ditolak" });
      }
    }

    res.json(cycle);
  } catch (err) {
    console.error("[get-cycle]", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getMySemaiCycles(req, res) {
  try {
    if (req.user.role !== "petani") {
      return res.status(403).json({ message: "Akses ditolak" });
    }

    const { status } = req.query;
    const params = [req.user.id];
    let statusFilter = "";

    if (status === "active" || status === "completed") {
      params.push(status);
      statusFilter = `AND sc.status = $${params.length}`;
    }

    const result = await pool.query(
      `
      SELECT
        sc.*,
        sh.name AS screenhouse_name
      FROM semai_cycles sc
      INNER JOIN screenhouses sh ON sh.id = sc.screenhouse_id
      WHERE sh.owner_user_id = $1
        ${statusFilter}
      ORDER BY
        CASE WHEN sc.status = 'active' THEN 0 ELSE 1 END,
        sc.tanggal_mulai DESC,
        sc.id DESC
      `,
      params
    );

    res.json(result.rows);
  } catch (err) {
    console.error("[my-cycles]", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * Ubah tanggal mulai dan/atau varietas siklus yang SEDANG BERJALAN.
 * Siklus yang sudah selesai bersifat final. Perubahan varietas ikut menyegarkan
 * threshold (kecuali manual override) dan estimasi disesuaikan ke jendela tanam baru.
 */
async function editSemaiCycle(req, res) {
  const client = await pool.connect();
  try {
    const screenhouseId = Number(req.params.id);
    const cycleId = Number(req.params.cycleId);
    const { varietas_id, tanggal_mulai } = req.body ?? {};

    if (varietas_id == null && !tanggal_mulai) {
      return res.status(400).json({ message: "Tidak ada perubahan yang dikirim" });
    }

    await client.query("BEGIN");

    const sh = await assertPetaniOwnsScreenhouse(client, screenhouseId, req.user.id);
    if (!sh) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Screenhouse tidak ditemukan" });
    }

    const cycleRes = await client.query(
      `
      SELECT id, varietas_id, varietas_nama, status,
             to_char(tanggal_mulai, 'YYYY-MM-DD') AS tanggal_mulai
      FROM semai_cycles
      WHERE id = $1 AND screenhouse_id = $2
      `,
      [cycleId, screenhouseId]
    );
    const cycle = cycleRes.rows[0];
    if (!cycle) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Siklus tidak ditemukan" });
    }
    if (cycle.status !== "active") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Hanya siklus yang sedang berjalan yang bisa diubah",
      });
    }

    let varietas = null;
    if (varietas_id != null && Number(varietas_id) !== cycle.varietas_id) {
      varietas = await resolveVarietasId(client, varietas_id);
    }
    const finalVarietasId = varietas ? varietas.id : cycle.varietas_id;
    const finalVarietasNama = varietas ? varietas.nama : cycle.varietas_nama;
    const finalTanggal = tanggal_mulai ? String(tanggal_mulai).slice(0, 10) : cycle.tanggal_mulai;
    const estimasiSiap = addCalendarDays(finalTanggal, TARGET_OPTIMAL_HSS);

    const updated = await client.query(
      `
      UPDATE semai_cycles
      SET varietas_id = $2,
          varietas_nama = $3,
          tanggal_mulai = $4::date,
          estimasi_siap = $5::date,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [cycleId, finalVarietasId, finalVarietasNama, finalTanggal, estimasiSiap]
    );

    if (varietas) {
      const tCheck = await client.query(
        `SELECT manual_override FROM thresholds WHERE screenhouse_id = $1`,
        [screenhouseId]
      );
      if (!tCheck.rows[0]?.manual_override) {
        const payload = await upsertThresholdFromVarietas(client, screenhouseId, varietas, {
          manualOverride: false,
        });
        await publishEvent(RK.CONFIG_THRESHOLD, payload);
      }
    }

    await syncScreenhouseFromCycle(client, screenhouseId, updated.rows[0], {
      estimasi_siap: estimasiSiap,
      status: "on_track",
    });

    await client.query("COMMIT");

    let estimasi = null;
    try {
      estimasi = await buildEstimasiTanam(screenhouseId, { persist: true });
      if (estimasi?.estimasi_siap) {
        await pool.query(
          `UPDATE semai_cycles SET estimasi_siap = $2::date, updated_at = NOW() WHERE id = $1`,
          [cycleId, estimasi.estimasi_siap]
        );
      }
    } catch (err) {
      console.error("[edit-cycle] estimasi:", err.message);
    }

    res.json({
      ...updated.rows[0],
      estimasi_siap: estimasi?.estimasi_siap ?? updated.rows[0].estimasi_siap,
      estimasi,
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    if (err.status === 400) {
      return res.status(400).json({ message: err.message });
    }
    console.error("[edit-cycle]", err);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
}

/**
 * Hapus satu siklus (riwayat). Jika yang dihapus sedang aktif, bersihkan juga
 * field siklus di screenhouse agar tidak menyisakan estimasi/varietas gantung.
 */
async function deleteSemaiCycle(req, res) {
  const client = await pool.connect();
  try {
    const screenhouseId = Number(req.params.id);
    const cycleId = Number(req.params.cycleId);

    await client.query("BEGIN");

    const sh = await assertPetaniOwnsScreenhouse(client, screenhouseId, req.user.id);
    if (!sh) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Screenhouse tidak ditemukan" });
    }

    const cycleRes = await client.query(
      `SELECT id, status FROM semai_cycles WHERE id = $1 AND screenhouse_id = $2`,
      [cycleId, screenhouseId]
    );
    const cycle = cycleRes.rows[0];
    if (!cycle) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Siklus tidak ditemukan" });
    }

    await client.query(`DELETE FROM semai_cycles WHERE id = $1`, [cycleId]);
    if (cycle.status === "active") {
      await clearScreenhouseCycleFields(client, screenhouseId);
    }

    await client.query("COMMIT");
    res.json({ message: "Siklus berhasil dihapus", id: cycleId });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[delete-cycle]", err);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
}

async function getActiveSemaiCycle(req, res) {
  try {
    const screenhouseId = Number(req.params.id);

    if (req.user.role === "petani") {
      const allowed = await pool.query(
        `SELECT 1 FROM screenhouses WHERE id = $1 AND owner_user_id = $2`,
        [screenhouseId, req.user.id]
      );
      if (!allowed.rows[0]) {
        return res.status(403).json({ message: "Akses ditolak" });
      }
    }

    const cycle = await getActiveCycle(pool, screenhouseId);
    if (!cycle) {
      return res.json(null);
    }

    res.json(cycle);
  } catch (err) {
    console.error("[active-cycle]", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  startSemaiCycle,
  endSemaiCycle,
  editSemaiCycle,
  deleteSemaiCycle,
  listScreenhouseCycles,
  getSemaiCycleById,
  getMySemaiCycles,
  getActiveSemaiCycle,
};
