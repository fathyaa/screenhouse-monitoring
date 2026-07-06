const express = require("express");
const authMiddleware = require("../../../shared/middlewares/authMiddleware");
const {
  listVarietasBibit,
  getVarietasBibitById,
} = require("../controllers/varietasController");

const router = express.Router();

router.get("/", listVarietasBibit);
router.get("/:id", authMiddleware, getVarietasBibitById);

module.exports = router;
