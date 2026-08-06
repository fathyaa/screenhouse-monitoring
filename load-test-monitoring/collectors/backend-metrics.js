/**
 * Poll monitoring-service /stats/ingest for backend counters & latency.
 */

export class BackendMetricsCollector {
  constructor({ baseUrl, intervalMs = 5000 }) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.intervalMs = intervalMs;
    this.samples = [];
    this._timer = null;
    this._last = null;
  }

  async reset(runId) {
    await fetch(`${this.baseUrl}/stats/ingest/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId }),
    });
  }

  async fetchOnce() {
    const res = await fetch(`${this.baseUrl}/stats/ingest`);
    if (!res.ok) throw new Error(`Backend stats HTTP ${res.status}`);
    return res.json();
  }

  /**
   * Ambil counter final langsung dari backend, bukan dari sampel polling
   * terakhir yang bisa basi sampai satu interval penuh. Tanpa ini,
   * mqttReceived/mqttProcessed selalu tampak lebih kecil dari messagesSent
   * walaupun tidak ada satu pesan pun yang hilang.
   *
   * Sengaja tidak mendorong sampel baru ke this.samples: deret waktu itu dipakai
   * untuk box plot distribusi selama beban berjalan, dan sampel pasca-run akan
   * mencemarinya.
   */
  async captureFinal({ settleMaxSec = 20, pollMs = 2000 } = {}) {
    // Di arsitektur listener, counter tiba di role `api` lewat laporan berkala
    // (default tiap 5 detik), jadi pembacaan tepat setelah beban berhenti selalu
    // tertinggal satu interval. Tanpa penantian ini, run yang sebenarnya utuh
    // terbaca 99,5% padahal hitungan database sudah 100%.
    //
    // Berhenti begitu angkanya tidak bergerak lagi — bukan tidur selama durasi
    // tetap — supaya arsitektur lama (counter in-process, langsung final) tidak
    // ikut membayar penundaan.
    const start = Date.now();
    let previous = null;
    let stableCount = 0;

    while ((Date.now() - start) / 1000 < settleMaxSec) {
      const snap = await this.fetchOnce();
      this._last = snap;

      const total = Number(snap.mqttProcessed ?? 0) + Number(snap.mqttReceived ?? 0);
      if (previous != null && total === previous) {
        if (++stableCount >= 2) return snap;
      } else {
        stableCount = 0;
      }
      previous = total;
      await new Promise((r) => setTimeout(r, pollMs));
    }

    return this._last ?? (await this.fetchOnce());
  }

  start() {
    this._timer = setInterval(async () => {
      try {
        const snap = await this.fetchOnce();
        this._last = snap;
        this.samples.push({
          t: Date.now(),
          mqttReceived: snap.mqttReceived,
          mqttProcessed: snap.mqttProcessed,
          mqttEnqueued: snap.mqttEnqueued,
          mqttFailed: snap.mqttFailed,
          mqttNacked: snap.mqttNacked,
          receiveRatePerSec: snap.receiveRatePerSec,
          processRatePerSec: snap.processRatePerSec,
          queueDepth: snap.queueDepth,
          latencyAvgMs: snap.latency?.avgMs,
          latencyP95Ms: snap.latency?.p95Ms,
          latencyP99Ms: snap.latency?.p99Ms,
          rssMb: snap.memory?.rssMb,
          heapUsedMb: snap.memory?.heapUsedMb,
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
    const last = this._last;
    const depths = this.samples.map((s) => s.queueDepth).filter((v) => v != null);
    const rss = this.samples.map((s) => s.rssMb).filter((v) => v != null);

    return {
      ingestMode: last?.ingestMode ?? null,
      mqttReceived: last?.mqttReceived ?? 0,
      mqttProcessed: last?.mqttProcessed ?? 0,
      mqttEnqueued: last?.mqttEnqueued ?? 0,
      mqttFailed: last?.mqttFailed ?? 0,
      mqttNacked: last?.mqttNacked ?? 0,
      // Dipisah sejak consumer berhenti membuang pesan: dead-letter = gagal
      // permanen (tersimpan, bisa di-replay), requeue = percobaan ulang saat
      // infrastruktur down, bukan kegagalan.
      mqttDeadLettered: last?.mqttDeadLettered ?? last?.mqttNacked ?? 0,
      mqttRequeued: last?.mqttRequeued ?? 0,
      successRatePct: last?.successRatePct,
      errorRatePct: last?.errorRatePct,
      receiveRatePerSec: last?.receiveRatePerSec,
      processRatePerSec: last?.processRatePerSec,
      latency: last?.latency ?? {},
      queueDepthMax: depths.length ? Math.max(...depths) : null,
      queueDepthAvg: depths.length ? depths.reduce((a, b) => a + b, 0) / depths.length : null,
      rssMbMax: rss.length ? Math.max(...rss) : null,
      rssMbAvg: rss.length ? rss.reduce((a, b) => a + b, 0) / rss.length : null,
      samples: this.samples,
      timeSeries: last?.timeSeries ?? [],
    };
  }
}
