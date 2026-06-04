const pool = require("../../../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

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

    const hashedPassword = await bcrypt.hash(password, 10);
    const trimmedPhone = phone_number.trim();

    await client.query("BEGIN");

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
            status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
          RETURNING id, name, latitude, longitude, status
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
            status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
          RETURNING id, name, latitude, longitude, status
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

    await client.query("BEGIN");

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

    const activated = await client.query(
      `
        UPDATE screenhouses
        SET status = 'active'
        WHERE owner_user_id = $1 AND status = 'pending'
        RETURNING id
        `,
      [userId]
    );

    for (const row of activated.rows) {
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
          VALUES ($1, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000)
          ON CONFLICT (screenhouse_id) DO NOTHING
          `,
        [row.id]
      );
    }

    await client.query("COMMIT");

    logAuth("user_approved", {
      userId,
      by: req.user?.id,
      screenhousesActivated: activated.rows.length,
    });

    res.json({
      message: "User berhasil diapprove",
      user: result.rows[0],
      screenhousesActivated: activated.rows.length,
    });
  } catch (err) {
    await client.query("ROLLBACK");
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
          COUNT(*) FILTER (WHERE status = 'pending' AND role = 'petani')::int AS pending,
          COUNT(*) FILTER (WHERE status = 'approved' AND role = 'petani')::int AS approved,
          COUNT(*) FILTER (WHERE status = 'rejected' AND role = 'petani')::int AS rejected
        FROM users
      `
    );
    res.json(result.rows[0]);
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
};
