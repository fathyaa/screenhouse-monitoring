/**
 * Poll RabbitMQ Management API for queue depth & rates.
 */

export class RabbitMqMetricsCollector {
  constructor({ mgmtUrl, user, password, queue, intervalMs = 5000 }) {
    this.baseUrl = mgmtUrl.replace(/\/$/, "");
    this.auth = Buffer.from(`${user}:${password}`).toString("base64");
    this.queue = queue;
    this.intervalMs = intervalMs;
    this.samples = [];
    this._timer = null;
  }

  async fetchOnce() {
    const vhost = encodeURIComponent("/");
    const name = encodeURIComponent(this.queue);
    const res = await fetch(`${this.baseUrl}/api/queues/${vhost}/${name}`, {
      headers: { Authorization: `Basic ${this.auth}` },
    });
    if (!res.ok) throw new Error(`RabbitMQ mgmt HTTP ${res.status}`);
    return res.json();
  }

  start() {
    this._timer = setInterval(async () => {
      try {
        const q = await this.fetchOnce();
        const details = q.message_stats ?? {};
        this.samples.push({
          t: Date.now(),
          messages: q.messages ?? 0,
          messagesReady: q.messages_ready ?? 0,
          messagesUnacked: q.messages_unacknowledged ?? 0,
          publishRate: details.publish_details?.rate ?? 0,
          deliverRate: details.deliver_get_details?.rate ?? 0,
          ackRate: details.ack_details?.rate ?? 0,
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

  getSummary() {
    const valid = this.samples.filter((s) => !s.error);
    const depths = valid.map((s) => s.messages);
    const pub = valid.map((s) => s.publishRate);
    const ack = valid.map((s) => s.ackRate);

    return {
      queueDepthMax: depths.length ? Math.max(...depths) : null,
      queueDepthAvg: depths.length ? depths.reduce((a, b) => a + b, 0) / depths.length : null,
      publishRateAvg: pub.length ? pub.reduce((a, b) => a + b, 0) / pub.length : null,
      consumeRateAvg: ack.length ? ack.reduce((a, b) => a + b, 0) / ack.length : null,
      samples: this.samples,
    };
  }
}
