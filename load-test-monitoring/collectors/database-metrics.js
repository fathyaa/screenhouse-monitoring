/**
 * Database metrics for selected real sensor_nodes.
 *
 * Rows are counted from sensor_data for the exact sensor_node IDs selected by
 * the simulator, after the scenario start timestamp. This avoids fake prefixes
 * and keeps validation compatible with existing production-like records.
 */

import pg from "pg";

export class DatabaseMetricsCollector {
  constructor({ host, port, user, password, database, intervalMs = 5000 }) {
    this.pool = new pg.Pool({ host, port, user, password, database, max: 3 });
    this.intervalMs = intervalMs;
    this.samples = [];
    this._timer = null;
    this._runStartedAt = null;
    this._baselineCount = 0;
    this._sensorNodeIds = [];
  }

  setSensorNodeIds(sensorNodeIds) {
    this._sensorNodeIds = [...new Set(sensorNodeIds.map(Number))].filter(Number.isFinite);
    if (!this._sensorNodeIds.length) {
      throw new Error("DatabaseMetricsCollector requires selected sensor_node IDs");
    }
  }

  setRunStart(isoOrMs) {
    this._runStartedAt = new Date(isoOrMs);
    this._baselineCount = 0;
  }

  async captureBaseline() {
    this._baselineCount = await this.countSinceStart();
    return this._baselineCount;
  }

  async countDelta() {
    const total = await this.countSinceStart();
    return Math.max(total - this._baselineCount, 0);
  }

  async countSinceStart() {
    this._assertReady();
    const res = await this.pool.query(
      `
      SELECT COUNT(*)::int AS cnt
      FROM sensor_data
      WHERE sensor_node_id = ANY($1::int[])
        AND created_at >= $2
      `,
      [this._sensorNodeIds, this._runStartedAt]
    );
    return res.rows[0]?.cnt ?? 0;
  }

  async fetchInsertRate() {
    this._assertReady();
    const res = await this.pool.query(
      `
      SELECT
        COUNT(*)::int AS cnt,
        EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) AS span_sec
      FROM sensor_data
      WHERE sensor_node_id = ANY($1::int[])
        AND created_at >= $2
      `,
      [this._sensorNodeIds, this._runStartedAt]
    );
    const row = res.rows[0];
    const span = Number(row?.span_sec) || 0;
    return {
      totalInserts: row?.cnt ?? 0,
      insertRatePerSec: span > 0 ? Number(row.cnt) / span : 0,
    };
  }

  start() {
    this._timer = setInterval(async () => {
      try {
        const count = await this.countDelta();
        const rate = await this.fetchInsertRate();
        this.samples.push({
          t: Date.now(),
          dbRows: count,
          insertRatePerSec: rate.insertRatePerSec,
        });
      } catch (err) {
        this.samples.push({ t: Date.now(), error: err.message });
      }
    }, this.intervalMs);
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  async getFinalCount() {
    return this.countDelta();
  }

  async close() {
    await this.pool.end();
  }

  getSummary() {
    const valid = this.samples.filter((sample) => !sample.error);
    const rates = valid.map((sample) => sample.insertRatePerSec).filter((value) => value > 0);
    const last = valid[valid.length - 1];
    return {
      dbRowsFinal: last?.dbRows ?? 0,
      insertRateAvg: rates.length ? rates.reduce((sum, value) => sum + value, 0) / rates.length : 0,
      insertRateMax: rates.length ? Math.max(...rates) : 0,
      samples: this.samples,
    };
  }

  _assertReady() {
    if (!this._runStartedAt) throw new Error("Run start timestamp is not set");
    if (!this._sensorNodeIds.length) throw new Error("Selected sensor_node IDs are not set");
  }
}
