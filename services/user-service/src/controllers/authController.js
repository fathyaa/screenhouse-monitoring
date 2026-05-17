const pool = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

async function register(req, res) {
  try {
    const {
        name, phone_number, password, role,
    } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
        `
        INSERT INTO users (
            name, phone_number, password, role
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, phone_number, role, status
        `,
        [name, phone_number, hashedPassword, role || "petani"]
    );

    res.status(201).json(result.rows[0]);
    } catch (err) {
        console.log(err);

        res.status(500).json({
            message: "Internal server error",
        });
    }
}

async function login(req, res) {
    try {
            const { phone_number, password } = req.body;

            const result = await pool.query(
                `
                SELECT *
                FROM users
                WHERE phone_number = $1
                `,
                [phone_number]
            );
            
            const user = result.rows[0];
            
            if (!user) {
                return res.status(404).json({
                    message: "User tidak ditemukan",
                });
            }

            const isMatch = await bcrypt.compare(password, user.password);

            if (!isMatch) {
                return res.status(401).json({
                    message: "Password salah",
                });
            }

            if (user.status !== "approved") {
                return res.status(403).json({
                    message:
                    "Akun belum disetujui operator",
                });
            }

            const token = jwt.sign(
                {
                    id: user.id,
                    role: user.role,
                },
                process.env.JWT_SECRET,
                {
                    expiresIn: "7d",
                }
            );

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
            console.log(err);

            res.status(500).json({
                message: "Internal server error",
            });
        }
}

async function approveUser(
  req,
  res
) {
  try {
    const userId =
      req.params.id;

    const result =
      await pool.query(
        `
        UPDATE users
        SET status = 'approved'
        WHERE id = $1
        RETURNING id, name, role, status
        `,
        [userId]
      );

    res.json({
      message:
        "User berhasil diapprove",
      user: result.rows[0],
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      message:
        "Internal server error",
    });
  }
}

async function getPendingUsers(
  req,
  res
) {
  try {

    const result =
      await pool.query(
        `
        SELECT
          id,
          name,
          phone_number,
          created_at,
          status
        FROM users
        WHERE status = 'pending'
        ORDER BY created_at DESC
        `
      );

    res.json(result.rows);

  } catch (err) {

    console.log(err);

    res.status(500).json({
      message:
        "Internal server error",
    });

  }
}

async function getApprovedUsers(
  req,
  res
) {
  try {

    const result =
      await pool.query(
        `
        SELECT
          id,
          name,
          phone_number,
          created_at,
          status
        FROM users
        WHERE status = 'approved'
        AND role = 'petani'
        ORDER BY created_at DESC
        `
      );

    res.json(result.rows);

  } catch (err) {

    console.log(err);

    res.status(500).json({
      message:
        "Internal server error",
    });

  }
}


module.exports = {
    register,
    login,
    approveUser,
    getPendingUsers,
    getApprovedUsers
};
