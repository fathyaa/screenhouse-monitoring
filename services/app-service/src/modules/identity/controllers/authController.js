const pool = require("../../../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {
  parseTrayCount,
  activateScreenhouseRecord,
  postActivationProvisioning,
} = require("../../../shared/provisionScreenhouse");
const { resolveVarietasId } = require("../../../shared/varietasThreshold");
const { validateIndonesianPhone } = require("../../../shared/phoneNumber");

function logAuth(event, detail = {}) {
  const payload = { event, ...detail, at: new Date().toISOString() };
  if (detail.level === "error") {
    console.error("[auth]", JSON.stringify(payload));
  } else {
    console.log("[auth]", JSON.stringify(payload));
  }
}

async function register(req, res) {
  const client = await pool.connect();

  try {
    const { name, phone_number, password, role, screenhouse } = req.body;

    logAuth("register_attempt", { phone_number, role: role || "petani" });

    if (!name?.trim() || !phone_number?.trim() || !password) {
      return res.status(400).json({ message: "Nama, nomor HP, dan password wajib diisi" });
    }

    if (!screenhouse?.name?.trim()) {
      return res.status(400).json({ message: "Nama screenhouse wajib diisi" });
    }

    const requiredWilayah = [
      "province_id",
      "regency_id",
      "district_id",
      "village_id",
    ];
    for (const field of requiredWilayah) {
      if (!screenhouse[field]) {
        return res.status(400).json({ message: "Wilayah screenhouse wajib dipilih lengkap" });
      }
    }

    if (screenhouse.latitude == null || screenhouse.longitude == null) {
      return res.status(400).json({ message: "Titik lokasi screenhouse wajib dipilih di peta" });
    }

    const trayCount = parseTrayCount(screenhouse.tray_count, 1);
    if (trayCount == null) {
      return res.status(400).json({ message: "Jumlah tray harus bilangan bulat antara 1 dan 20" });
    }

    if (!screenhouse.varietas_id) {
      return res.status(400).json({ message: "Varietas bibit wajib dipilih" });
    }

    const phoneCheck = validateIndonesianPhone(phone_number);
    if (!phoneCheck.ok) {
      return res.status(400).json({ message: phoneCheck.message });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const trimmedPhone = phoneCheck.normalized;

    await client.query("BEGIN");

    const varietas = await resolveVarietasId(client, screenhouse.varietas_id);

    const existingUserResult = await client.query(
      `SELECT id, name, phone_number, role, status FROM users WHERE phone_number = $1`,
      [trimmedPhone]
    );

    let user;
    let screenhouseResult;

    if (existingUserResult.rows[0]) {
      const existingUser = existingUserResult.rows[0];

      if (existingUser.status !== "pending") {
        await client.query("ROLLBACK");
        return res.status(409).json({ message: "Nomor HP sudah terdaftar" });
      }

      const existingScreenhouse = await client.query(
        `SELECT id, status FROM screenhouses WHERE owner_user_id = $1 LIMIT 1`,
        [existingUser.id]
      );

      if (existingScreenhouse.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          message: "Pendaftaran sudah lengkap dan menunggu persetujuan operator",
        });
      }

      const updatedUser = await client.query(
        `
          UPDATE users
          SET name = $1, password = $2, role = $3
          WHERE id = $4
          RETURNING id, name, phone_number, role, status
        `,
        [name.trim(), hashedPassword, role || "petani", existingUser.id]
      );

      user = updatedUser.rows[0];

      screenhouseResult = await client.query(
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
            varietas_id,
            seed_variety,
            status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending')
          RETURNING id, name, latitude, longitude, tray_count, varietas_id, status
        `,
        [
          screenhouse.name.trim(),
          screenhouse.province_id,
          screenhouse.regency_id,
          screenhouse.district_id,
          screenhouse.village_id,
          user.id,
          screenhouse.address_detail?.trim() || null,
          Number(screenhouse.latitude),
          Number(screenhouse.longitude),
          trayCount,
          varietas.id,
          varietas.nama,
        ]
      );

      logAuth("register_complete_pending", {
        userId: user.id,
        phone_number: trimmedPhone,
        screenhouseId: screenhouseResult.rows[0].id,
      });
    } else {
      const userResult = await client.query(
        `
          INSERT INTO users (name, phone_number, password, role, status)
          VALUES ($1, $2, $3, $4, 'pending')
          RETURNING id, name, phone_number, role, status
        `,
        [name.trim(), trimmedPhone, hashedPassword, role || "petani"]
      );

      user = userResult.rows[0];

      screenhouseResult = await client.query(
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
            varietas_id,
            seed_variety,
            status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending')
          RETURNING id, name, latitude, longitude, tray_count, varietas_id, status
        `,
        [
          screenhouse.name.trim(),
          screenhouse.province_id,
          screenhouse.regency_id,
          screenhouse.district_id,
          screenhouse.village_id,
          user.id,
          screenhouse.address_detail?.trim() || null,
          Number(screenhouse.latitude),
          Number(screenhouse.longitude),
          trayCount,
          varietas.id,
          varietas.nama,
        ]
      );

      logAuth("register_success", {
        userId: user.id,
        phone_number: trimmedPhone,
        screenhouseId: screenhouseResult.rows[0].id,
      });
    }

    await client.query("COMMIT");

    res.status(201).json({
      ...user,
      screenhouse: screenhouseResult.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");

    if (err.status === 400) {
      return res.status(400).json({ message: err.message });
    }

    if (err.code === "23505") {
      return res.status(409).json({ message: "Nomor HP sudah terdaftar" });
    }

    logAuth("register_error", {
      level: "error",
      message: err.message,
      code: err.code,
    });
    res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
}

async function login(req, res) {
  const { phone_number, password } = req.body;

  try {
    if (!phone_number || !password) {
      logAuth("login_rejected", {
        level: "error",
        reason: "missing_credentials",
        phone_number: phone_number ?? null,
      });
      return res.status(400).json({
        message: "Nomor HP dan kata sandi wajib diisi",
      });
    }

    logAuth("login_attempt", { phone_number });

    const result = await pool.query(
      `SELECT id, name, phone_number, password, role, status FROM users WHERE phone_number = $1`,
      [phone_number]
    );

    const user = result.rows[0];

    if (!user) {
      logAuth("login_failed", {
        level: "error",
        reason: "user_not_found",
        phone_number,
        statusCode: 404,
      });
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      logAuth("login_failed", {
        level: "error",
        reason: "invalid_password",
        phone_number,
        userId: user.id,
        role: user.role,
        statusCode: 401,
      });
      return res.status(401).json({ message: "Password salah" });
    }

    if (user.status !== "approved") {
      logAuth("login_failed", {
        level: "error",
        reason: "account_not_approved",
        phone_number,
        userId: user.id,
        status: user.status,
        statusCode: 403,
      });
      return res.status(403).json({
        message: "Akun belum disetujui operator",
      });
    }

    if (!process.env.JWT_SECRET) {
      logAuth("login_error", {
        level: "error",
        reason: "jwt_secret_missing",
        userId: user.id,
      });
      return res.status(500).json({
        message: "Konfigurasi server tidak lengkap (JWT_SECRET)",
      });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    logAuth("login_success", {
      userId: user.id,
      phone_number,
      role: user.role,
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        status: user.status,
      },
    });
  } catch (err) {
    logAuth("login_error", {
      level: "error",
      phone_number,
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: "Internal server error" });
  }
}

async function approveUser(req, res) {
  const client = await pool.connect();

  try {
    const userId = req.params.id;
    const trayOverride = req.body?.tray_count != null ? parseTrayCount(req.body.tray_count) : null;
    const varietasOverride = req.body?.varietas_id != null ? Number(req.body.varietas_id) : null;
    if (req.body?.tray_count != null && trayOverride == null) {
      return res.status(400).json({ message: "Jumlah tray harus bilangan bulat antara 1 dan 20" });
    }

    await client.query("BEGIN");

    if (varietasOverride != null) {
      await resolveVarietasId(client, varietasOverride);
    }

    const result = await client.query(
      `
        UPDATE users SET status = 'approved' WHERE id = $1 AND status = 'pending'
        RETURNING id, name, role, status
        `,
      [userId]
    );

    if (!result.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "User tidak ditemukan atau sudah diproses" });
    }

    const pendingScreenhouses = await client.query(
      `
        SELECT id, name, owner_user_id, tray_count, varietas_id
        FROM screenhouses
        WHERE owner_user_id = $1 AND status = 'pending'
        `,
      [userId]
    );

    const activated = [];
    for (const row of pendingScreenhouses.rows) {
      if (varietasOverride != null) {
        await client.query(
          `
          UPDATE screenhouses
          SET varietas_id = $1,
              seed_variety = (SELECT nama FROM varietas_bibit WHERE id = $1)
          WHERE id = $2
          `,
          [varietasOverride, row.id]
        );
      }
      const effectiveTray = trayOverride ?? row.tray_count ?? 1;
      const sh = await activateScreenhouseRecord(client, row.id, effectiveTray);
      if (sh) activated.push(sh);
    }

    await client.query("COMMIT");

    await postActivationProvisioning(activated);

    logAuth("user_approved", {
      userId,
      by: req.user?.id,
      screenhousesActivated: activated.length,
    });

    res.json({
      message: "User berhasil diapprove",
      user: result.rows[0],
      screenhousesActivated: activated.length,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.status === 400) {
      return res.status(400).json({ message: err.message });
    }
    logAuth("approve_error", { level: "error", message: err.message });
    res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
}

async function rejectUser(req, res) {
  const client = await pool.connect();

  try {
    const userId = req.params.id;

    await client.query("BEGIN");

    const result = await client.query(
      `
        UPDATE users
        SET status = 'rejected'
        WHERE id = $1 AND status = 'pending' AND role = 'petani'
        RETURNING id, name, role, status
      `,
      [userId]
    );

    if (!result.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "User tidak ditemukan atau sudah diproses" });
    }

    await client.query(
      `DELETE FROM screenhouses WHERE owner_user_id = $1 AND status = 'pending'`,
      [userId]
    );

    await client.query("COMMIT");

    logAuth("user_rejected", { userId, by: req.user?.id });

    res.json({
      message: "Pendaftaran ditolak",
      user: result.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    logAuth("reject_error", { level: "error", message: err.message });
    res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
}

async function getApprovalStats(req, res) {
  try {
    const result = await pool.query(
      `
        SELECT
          (SELECT COUNT(*)::int FROM users WHERE status = 'pending' AND role = 'petani') AS farmers_pending,
          (SELECT COUNT(*)::int
             FROM screenhouses s
             JOIN users u ON u.id = s.owner_user_id
            WHERE s.status = 'pending' AND u.status = 'approved') AS screenhouses_pending,
          (SELECT COUNT(*)::int FROM users WHERE status = 'approved' AND role = 'petani') AS approved,
          (SELECT COUNT(*)::int FROM users WHERE status = 'rejected' AND role = 'petani') AS rejected
      `
    );
    const row = result.rows[0] || {};
    const farmersPending = row.farmers_pending ?? 0;
    const screenhousesPending = row.screenhouses_pending ?? 0;
    res.json({
      pending: farmersPending + screenhousesPending,
      farmers_pending: farmersPending,
      screenhouses_pending: screenhousesPending,
      approved: row.approved ?? 0,
      rejected: row.rejected ?? 0,
    });
  } catch (err) {
    logAuth("get_approval_stats_error", { level: "error", message: err.message });
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getPendingUsers(req, res) {
  try {
    const result = await pool.query(
      `
        SELECT
          u.id,
          u.name,
          u.phone_number,
          u.created_at,
          u.status,
          sh.id AS screenhouse_id,
          sh.name AS screenhouse_name,
          sh.address_detail,
          sh.latitude,
          sh.longitude,
          sh.tray_count,
          sh.varietas_id,
          vb.nama AS varietas_nama,
          vb.durasi_pembibitan_hari,
          vb.sumber_referensi,
          p.name AS province,
          r.name AS regency,
          d.name AS district,
          v.name AS village
        FROM users u
        LEFT JOIN LATERAL (
          SELECT sh2.*
          FROM screenhouses sh2
          WHERE sh2.owner_user_id = u.id
          ORDER BY
            CASE sh2.status WHEN 'pending' THEN 0 ELSE 1 END,
            sh2.created_at DESC
          LIMIT 1
        ) sh ON true
        LEFT JOIN provinces p ON sh.province_id = p.id
        LEFT JOIN regencies r ON sh.regency_id = r.id
        LEFT JOIN districts d ON sh.district_id = d.id
        LEFT JOIN villages v ON sh.village_id = v.id
        LEFT JOIN varietas_bibit vb ON sh.varietas_id = vb.id
        WHERE u.status = 'pending'
        ORDER BY u.created_at DESC
        `
    );
    res.json(result.rows);
  } catch (err) {
    logAuth("get_pending_error", { level: "error", message: err.message });
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getFarmers(req, res) {
  try {
    const result = await pool.query(
      `
        SELECT
          u.id,
          u.name,
          u.phone_number,
          u.created_at,
          u.status,
          COUNT(sh.id) FILTER (WHERE sh.status = 'active')::int AS screenhouse_count
        FROM users u
        LEFT JOIN screenhouses sh ON sh.owner_user_id = u.id
        WHERE u.role = 'petani' AND u.status = 'approved'
        GROUP BY u.id
        ORDER BY u.created_at DESC
      `
    );
    res.json(result.rows);
  } catch (err) {
    logAuth("get_farmers_error", { level: "error", message: err.message });
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getFarmerScreenhouses(req, res) {
  try {
    const userId = req.params.id;

    const farmerResult = await pool.query(
      `
        SELECT id, name, phone_number, status, created_at
        FROM users
        WHERE id = $1 AND role = 'petani'
      `,
      [userId]
    );

    if (!farmerResult.rows[0]) {
      return res.status(404).json({ message: "Petani tidak ditemukan" });
    }

    const screenhousesResult = await pool.query(
      `
        SELECT
          s.id,
          s.name,
          s.address_detail,
          s.latitude,
          s.longitude,
          s.status,
          s.created_at,
          p.name AS province,
          r.name AS regency,
          d.name AS district,
          v.name AS village
        FROM screenhouses s
        JOIN provinces p ON s.province_id = p.id
        JOIN regencies r ON s.regency_id = r.id
        JOIN districts d ON s.district_id = d.id
        JOIN villages v ON s.village_id = v.id
        WHERE s.owner_user_id = $1
        ORDER BY s.created_at DESC
      `,
      [userId]
    );

    res.json({
      farmer: farmerResult.rows[0],
      screenhouses: screenhousesResult.rows,
    });
  } catch (err) {
    logAuth("get_farmer_screenhouses_error", { level: "error", message: err.message });
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getApprovedUsers(req, res) {
  return getFarmers(req, res);
}

async function getMe(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, name, phone_number, role, status, notifications_muted, created_at FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    logAuth("get_me_error", { level: "error", message: err.message });
    res.status(500).json({ message: "Internal server error" });
  }
}

async function updateMe(req, res) {
  try {
    const name = req.body?.name?.trim();
    if (!name || name.length < 2 || name.length > 100) {
      return res.status(400).json({ message: "Nama harus 2–100 karakter" });
    }

    const result = await pool.query(
      `
      UPDATE users
      SET name = $1
      WHERE id = $2
      RETURNING id, name, phone_number, role, status
      `,
      [name, req.user.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    logAuth("update_me_error", { level: "error", message: err.message });
    res.status(500).json({ message: "Internal server error" });
  }
}

/** Satu flag akun untuk suara/toast in-app & push HP — sama di semua device. */
async function updateMyNotificationPref(req, res) {
  try {
    const muted = Boolean(req.body?.muted);

    const result = await pool.query(
      `
      UPDATE users
      SET notifications_muted = $1
      WHERE id = $2
      RETURNING id, notifications_muted
      `,
      [muted, req.user.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    logAuth("update_notification_pref_error", { level: "error", message: err.message });
    res.status(500).json({ message: "Internal server error" });
  }
}

async function changeMyPassword(req, res) {
  try {
    const { current_password, new_password } = req.body ?? {};
    if (!current_password || !new_password) {
      return res.status(400).json({ message: "Password lama dan baru wajib diisi" });
    }
    if (String(new_password).length < 6) {
      return res.status(400).json({ message: "Password baru minimal 6 karakter" });
    }

    const userRes = await pool.query(`SELECT password FROM users WHERE id = $1`, [req.user.id]);
    const user = userRes.rows[0];
    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    const isMatch = await bcrypt.compare(current_password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Password lama salah" });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);
    await pool.query(`UPDATE users SET password = $1 WHERE id = $2`, [
      hashedPassword,
      req.user.id,
    ]);

    res.json({ message: "Password berhasil diubah" });
  } catch (err) {
    logAuth("change_password_error", { level: "error", message: err.message });
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  register,
  login,
  approveUser,
  rejectUser,
  getApprovalStats,
  getPendingUsers,
  getFarmers,
  getFarmerScreenhouses,
  getApprovedUsers,
  getMe,
  updateMe,
  updateMyNotificationPref,
  changeMyPassword,
};
