// Uji unit kontrak kolaborasi robot (tanpa DB/broker):  node --test test/
const test = require("node:test");
const assert = require("node:assert");
const t = require("../src/modules/collaboration/collabTopics");

test("adaptTelemetry memetakan kunci ringkas Tabel 3.3 ke kolom sensor_data", () => {
  const now = Date.now();
  const d = t.adaptTelemetry({ h_id: "SH90", n_id: "SH90-T01", seq: 104, ts: now,
    sn: 42.1, sm: 68.5, ah: 74.0, t: 28.4, uv: 3.2 });
  assert.deepStrictEqual(
    { ...d, measured_at: undefined },
    { node_id: "SH90-T01", destination_id: "SH90-SINK", nutrient: 42.1, soil_moisture: 68.5,
      air_humidity: 74, air_temperature: 28.4, uv_index: 3.2, measured_at: undefined,
      idemp_key: "SH90/SH90-T01/tel/104" }
  );
  assert.strictEqual(new Date(d.measured_at).getTime(), now);
});

test("ts detik juga diterima; ts tak masuk akal menjadi null", () => {
  const sec = Math.floor(Date.now() / 1000);
  assert.ok(t.toIsoOrNull(sec));
  assert.strictEqual(t.toIsoOrNull(1), null);
  assert.strictEqual(t.toIsoOrNull("abc"), null);
});

test("kunci idempotensi identik dengan spsbench (repo tesis)", () => {
  assert.strictEqual(t.idempKey.status({ m_id: "M1", r_id: "RB01", seq: 3 }), "M1/RB01/st/3");
  assert.strictEqual(t.idempKey.result({ h_id: "SH90", m_id: "M1", seq: 2 }), "SH90/M1/res/2");
  assert.strictEqual(t.idempKey.actuator({ h_id: "SH90", act_id: "PUMP_1", seq: 8 }), "SH90/PUMP_1/act/8");
});

test("kode rumah <-> kode sink; topik -> jenis pesan", () => {
  assert.strictEqual(t.sinkCodeOf("SH90"), "SH90-SINK");
  assert.strictEqual(t.houseCodeOf("SH90-SINK"), "SH90");
  assert.strictEqual(t.kindOf("mission/result"), "result");
  assert.strictEqual(t.kindOf("screenhouse/1/sensor"), null);
  assert.strictEqual(t.adaptTelemetry({ n_id: "x" }), null);
});
