require("dotenv").config();

const express = require("express");
const cors = require("cors");

require("./db");

const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const level = res.statusCode >= 400 ? "error" : "info";
    const line = {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      ms: Date.now() - start,
    };
    if (level === "error") console.error("[http]", JSON.stringify(line));
    else console.log("[http]", JSON.stringify(line));
  });
  next();
});

app.get("/", (req, res) => {
  res.send("User Service Running");
});

app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);

const PORT = process.env.PORT || 3004;

app.listen(PORT, () => {
  console.log(`User Service running on port ${PORT}`);
});