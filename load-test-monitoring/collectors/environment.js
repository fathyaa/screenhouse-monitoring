/**
 * Rekam kondisi pengujian ke dalam file hasil.
 *
 * Ada karena hasil 4 Agustus 2026 tidak menyimpan satu pun informasi resource,
 * sehingga tidak bisa dibuktikan apakah run itu memakai batas `prod-sim` atau
 * tanpa batas. Tanpa catatan ini, dua seri tidak bisa dinyatakan sebanding —
 * dan itu pertanyaan pertama yang akan diajukan penguji.
 */

import { execFileSync } from "node:child_process";

function sh(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

// Nama project Docker Compose milik sistem ini. Mesin dev ini juga menjalankan
// stack lain (Spark/Hadoop) yang punya batas CPU sendiri — tanpa filter ini,
// container asing itu membuat resourceProfile terbaca "prod-sim" padahal
// container BibitLive-nya justru tanpa batas.
const COMPOSE_PROJECT = process.env.LOADTEST_COMPOSE_PROJECT || "docker";

/** Batas CPU/memori efektif tiap container milik project ini. */
function containerLimits() {
  const raw = sh("docker", [
    "ps",
    "--filter",
    `label=com.docker.compose.project=${COMPOSE_PROJECT}`,
    "--format",
    "{{.Names}}",
  ]);
  if (raw == null) return null;

  const names = raw.split("\n").filter(Boolean);
  const limits = {};

  for (const name of names) {
    const inspected = sh("docker", [
      "inspect",
      name,
      "--format",
      "{{.HostConfig.NanoCpus}}|{{.HostConfig.Memory}}|{{index .Config.Labels \"com.docker.compose.service\"}}",
    ]);
    if (!inspected) continue;
    const [nanoCpus, memory, service] = inspected.split("|");
    limits[name] = {
      service: service || null,
      // 0 berarti tidak dibatasi — dibedakan dari "tidak diketahui" (null).
      cpus: Number(nanoCpus) > 0 ? Number(nanoCpus) / 1e9 : 0,
      memoryMb: Number(memory) > 0 ? Math.round(Number(memory) / 1024 / 1024) : 0,
    };
  }

  return limits;
}

/** Jumlah container per service compose — inilah "replica" yang sebenarnya jalan. */
function replicaCounts(limits) {
  const counts = {};
  for (const info of Object.values(limits ?? {})) {
    if (!info.service) continue;
    counts[info.service] = (counts[info.service] ?? 0) + 1;
  }
  return counts;
}

/**
 * @param {object} opts
 * @param {string} opts.ingestMode direct | rabbitmq | listener
 * @param {object|null} opts.topology blok `topology` dari /stats/ingest (arsitektur baru)
 */
export function captureEnvironment({ ingestMode, topology = null } = {}) {
  const limits = containerLimits();
  const replicas = replicaCounts(limits);

  // Ada-tidaknya batas CPU adalah pembeda konfigurasi A (anggaran produksi)
  // dan B (tanpa batas). Disimpulkan dari container, bukan dari nama file
  // override, karena override bisa saja lupa dipakai.
  //
  // "mixed" bukan kasus teoretis: pernah terjadi hanya rabbitmq yang terbatas
  // 1 CPU sementara sisanya bebas, karena override dipakai sebagian lalu stack
  // dinaikkan ulang tanpanya. Run pada keadaan itu TIDAK sebanding dengan run
  // mana pun dan harus diulang — jadi keadaannya wajib terlihat, bukan
  // dibulatkan ke salah satu profil.
  const values = Object.values(limits ?? {});
  const limitedCount = values.filter((l) => l.cpus > 0).length;
  const resourceProfile =
    limits == null
      ? "unknown"
      : limitedCount === 0
        ? "unlimited"
        : limitedCount === values.length
          ? "prod-sim"
          : "mixed";

  return {
    capturedAt: new Date().toISOString(),
    ingestMode: ingestMode ?? null,
    resourceProfile,
    replicas,
    containerLimits: limits,
    topology,
    git: {
      branch: sh("git", ["rev-parse", "--abbrev-ref", "HEAD"]),
      commit: sh("git", ["rev-parse", "--short", "HEAD"]),
    },
    host: {
      platform: process.platform,
      arch: process.arch,
      cpus: sh("sysctl", ["-n", "hw.ncpu"]) ?? null,
      memBytes: sh("sysctl", ["-n", "hw.memsize"]) ?? null,
    },
  };
}
