const monitoringPool = require("../config/monitoringDb");

/**
 * Hapus permanen seluruh data satu screenhouse di DB monitoring.
 * Tabel monitoring tidak punya ON DELETE CASCADE, jadi urutan hapus harus
 * dari anak ke induk: alerts / actuator_logs / sensor_data → nodes → registry.
 * Idempoten: aman dipanggil ulang kalau sebagian sudah terhapus.
 */
async function purgeScreenhouseMonitoring(screenhouseId) {
  if (!monitoringPool) return;
  const client = await monitoringPool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM alerts WHERE screenhouse_id = $1`, [screenhouseId]);
    await client.query(`DELETE FROM actuator_logs WHERE screenhouse_id = $1`, [screenhouseId]);
    await client.query(
      `
      DELETE FROM sensor_data
      WHERE sensor_node_id IN (SELECT id FROM sensor_nodes WHERE screenhouse_id = $1)
         OR sink_node_id   IN (SELECT id FROM sink_nodes   WHERE screenhouse_id = $1)
      `,
      [screenhouseId]
    );
    await client.query(`DELETE FROM sensor_nodes WHERE screenhouse_id = $1`, [screenhouseId]);
    await client.query(`DELETE FROM sink_nodes WHERE screenhouse_id = $1`, [screenhouseId]);
    await client.query(`DELETE FROM threshold_snapshots WHERE screenhouse_id = $1`, [screenhouseId]);
    await client.query(`DELETE FROM screenhouse_registry WHERE screenhouse_id = $1`, [screenhouseId]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Hapus data screenhouse di DB app dalam transaksi yang diberikan pemanggil.
 * `semai_cycles` sudah ON DELETE CASCADE; `thresholds` tidak, jadi dihapus manual.
 */
async function purgeScreenhouseApp(client, screenhouseId) {
  await client.query(`DELETE FROM thresholds WHERE screenhouse_id = $1`, [screenhouseId]);
  await client.query(`DELETE FROM screenhouses WHERE id = $1`, [screenhouseId]);
}

module.exports = { purgeScreenhouseMonitoring, purgeScreenhouseApp };
