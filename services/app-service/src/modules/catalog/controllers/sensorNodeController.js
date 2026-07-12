const { monitoringPatch } = require("../../../shared/monitoringClient");

async function patchSensorNodeName(req, res) {
  try {
    const nodeId = Number(req.params.nodeId);
    const nodeName =
      typeof req.body?.node_name === "string" ? req.body.node_name.trim() : "";

    if (!Number.isInteger(nodeId)) {
      return res.status(400).json({ message: "ID tidak valid" });
    }
    if (nodeName.length < 1 || nodeName.length > 50) {
      return res.status(400).json({ message: "Nama rak bibit harus 1–50 karakter" });
    }

    const result = await monitoringPatch(
      `/sensor-data/sensor-nodes/${nodeId}`,
      { node_name: nodeName },
      req.headers.authorization
    );

    if (!result) {
      return res.status(502).json({
        message: "Layanan monitoring tidak tersedia. Coba restart monitoring-service.",
      });
    }

    res.json(result);
  } catch (err) {
    console.error("[sensor-node-rename]", err.message);
    res.status(err.status || 500).json({
      message: err.data?.message || err.message || "Gagal menyimpan nama rak bibit",
    });
  }
}

module.exports = { patchSensorNodeName };
