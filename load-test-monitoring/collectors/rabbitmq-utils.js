/**
 * RabbitMQ Management API helpers — queue depth, purge, wait for drain.
 */

export async function fetchQueueDepth(env) {
  const mgmtUrl = (env.RABBITMQ_MGMT_URL || "http://localhost:15672").replace(/\/$/, "");
  const user = env.RABBITMQ_USER || "screenhouse";
  const password = env.RABBITMQ_PASSWORD || "screenhouse";
  const queue = env.RABBITMQ_QUEUE || "sensor-ingest";
  const auth = Buffer.from(`${user}:${password}`).toString("base64");
  const vhost = encodeURIComponent("/");
  const name = encodeURIComponent(queue);

  const res = await fetch(`${mgmtUrl}/api/queues/${vhost}/${name}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) throw new Error(`RabbitMQ mgmt HTTP ${res.status}`);
  const q = await res.json();
  return {
    messages: q.messages ?? 0,
    messagesReady: q.messages_ready ?? 0,
    messagesUnacked: q.messages_unacknowledged ?? 0,
  };
}

export async function purgeQueue(env) {
  const mgmtUrl = (env.RABBITMQ_MGMT_URL || "http://localhost:15672").replace(/\/$/, "");
  const user = env.RABBITMQ_USER || "screenhouse";
  const password = env.RABBITMQ_PASSWORD || "screenhouse";
  const queue = env.RABBITMQ_QUEUE || "sensor-ingest";
  const auth = Buffer.from(`${user}:${password}`).toString("base64");
  const vhost = encodeURIComponent("/");
  const name = encodeURIComponent(queue);

  const res = await fetch(`${mgmtUrl}/api/queues/${vhost}/${name}/contents`, {
    method: "DELETE",
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) throw new Error(`RabbitMQ purge HTTP ${res.status}`);
  const body = await res.json();
  return body.messages_purged ?? 0;
}

export async function waitForEmptyQueue(env, { maxSec = 120, pollSec = 5, label = "pre-run" } = {}) {
  const start = Date.now();
  let lastDepth = null;

  while ((Date.now() - start) / 1000 < maxSec) {
    const { messages } = await fetchQueueDepth(env);
    lastDepth = messages;
    if (messages === 0) {
      console.log(`  ✓ Antrian kosong (${label})`);
      return { drained: true, depth: 0, elapsedSec: Math.floor((Date.now() - start) / 1000) };
    }
    const elapsed = Math.floor((Date.now() - start) / 1000);
    if (elapsed % 30 === 0 && elapsed > 0) {
      console.log(`  [${label} ${elapsed}s/${maxSec}s] queue=${messages}`);
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
