const pool = require("../../../config/db");
const { monitoringGet } = require("../../../shared/monitoringClient");

async function listAdminScreenhouses(req, res) {
  try {
    const params = [];
    const conditions = ["1=1"];

    if (req.query.status) {
      params.push(req.query.status);
      conditions.push(`s.status = $${params.length}`);
    }
    if (req.query.regency_id) {
      params.push(Number(req.query.regency_id));
      conditions.push(`s.regency_id = $${params.length}`);
    }
    if (req.query.district_id) {
      params.push(Number(req.query.district_id));
      conditions.push(`s.district_id = $${params.length}`);
    }
    if (req.query.village_id) {
      params.push(Number(req.query.village_id));
      conditions.push(`s.village_id = $${params.length}`);
    }
    if (req.query.search?.trim()) {
      params.push(`%${req.query.search.trim()}%`);
      conditions.push(
        `(s.name ILIKE $${params.length} OR u.name ILIKE $${params.length} OR u.phone_number ILIKE $${params.length})`
      );
    }

    const result = await pool.query(
      `
      SELECT
        s.id,
        s.name,
        s.address_detail,
        s.latitude,
        s.longitude,
        s.status,
        s.created_at,
        u.id AS owner_id,
        u.name AS owner_name,
        u.phone_number AS owner_phone,
        p.name AS province,
        r.name AS regency,
        d.name AS district,
        v.name AS village
      FROM screenhouses s
      JOIN users u ON u.id = s.owner_user_id
      JOIN provinces p ON p.id = s.province_id
      JOIN regencies r ON r.id = s.regency_id
      JOIN districts d ON d.id = s.district_id
      JOIN villages v ON v.id = s.village_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY s.created_at DESC
      `,
      params
    );

    const screenhouses = result.rows;

    // node_count comes from the monitoring DB (sensor_nodes).
    const ids = screenhouses.map((s) => s.id);
    let nodeCountById = {};
    if (ids.length) {
      const counts = await monitoringGet(
        `/stats/node-counts?screenhouseIds=${ids.join(",")}`,
        []
      );
      if (Array.isArray(counts)) {
        nodeCountById = Object.fromEntries(
          counts.map((c) => [c.screenhouse_id, c.node_count])
        );
      }
    }

    res.json(
      screenhouses.map((s) => ({
        ...s,
        node_count: nodeCountById[s.id] ?? 0,
      }))
    );
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function updateScreenhouseStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const allowed = ["active", "pending", "inactive"];

    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Status tidak valid" });
    }

    const result = await pool.query(
      `UPDATE screenhouses SET status = $1 WHERE id = $2 RETURNING id, name, status`,
      [status, id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: "Screenhouse tidak ditemukan" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = { listAdminScreenhouses, updateScreenhouseStatus };
