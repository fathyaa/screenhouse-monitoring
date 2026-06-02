require("dotenv").config();

const express = require("express");
const cors = require("cors");

require("./db");

const screenhouseRoutes = require("./routes/screenhouseRoutes");
const wilayahRoutes = require("./routes/wilayahRoutes");
const thresholdRoutes = require("./routes/thresholdRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send("Screenhouse Service Running");
});

app.use((req, res, next) => {
  next();
});

app.use("/screenhouses", screenhouseRoutes);
app.use("/wilayah", wilayahRoutes);
app.use("/thresholds", thresholdRoutes);
app.use("/admin", adminRoutes);

const PORT = process.env.PORT || 3003;

app.listen(PORT, () => {
  console.log(
    `Screenhouse Service running on port ${PORT}`
  );
});