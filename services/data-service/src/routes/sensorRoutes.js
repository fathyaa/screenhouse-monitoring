const express = require("express");

const {
  getSensorData,
} = require("../controllers/sensorController");

const router = express.Router();

router.get("/", getSensorData);

module.exports = router;