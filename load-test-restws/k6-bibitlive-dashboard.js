/**
 * BibitLive (Screenhouse Monitoring) — k6 load test
 *
 * Simulates concurrent dashboard users: REST API + Socket.IO live stream.
 *
 * Prerequisites:
 *   - Docker: postgres-app, postgres-monitoring, redis
 *   - app-service      → http://localhost:8000
 *   - monitoring-service → http://localhost:3001 (Socket.IO)
 *   - STOP npm run simulate (and other MQTT publishers) unless testing combined ingest load
 *   - REPRESENTATIVE DATA: seed so EVERY test farmer owns a screenhouse with
 *     sensor readings + a completed semai cycle — otherwise most VUs hit empty
 *     result sets and latency is meaningless. Use the per-farmer seed mode:
 *       cd database/scripts
 *       STRESS_FARMER_COUNT=555 STRESS_PER_FARMER=1 npm run seed:stress
 *
 * Run:
 *   k6 run load-tests/k6-bibitlive-dashboard.js
 *
 * Env overrides:
 *   BASE_URL=http://localhost:8000
 *   MONITORING_WS_URL=ws://localhost:3001
 *   TEST_USERS_FILE=load-tests/users.json
 *   WS_HOLD_SEC=20              # set 0 for an API-throughput-only profile (no WS hold)
 *   RELOGIN_EACH_ITER=1         # re-login every iteration (exercises bcrypt/auth cost)
 */

import http from "k6/http";
import { check, sleep } from "k6";
import ws from "k6/ws";
import { Counter } from "k6/metrics";

// ─── Substitute base URLs here ───────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || "http://localhost:8000";
const MONITORING_WS_URL = __ENV.MONITORING_WS_URL || "ws://localhost:3001";
const WS_HOLD_SEC = Number(__ENV.WS_HOLD_SEC || 20);
const RELOGIN_EACH_ITER = /^(1|true|yes)$/i.test(__ENV.RELOGIN_EACH_ITER || "");

// HTTP endpoints (App Service — no /api/v1 prefix in this project)
const LOGIN_URL = `${BASE_URL}/auth/login`;
const DASHBOARD_URL = `${BASE_URL}/screenhouses/my-screenhouses`;
const CYCLES_HISTORY_URL = `${BASE_URL}/screenhouses/my-cycles?status=completed`;
const LATEST_SENSOR_URL = `${BASE_URL}/sensor-data/latest`;

// Socket.IO (Engine.IO v4 over WebSocket) — NOT raw /ws/live-sensor
const SOCKET_IO_PATH = "/socket.io/?EIO=4&transport=websocket";

// ─── Custom metrics ──────────────────────────────────────────────────────────
const wsConnectionErrors = new Counter("ws_connection_errors");
const wsMessagesReceived = new Counter("ws_messages_received");

// ─── Test users pool ─────────────────────────────────────────────────────────
// Generate with: STRESS_FARMER_COUNT=555 npm run seed:stress (database/scripts)
// Phones: 081300000001 .. 081300000555 · password: 123456
const FALLBACK_USERS = Array.from({ length: 555 }, (_, i) => ({
  phone_number: `0813${String(i + 1).padStart(8, "0")}`,
  password: "123456",
}));

function loadUsers() {
  const file = __ENV.TEST_USERS_FILE;
  if (!file) return FALLBACK_USERS;
  try {
    const parsed = JSON.parse(open(file));
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("empty");
    }
    return parsed;
  } catch {
    console.warn(`TEST_USERS_FILE invalid (${file}), using built-in pool`);
    return FALLBACK_USERS;
  }
}

const USERS = loadUsers();

// ─── k6 options ──────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    bibitlive_dashboard: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "2m", target: 555 }, // Stage 1: ramp up to 555 VUs
        { duration: "5m", target: 555 }, // Stage 2: sustained load
        { duration: "1m", target: 0 },   // Stage 3: ramp down
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<2000"],
    ws_connection_errors: ["count==0"],
  },
};

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
}

function login(user) {
  const res = http.post(
    LOGIN_URL,
    JSON.stringify({
      phone_number: user.phone_number,
      password: user.password,
    }),
    {
      headers: { "Content-Type": "application/json" },
      tags: { name: "POST /auth/login" },
    }
  );

  const ok = check(res, {
    "login status 200": (r) => r.status === 200,
    "login has token": (r) => Boolean(r.json("token")),
  });

  if (!ok) return null;

  return {
    token: res.json("token"),
    userId: String(res.json("user.id")),
  };
}

/**
 * Socket.IO over Engine.IO WebSocket:
 *   1. Receive `0{...}` (open)
 *   2. Send `40` (connect default namespace)
 *   3. Receive `40{...}` (connected)
 *   4. Emit authenticate → `42["authenticate",{"userId":"..."}]`
 *   5. Listen for `42[...]` event packets (sensor-update, alert-update, …)
 */
function connectSocketIO(userId) {
  const url = `${MONITORING_WS_URL}${SOCKET_IO_PATH}`;
  let connected = false;
  let authenticated = false;
  let hadError = false;

  const res = ws.connect(url, {}, (socket) => {
    socket.on("open", () => {
      // Engine.IO open packet arrives as first message
    });

    socket.on("message", (raw) => {
      const data = String(raw);

      if (data.startsWith("0") && !connected) {
        connected = true;
        socket.send("40");
        return;
      }

      if (data.startsWith("40") && !authenticated) {
        authenticated = true;
        socket.send(`42["authenticate",{"userId":"${userId}"}]`);
        return;
      }

      if (data.startsWith("42")) {
        wsMessagesReceived.add(1);
      }
    });

    socket.on("error", () => {
      hadError = true;
      wsConnectionErrors.add(1);
    });

    socket.on("close", () => {
      if (!authenticated) {
        hadError = true;
        wsConnectionErrors.add(1);
      }
    });

    socket.setTimeout(() => {
      try {
        socket.send("41"); // Socket.IO disconnect
      } catch {
        // socket may already be closed
      }
      socket.close();
    }, WS_HOLD_SEC * 1000);
  });

  const upgraded = check(res, {
    "websocket upgrade 101": (r) => r && r.status === 101,
  });

  if (!upgraded || hadError) {
    wsConnectionErrors.add(1);
  }
}

// Cached per VU — user stays logged in like a real browser session
let vuSession = null;

export default function () {
  const user = USERS[(__VU - 1) % USERS.length];

  // Default: login once per VU (like a browser session keeping its JWT).
  // RELOGIN_EACH_ITER=1 forces auth every iteration so bcrypt/login cost is
  // actually exercised under load, not paid only vus_max times.
  if (!vuSession || RELOGIN_EACH_ITER) {
    vuSession = login(user);
  }
  if (!vuSession) {
    sleep(1);
    return;
  }

  const headers = authHeaders(vuSession.token);

  // A. Dashboard screenhouse list (petani)
  const dashRes = http.get(DASHBOARD_URL, {
    headers,
    tags: { name: "GET /screenhouses/my-screenhouses" },
  });

  // B. Riwayat siklus semai
  const cyclesRes = http.get(CYCLES_HISTORY_URL, {
    headers,
    tags: { name: "GET /screenhouses/my-cycles" },
  });

  // Extra call the real dashboard makes on load (latest sensor per screenhouse)
  const sensorRes = http.get(LATEST_SENSOR_URL, {
    headers,
    tags: { name: "GET /sensor-data/latest" },
  });

  // Verify responses so silent 4xx/5xx — or empty result sets from unseeded
  // farmers (which would make latency meaningless) — surface as failed checks.
  check(dashRes, {
    "dashboard 200": (r) => r.status === 200,
    "dashboard not empty": (r) => Array.isArray(r.json()) && r.json().length > 0,
  });
  check(cyclesRes, { "cycles 200": (r) => r.status === 200 });
  check(sensorRes, { "latest sensor 200": (r) => r.status === 200 });

  // C. Socket.IO live stream (hold WS_HOLD_SEC; set 0 for API-only profile)
  if (WS_HOLD_SEC > 0) {
    connectSocketIO(vuSession.userId);
  }

  // D. Think time before next loop
  sleep(1 + Math.random() * 2);
}
