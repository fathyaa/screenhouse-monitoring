const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    // console.log("Auth header:", authHeader) // ← debug sementara

    if (!authHeader) {
      return res.status(401).json({ message: "Token tidak ditemukan" })
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