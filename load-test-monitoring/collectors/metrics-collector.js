/**
 * Orchestrates all metric collectors for a scenario run.
 */

import { BackendMetricsCollector } from "./backend-metrics.js";
import { RabbitMqMetricsCollector } from "./rabbitmq-metrics.js";
import { DatabaseMetricsCollector } from "./database-metrics.js";

export class MetricsCollector {
  constructor(env) {
    const intervalMs = Number(env.METRICS_INTERVAL_MS || 5000);

    this.backend = new BackendMetricsCollector({
      baseUrl: env.MONITORING_URL || "http://localhost:3001",
      intervalMs,
    });

    this.rabbitmq = new RabbitMqMetricsCollector({
      mgmtUrl: env.RABBITMQ_MGMT_URL || "http://localhost:15672",
      user: env.RABBITMQ_USER || "screenhouse",
      password: env.RABBITMQ_PASSWORD || "screenhouse",
      queue: env.RABBITMQ_QUEUE || "sensor-ingest",
      intervalMs,
    });

    this.database = new DatabaseMetricsCollector({
      host: env.DB_HOST || "localhost",
      port: Number(env.DB_PORT || 5433),
      user: env.DB_USER || "postgres",
      password: env.DB_PASSWORD || "postgres",
      database: env.DB_NAME || "screenhouse_monitoring",
      intervalMs,
    });
  }

  async prepareRun(runId) {
    await this.backend.reset(runId);
  }

  start(runStartedAt) {
    this.database.setRunStart(runStartedAt);
    this.backend.start();
    this.rabbitmq.start();
    this.database.start();
  }

  stop() {
    this.backend.stop();
    this.rabbitmq.stop();
    this.database.stop();
  }

  async finalize() {
    const dbFinal = await this.database.getFinalCount();
    return {
      backend: this.backend.getSummary(),
      rabbitmq: this.rabbitmq.getSummary(),
      database: { ...this.database.getSummary(), dbRowsFinal: dbFinal },
    };
  }

  async close() {
    await this.database.close();
  }
}
