const { setActuators } = require("../actuatorService");

async function postScreenhouseActuators(req, res) {
  try {
    const screenhouseId = Number(req.params.screenhouseId);
    const { sensor_node_id, fan, irrigation, lamp, source, reason, user_id } = req.body ?? {};

    if (!Number.isInteger(screenhouseId)) {
      return res.status(400).json({ message: "screenhouseId tidak valid" });
    }

    const hasActuator =
      fan !== undefined || irrigation !== undefined || lamp !== undefined;
    if (!hasActuator) {
      return res.status(400).json({
        message: "Minimal satu aktuator (fan, irrigation, lamp) wajib diisi",
      });
    }

    const result = await setActuators({
      screenhouseId,
      sensorNodeId: sensor_node_id,
      fan,
      irrigation,
      lamp,
      source: source === "auto" ? "auto" : "manual",
      reason: reason ?? null,
      userId: user_id ?? null,
    });

    res.json(result);
  } catch (err) {
    console.error("[actuators]", err);
    res.status(err.status || 500).json({
      message: err.message || "Internal server error",
    });
  }
}

module.exports = { postScreenhouseActuators };
