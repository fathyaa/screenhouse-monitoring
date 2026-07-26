const pool = require("../../../config/db");
const bcrypt = require("bcryptjs");
const {
  purgeScreenhouseMonitoring,
  purgeScreenhouseApp,
} = require("../../../shared/purgeScreenhouse");

async function listUsers(req, res) {
  try {
    const { role, status, search } = req.query;
    const params = [];
    const conditions = ["1=1"];

    if (role) {
      params.push(role);
      conditions.push(`u.role = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`u.status = $${params.length}`);
    }
    if (search?.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(
        `(u.name ILIKE $${params.length} OR u.phone_number ILIKE $${params.length})`
      );
    }

    const result = await pool.query(
      `
      SELECT
        u.id,
        u.name,
        u.phone_number,
        u.role,
        u.status,
        u.created_at,
        COUNT(sh.id) FILTER (WHERE sh.status = 'active')::int AS screenhouse_count
      FROM users u
      LEFT JOIN screenhouses sh ON sh.owner_user_id = u.id
      WHERE ${conditions.join(" AND ")}
      GROUP BY u.id
      ORDER BY u.created_at DESC
      `,
      params
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function updateUser(req, res) {
  try {
    const userId = Number(req.params.id);
    const { name, role, status } = req.body;

    if (userId === req.user.id && role && role !== req.user.role) {
      return res.status(400).json({ message: "Tidak bisa mengubah role akun sendiri" });
    }

    const allowedRoles = ["petani", "operator", "super_admin"];
    const allowedStatus = ["pending", "approved", "rejected"];

    if (role && !allowedRoles.includes(role)) {
      return res.status(400).json({ message: "Role tidak valid" });
    }
    if (status && !allowedStatus.includes(status)) {
      return res.status(400).json({ message: "Status tidak valid" });
    }

    const result = await pool.query(
      `
      UPDATE users
      SET
        name = COALESCE($1, name),
        role = COALESCE($2, role),
        status = COALESCE($3, status)
      WHERE id = $4
      RETURNING id, name, phone_number, role, status, created_at
      `,
      [name?.trim() || null, role || null, status || null, userId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    if (status === "approved") {
      await pool.query(
        `UPDATE screenhouses SET status = 'active' WHERE owner_user_id = $1 AND status = 'pending'`,
        [userId]
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function resetUserPassword(req, res) {
  try {
    const userId = Number(req.params.id);
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ message: "Password minimal 6 karakter" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `UPDATE users SET password = $1 WHERE id = $2 RETURNING id, name, phone_number`,
      [hashed, userId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    res.json({ message: "Password berhasil diperbarui", user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * Hapus user beserta SEMUA screenhouse miliknya (purge 2 DB per screenhouse).
 * push_subscriptions ikut terhapus via ON DELETE CASCADE. Tidak bisa hapus diri sendiri.
 */
async function deleteUser(req, res) {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId)) {
    return res.status(400).json({ message: "ID tidak valid" });
  }
  if (userId === req.user.id) {
    return res.status(400).json({ message: "Tidak bisa menghapus akun sendiri" });
  }

  const client = await pool.connect();
  try {
    const check = await client.query(`SELECT id, name FROM users WHERE id = $1`, [userId]);
    if (!check.rows[0]) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    const owned = await client.query(
      `SELECT id FROM screenhouses WHERE owner_user_id = $1`,
      [userId]
    );

    // Purge monitoring (DB terpisah) untuk tiap screenhouse dulu.
    for (const row of owned.rows) {
      await purgeScreenhouseMonitoring(row.id);
    }

    await client.query("BEGIN");
    for (const row of owned.rows) {
      await purgeScreenhouseApp(client, row.id);
    }
    await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
    await client.query("COMMIT");

    res.json({
      message: "User berhasil dihapus",
      id: userId,
      name: check.rows[0].name,
      deleted_screenhouses: owned.rows.length,
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[delete-user]", err);
    res.status(500).json({ message: "Gagal menghapus user" });
  } finally {
    client.release();
  }
}

module.exports = { listUsers, updateUser, resetUserPassword, deleteUser };
