require("dotenv").config();

const express = require("express");
const cors = require("cors");

require("./db");

const authRoutes = require("./routes/authRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("User Service Running");
});

app.use("/auth", authRoutes);

const PORT = process.env.PORT || 3004;

app.listen(PORT, () => {
  console.log(`User Service running on port ${PORT}`);
});