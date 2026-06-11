const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader) {
      return res.status(401).json({ message: "Token tidak ditemukan" })
    }

    if (!process.env.JWT_SECRET) {
      console.error("[auth] JWT_SECRET belum diset di alert-service")
      return res.status(500).json({ message: "Konfigurasi server tidak lengkap (JWT_SECRET)" })
    }

    const token   = authHeader.split(" ")[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user      = decoded
    next()
  } catch (err) {
    console.log("JWT error:", err.message) // ← debug sementara
    return res.status(401).json({ message: "Token tidak valid" })
  }
}

module.exports = authMiddleware;