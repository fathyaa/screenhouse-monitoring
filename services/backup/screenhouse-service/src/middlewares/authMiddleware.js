const jwt = require("jsonwebtoken");

function authMiddleware(
  req,
  res,
  next
) {
  try {
    const authHeader =
      req.headers.authorization;

    //   console.log("AUTH HEADER:", authHeader);

    if (!authHeader) {
      return res.status(401).json({
        message: "Token tidak ditemukan",
      });
    }

    const token =
      authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      "supersecretkey"
    );

    req.user = decoded;

    next();
  } catch (err) {
    return res.status(401).json({
      message: "Token tidak valid",
    });
  }
}

module.exports = authMiddleware;