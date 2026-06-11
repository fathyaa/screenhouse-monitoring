const express = require("express");
const {
  geocodeSearch,
  resolveFromCoordinates,
  getProvinces,
  getRegencies,
  getDistricts,
  getVillages,
} = require("../controllers/wilayahController");

const router = express.Router();

router.get("/search", geocodeSearch);
router.get("/resolve", resolveFromCoordinates);
router.get("/provinces", getProvinces);
router.get("/regencies", getRegencies);
router.get("/districts", getDistricts);
router.get("/villages", getVillages);

module.exports = router;
