/**
 * RabbitMQ Management API helpers — queue depth, purge, wait for drain.
 *
 * Menangani DUA topologi sekaligus:
 *   arsitektur lama  → satu antrean `sensor-ingest`
 *   arsitektur baru  → `q.ingest` (tugas) + `q.persist` (menunggu INSERT)
 *
 * Daftar default memuat keduanya dan antrean yang tidak ada diabaikan (404 →
 * 0). Itu disengaja: harness yang sama harus bisa mengukur kedua arsitektur
 * tanpa perubahan konfigurasi, karena begitu konfigurasinya berbeda hasilnya
 * tidak lagi bisa dibandingkan.
 *
 * `q.alert` TIDAK dihitung: alert berjalan di hilir INSERT, jadi antreannya
 * boleh belum kosong saat seluruh baris sudah mendarat di sensor_data.
 */

const DEFAULT_QUEUES = ["sensor-ingest", "q.ingest", "q.persist"];

function mgmtConfig(env) {
  return {
    url: (env.RABBITMQ_MGMT_URL || "http://localhost:15672").replace(/\/$/, ""),
    auth: Buffer.from(
      `${env.RABBITMQ_USER || "screenhouse"}:${env.RABBITMQ_PASSWORD || "screenhouse"}`
    ).toString("base64"),
  };
}

function queueNames(env) {
  const raw = env.RABBITMQ_QUEUES || env.RABBITMQ_QUEUE;
  if (!raw) return DEFAULT_QUEUES;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Kedalaman satu antrean; null bila antreannya tidak ada di broker. */
async function fetchOneQueue(env, queue) {
  const { url, auth } = mgmtConfig(env);
  const vhost = encodeURIComponent("/");
  const name = encodeURIComponent(queue);

  const res = await fetch(`${url}/api/queues/${vhost}/${name}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`RabbitMQ mgmt HTTP ${res.status}`);
  const q = await res.json();
  return {
    messages: q.messages ?? 0,
    messagesReady: q.messages_ready ?? 0,
    messagesUnacked: q.messages_unacknowledged ?? 0,
  };
}

/** Total kedalaman seluruh antrean yang menahan pekerjaan sebelum INSERT. */
export async function fetchQueueDepth(env) {
  let messages = 0;
  let messagesReady = 0;
  let messagesUnacked = 0;
  let found = 0;
  const perQueue = {};

  for (const queue of queueNames(env)) {
    const q = await fetchOneQueue(env, queue);
    if (!q) continue;
    found += 1;
    perQueue[queue] = q.messages;
    messages += q.messages;
    messagesReady += q.messagesReady;
    messagesUnacked += q.messagesUnacked;
  }

  if (found === 0) {
    throw new Error(`tidak ada antrean yang cocok: ${queueNames(env).join(", ")}`);
  }

  return { messages, messagesReady, messagesUnacked, perQueue };
}

export async function purgeQueue(env) {
  const { url, auth } = mgmtConfig(env);
  const vhost = encodeURIComponent("/");
  let purged = 0;

  for (const queue of queueNames(env)) {
    const name = encodeURIComponent(queue);
    const res = await fetch(`${url}/api/queues/${vhost}/${name}/contents`, {
      method: "DELETE",
      headers: { Authorization: `Basic ${auth}` },
    });
    if (res.status === 404) continue;
    if (!res.ok) throw new Error(`RabbitMQ purge HTTP ${res.status} (${queue})`);
    const body = await res.json().catch(() => ({}));
    purged += body.messages_purged ?? 0;
  }

  return purged;
}

export async function waitForEmptyQueue(env, { maxSec = 120, pollSec = 5, label = "pre-run" } = {}) {
  const start = Date.now();
  let lastDepth = null;

  while ((Date.now() - start) / 1000 < maxSec) {
    const { messages, perQueue } = await fetchQueueDepth(env);
    lastDepth = messages;
    if (messages === 0) {
      console.log(`  ✓ Antrian kosong (${label})`);
      return { drained: true, depth: 0, elapsedSec: Math.floor((Date.now() - start) / 1000) };
    }
    const elapsed = Math.floor((Date.now() - start) / 1000);
    if (elapsed % 30 === 0 && elapsed > 0) {
      const detail = Object.entries(perQueue)
        .map(([q, n]) => `${q}=${n}`)
        .join(" ");
      console.log(`  [${label} ${elapsed}s/${maxSec}s] ${detail}`);
    }
    await new Promise((r) => setTimeout(r, pollSec * 1000));
  }

  return {
    drained: false,
    depth: lastDepth,
    elapsedSec: Math.floor((Date.now() - start) / 1000),
  };
}

export async function ensureCleanQueue(env, defaults) {
  const preDrainMaxSec = Number(defaults.preDrainMaxSec ?? 120);
  const pollSec = Number(defaults.cooldownPollSec ?? 5);
  const purgeIfBacklog = defaults.purgeQueueIfBacklog !== false;

  let depth;
  try {
    ({ messages: depth } = await fetchQueueDepth(env));
  } catch (err) {
    console.warn(`  Warning: tidak bisa cek antrian RabbitMQ (${err.message})`);
    return { backlogAtStart: null, purged: 0 };
  }

  if (depth === 0) {
    console.log("  Antrian RabbitMQ kosong — siap dijalankan");
    return { backlogAtStart: 0, purged: 0, drained: true };
  }

  console.log(`  ⚠ Antrian RabbitMQ masih ${depth} pesan (sisa run sebelumnya)`);
  console.log(`  Menunggu drain hingga ${preDrainMaxSec}s…`);

  const wait = await waitForEmptyQueue(env, {
    maxSec: preDrainMaxSec,
    pollSec,
    label: "pre-drain",
  });

  if (wait.drained) {
    return { backlogAtStart: depth, purged: 0, drained: true, drainedSec: wait.elapsedSec };
  }

  if (!purgeIfBacklog) {
    console.warn(`  Antrian masih ${wait.depth} — lanjut tanpa purge (purgeQueueIfBacklog=false)`);
    return { backlogAtStart: depth, purged: 0, drained: false };
  }

  const purged = await purgeQueue(env);
  console.log(`  Purge antrian: ${purged} pesan dihapus agar skenario terukur independen`);
  return { backlogAtStart: depth, purged, drained: true };
}
