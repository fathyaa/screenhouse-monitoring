/**
 * BibitLive — k6 load test aplikasi (multi-profil)
 *
 * Satu file, lima profil beban. Pilih lewat env PROFILE, jalankan satu per satu
 * supaya hasil tiap profil bersih dan mudah dibandingkan.
 *
 * Prasyarat data representatif (WAJIB, kalau tidak latensi jadi semu):
 *   cd database/scripts
 *   STRESS_FARMER_COUNT=555 STRESS_PER_FARMER=1 npm run seed:stress
 *
 * Cara jalan (pilih salah satu profil; pakai -e biar env pasti terbaca):
 *   k6 run -e PROFILE=baseline  k6-bibitlive-scenarios.js   # acuan, ramp landai ke 50 VU
 *   k6 run -e PROFILE=ramping   k6-bibitlive-scenarios.js   # naik bertahap ke 555 VU
 *   k6 run -e PROFILE=spike     k6-bibitlive-scenarios.js   # lonjakan mendadak
 *   k6 run -e PROFILE=soak      k6-bibitlive-scenarios.js   # endurance 30 menit
 *   k6 run -e PROFILE=saturasi  k6-bibitlive-scenarios.js   # cari titik jenuh API (arrival-rate)
 *
 * Ulangi 3x untuk melihat variansi:
 *   for i in 1 2 3; do k6 run -e PROFILE=ramping k6-bibitlive-scenarios.js; done
 *
 * Env lain:
 *   BASE_URL=http://localhost:8000
 *   MONITORING_WS_URL=ws://localhost:3001
 *   WS_HOLD_SEC=20         # 0 = tanpa hold WebSocket (profil murni API)
 *   RELOGIN_EACH_ITER=1    # login tiap iterasi (biar biaya bcrypt ikut terukur)
 *   VUS / DURATION / MAX_VUS  # override angka default per profil
 *   POOL_SIZE=50           # (khusus saturasi) jumlah token login disiapkan di setup()
 */

import http from "k6/http";
import { check, sleep } from "k6";
import ws from "k6/ws";
import { Counter, Trend } from "k6/metrics";

// ─── URL & konfigurasi ───────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || "http://localhost:8000";
const MONITORING_WS_URL = __ENV.MONITORING_WS_URL || "ws://localhost:3001";
const WS_HOLD_SEC = Number(__ENV.WS_HOLD_SEC || 20);
const RELOGIN_EACH_ITER = /^(1|true|yes)$/i.test(__ENV.RELOGIN_EACH_ITER || "");
const PROFILE = __ENV.PROFILE || "ramping";

const LOGIN_URL = `${BASE_URL}/auth/login`;
const DASHBOARD_URL = `${BASE_URL}/screenhouses/my-screenhouses`;
const CYCLES_HISTORY_URL = `${BASE_URL}/screenhouses/my-cycles?status=completed`;
const LATEST_SENSOR_URL = `${BASE_URL}/sensor-data/latest`;
const SOCKET_IO_PATH = "/socket.io/?EIO=4&transport=websocket";

// ─── Metrik kustom ───────────────────────────────────────────────────────────
const wsConnectionErrors = new Counter("ws_connection_errors");
const wsMessagesReceived = new Counter("ws_messages_received");
// Latensi per-endpoint. Dibuat sebagai Trend sendiri supaya selalu muncul di
// ringkasan akhir (metrik ber-tag hanya muncul kalau punya threshold).
const durLogin = new Trend("dur_login", true);
const durDashboard = new Trend("dur_dashboard", true);
const durCycles = new Trend("dur_cycles", true);
const durSensor = new Trend("dur_sensor", true);

// ─── Kolam akun uji ──────────────────────────────────────────────────────────
// Telepon 081300000001 .. 081300000555 · password 123456 (hasil seed:stress).
const USERS = Array.from({ length: 555 }, (_, i) => ({
  phone_number: `0813${String(i + 1).padStart(8, "0")}`,
  password: "123456",
}));

// ─── Profil beban ────────────────────────────────────────────────────────────
const SCENARIOS = {
  // Acuan tenang: naik landai 30 detik ke 50 VU lalu tahan. Ramp landai ini
  // sengaja, supaya login (bcrypt) tidak meledak serentak di detik nol dan
  // angka baseline mencerminkan kondisi stabil, bukan badai start.
  baseline: {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      { duration: "30s", target: Number(__ENV.VUS || 50) },
      { duration: __ENV.DURATION || "3m", target: Number(__ENV.VUS || 50) },
      { duration: "10s", target: 0 },
    ],
    gracefulRampDown: "20s",
    exec: "browse",
  },

  // Naik bertahap ke 555 VU lalu tahan, meniru lonjakan pengguna masuk.
  ramping: {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      { duration: "2m", target: 555 },
      { duration: "5m", target: 555 },
      { duration: "1m", target: 0 },
    ],
    gracefulRampDown: "30s",
    exec: "browse",
  },

  // Lonjakan mendadak lalu pulih, menguji reaksi terhadap hentakan.
  spike: {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      { duration: "1m", target: 100 },   // beban normal
      { duration: "30s", target: 800 },  // hentakan
      { duration: "1m", target: 800 },
      { duration: "30s", target: 100 },  // pemulihan
      { duration: "1m", target: 100 },
      { duration: "30s", target: 0 },
    ],
    gracefulRampDown: "30s",
    exec: "browse",
  },

  // Endurance: beban sedang ditahan lama untuk menangkap kebocoran memori.
  // Pakai ramp landai 1 menit dulu (bukan start serentak) supaya login tidak
  // meledak di detik nol, seperti pada baseline.
  soak: {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      { duration: "1m", target: Number(__ENV.VUS || 200) },
      { duration: __ENV.DURATION || "30m", target: Number(__ENV.VUS || 200) },
      { duration: "20s", target: 0 },
    ],
    gracefulRampDown: "30s",
    exec: "browse",
  },

  // Titik jenuh API: memaksa laju request naik terus tanpa peduli server lambat.
  // Inilah "berapa pesawat bisa mendarat" di level API.
  saturasi: {
    executor: "ramping-arrival-rate",
    startRate: 50,
    timeUnit: "1s",
    preAllocatedVUs: 200,
    maxVUs: Number(__ENV.MAX_VUS || 3000),
    stages: [
      { target: 200, duration: "1m" },
      { target: 500, duration: "1m" },
      { target: 1000, duration: "1m" },
      { target: 2000, duration: "1m" },
      { target: 3000, duration: "1m" },
    ],
    exec: "hitOnce",
  },

  // WebSocket murni: tiap VU = satu koneksi realtime yang ditahan (bukan journey
  // REST). Dipakai stepped runner untuk menaikkan JUMLAH KONEKSI KONKUREN
  // bertahap. Yang diukur di sini: latensi buka koneksi (ws_connecting),
  // koneksi gagal (ws_connection_errors), dan berapa koneksi bisa ditahan stabil.
  // Jalankan dengan VUS + WS_HOLD_SEC lewat env (lihat run-stepped.sh).
  wsstep: {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      { duration: "20s", target: Number(__ENV.VUS || 100) },
      { duration: __ENV.DURATION || "1m", target: Number(__ENV.VUS || 100) },
      { duration: "10s", target: 0 },
    ],
    gracefulRampDown: "20s",
    exec: "wsonly",
  },
};

const selected = SCENARIOS[PROFILE];
if (!selected) {
  throw new Error(
    `PROFILE tidak dikenal: "${PROFILE}". Pilihan: ${Object.keys(SCENARIOS).join(", ")}`
  );
}

export const options = {
  scenarios: { [PROFILE]: selected },
  // Persentil lengkap di ringkasan supaya kurva latensi bertahap bisa memakai
  // p50 (median, pengalaman tengah), p95, dan p99 (ekor terburuk), bukan cuma avg.
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
  // Kriteria lulus utama (NFR). Kalau ini terlampaui, memang ada masalah nyata.
  // Latensi per-endpoint TIDAK dijadikan ambang gagal supaya lonjakan pada satu
  // endpoint (mis. login saat start) tidak menandai seluruh run "gagal".
  // Angka per-endpoint tetap diamati dan dicetak di ringkasan akhir.
  thresholds: {
    http_req_failed: ["rate<0.01"],       // < 1% request ditolak/gagal
    http_req_duration: ["p(95)<2000"],    // 95% request di bawah 2 detik
    ws_connection_errors: ["count==0"],   // tidak ada koneksi realtime yang gagal
  },
};

// ─── Helper ──────────────────────────────────────────────────────────────────
function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, Accept: "application/json" };
}

function login(user) {
  const res = http.post(
    LOGIN_URL,
    JSON.stringify({ phone_number: user.phone_number, password: user.password }),
    { headers: { "Content-Type": "application/json" }, tags: { name: "POST /auth/login" } }
  );
  durLogin.add(res.timings.duration);
  const ok = check(res, {
    "login status 200": (r) => r.status === 200,
    "login has token": (r) => Boolean(r.json("token")),
  });
  if (!ok) return null;
  return { token: res.json("token"), userId: String(res.json("user.id")) };
}

// Sesi login di-cache per VU (mirip sesi browser menyimpan JWT).
let vuSession = null;
function ensureSession() {
  const user = USERS[(__VU - 1) % USERS.length];
  if (!vuSession || RELOGIN_EACH_ITER) vuSession = login(user);
  return vuSession;
}

function connectSocketIO(userId) {
  const url = `${MONITORING_WS_URL}${SOCKET_IO_PATH}`;
  let connected = false;
  let authenticated = false;
  let hadError = false;

  const res = ws.connect(url, {}, (socket) => {
    socket.on("message", (raw) => {
      const data = String(raw);
      if (data.startsWith("0") && !connected) { connected = true; socket.send("40"); return; }
      if (data.startsWith("40") && !authenticated) {
        authenticated = true;
        socket.send(`42["authenticate",{"userId":"${userId}"}]`);
        return;
      }
      if (data.startsWith("42")) wsMessagesReceived.add(1);
    });
    socket.on("error", () => { hadError = true; wsConnectionErrors.add(1); });
    socket.on("close", () => { if (!authenticated) { hadError = true; wsConnectionErrors.add(1); } });
    socket.setTimeout(() => {
      try { socket.send("41"); } catch { /* sudah tertutup */ }
      socket.close();
    }, WS_HOLD_SEC * 1000);
  });

  const upgraded = check(res, { "websocket upgrade 101": (r) => r && r.status === 101 });
  if (!upgraded || hadError) wsConnectionErrors.add(1);
}

// ─── Fungsi skenario ─────────────────────────────────────────────────────────

// Login pool sekali di awal (HANYA untuk profil saturasi) supaya tes titik jenuh
// mengukur endpoint data, bukan biaya bcrypt login. Nilai balik setup() diteruskan
// k6 sebagai argumen ke fungsi skenario (hitOnce). Login di setup tidak dihitung
// sebagai beban uji, jadi metrik saturasi bersih dari ongkos login.
export function setup() {
  if (PROFILE !== "saturasi") return { tokens: [] };
  const poolSize = Number(__ENV.POOL_SIZE || 50);
  const tokens = [];
  for (let i = 0; i < poolSize; i += 1) {
    const s = login(USERS[i % USERS.length]);
    if (s) tokens.push(s);
  }
  console.log(`[setup] token pool siap: ${tokens.length}/${poolSize}`);
  return { tokens };
}

// Journey lengkap seorang petani membuka dashboard (dipakai profil berbasis VU).
export function browse() {
  const s = ensureSession();
  if (!s) { sleep(1); return; }
  const headers = authHeaders(s.token);

  const dash = http.get(DASHBOARD_URL, { headers, tags: { name: "GET /screenhouses/my-screenhouses" } });
  durDashboard.add(dash.timings.duration);
  const cyc = http.get(CYCLES_HISTORY_URL, { headers, tags: { name: "GET /screenhouses/my-cycles" } });
  durCycles.add(cyc.timings.duration);
  const sen = http.get(LATEST_SENSOR_URL, { headers, tags: { name: "GET /sensor-data/latest" } });
  durSensor.add(sen.timings.duration);

  check(dash, {
    "dashboard 200": (r) => r.status === 200,
    "dashboard not empty": (r) => Array.isArray(r.json()) && r.json().length > 0,
  });
  check(cyc, { "cycles 200": (r) => r.status === 200 });
  check(sen, { "latest sensor 200": (r) => r.status === 200 });

  if (WS_HOLD_SEC > 0) connectSocketIO(s.userId);
  sleep(1 + Math.random() * 2); // think time 1–3 detik
}

// Satu request tanpa think time / WebSocket / login (profil saturasi arrival-rate).
// Memakai token dari pool setup() agar yang terukur murni endpoint datanya,
// bukan ongkos login bcrypt.
export function hitOnce(data) {
  const pool = data && data.tokens;
  if (!pool || pool.length === 0) return;
  const s = pool[__VU % pool.length];
  const res = http.get(DASHBOARD_URL, {
    headers: authHeaders(s.token),
    tags: { name: "GET /screenhouses/my-screenhouses" },
  });
  durDashboard.add(res.timings.duration);
  check(res, { "saturasi 200": (r) => r.status === 200 });
}

// WebSocket murni: login sekali lalu tahan satu koneksi realtime selama
// WS_HOLD_SEC. Tanpa request REST, supaya metrik mencerminkan skala koneksi
// konkuren (bukan campur beban HTTP). Dipakai profil wsstep.
export function wsonly() {
  const s = ensureSession();
  if (!s) { sleep(1); return; }
  connectSocketIO(s.userId); // memblok selama WS_HOLD_SEC, lalu menutup koneksi
}

// ─── Ringkasan hasil ke JSON + stdout ringkas ────────────────────────────────
export function handleSummary(data) {
  const m = data.metrics;
  const v = (name, stat) => m[name]?.values?.[stat];
  const ms = (x) => (x == null ? "-" : `${x.toFixed(0)}ms`);
  const pct = (x) => (x == null ? "-" : `${(x * 100).toFixed(2)}%`);
  const num = (x) => (x == null ? "-" : x.toFixed(1));
  const ep = (metric) => {
    const val = m[metric]?.values;
    if (!val || val.avg == null) return "-";
    return `avg ${ms(val.avg)}  p95 ${ms(val["p(95)"])}`;
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  // RUN_LABEL dipakai stepped runner: file jadi `step-<track>-<level>-...json`
  // (mis. step-rest-050-...) supaya level beban terbaca dari nama file oleh
  // build-report.py. Tanpa RUN_LABEL, penamaan lama per-profil tetap dipakai.
  const file = __ENV.RUN_LABEL
    ? `step-${__ENV.RUN_LABEL}-${stamp}.json`
    : `summary-${PROFILE}-${stamp}.json`;

  const out = [
    "",
    `  ══ Profil: ${PROFILE} ══════════════════════════`,
    `  Total request      : ${v("http_reqs", "count") ?? "-"}  (${num(v("http_reqs", "rate"))}/detik)`,
    `  Request gagal      : ${pct(v("http_req_failed", "rate"))}`,
    `  Latensi keseluruhan: avg ${ms(v("http_req_duration", "avg"))}  p95 ${ms(v("http_req_duration", "p(95)"))}  max ${ms(v("http_req_duration", "max"))}`,
    `  Iterasi            : ${v("iterations", "count") ?? "-"}  (${num(v("iterations", "rate"))}/detik)`,
    `  VU maks            : ${v("vus_max", "value") ?? "-"}`,
    `  WS error koneksi   : ${v("ws_connection_errors", "count") ?? 0}`,
    "",
    "  ── Latensi per-endpoint ──",
    `  Login     (POST /auth/login)        : ${ep("dur_login")}`,
    `  Dashboard (GET /my-screenhouses)    : ${ep("dur_dashboard")}`,
    `  Riwayat   (GET /my-cycles)          : ${ep("dur_cycles")}`,
    `  Sensor    (GET /sensor-data/latest) : ${ep("dur_sensor")}`,
    "",
    `  JSON lengkap: load-tests/${file}`,
    "",
  ].join("\n");

  return { [file]: JSON.stringify(data, null, 2), stdout: out };
}
