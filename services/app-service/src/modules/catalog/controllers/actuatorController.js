const pool = require("../../../config/db");
const { monitoringPost } = require("../../../shared/monitoringClient");

async function setScreenhouseActuators(req, res) {
  try {
    const screenhouseId = Number(req.params.screenhouseId);
    if (!Number.isInteger(screenhouseId)) {
      return res.status(400).json({ message: "screenhouseId tidak valid" });
    }

    if (req.user.role === "petani") {
      const ownerCheck = await pool.query(
        `SELECT 1 FROM screenhouses WHERE id = $1 AND owner_user_id = $2`,
        [screenhouseId, req.user.id]
      );
      if (!ownerCheck.rows[0]) {
        return res.status(403).json({ message: "Akses ditolak" });
      }
    }

    const result = await monitoringPost(
      `/sensor-data/screenhouse/${screenhouseId}/actuators`,
      {
        ...req.body,
        source: "manual",
        user_id: req.user.id,
      }
    );

    if (!result) {
      return res.status(502).json({ message: "Monitoring service tidak tersedia" });
    }

    res.json(result);
  } catch (err) {
    console.error("[actuators-gateway]", err.message);
    res.status(err.status || 500).json({
      message: err.data?.message || err.message || "Internal server error",
      code: err.data?.code,
      locked: err.data?.locked,
    });
  }
}

module.exports = { setScreenhouseActuators };
