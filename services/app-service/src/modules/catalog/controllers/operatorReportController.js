const pool = require("../../../config/db");
const monitoringPool = require("../../../config/monitoringDb");
const { monitoringGet } = require("../../../shared/monitoringClient");
const { computeStressScore, getCategory } = require("../../../shared/stressScore");
const { buildEstimasiTanamBatch } = require("../../../shared/estimasiTanamService");

const PARAM_LABELS = [
  { key: "nitrogen", label: "Nitrogen" },
  { key: "phosphorus", label: "Phosphorus" },
  { key: "potassium", label: "Kalium" },
  { key: "soil_moisture", label: "Kelembapan tanah" },
  { key: "soil_temperature", label: "Suhu tanah" },
  { key: "soil_ph", label: "pH tanah" },
  { key: "conductivity", label: "Konduktivitas" },
  { key: "air_temperature", label: "Suhu udara" },
  { key: "air_humidity", label: "Kelembapan udara" },
  { key: "light_intensity", label: "Intensitas cahaya" },
];

const GROUP_BY_COLUMNS = {
  regency: { id: "regency_id", name: "regency" },
  district: { id: "district_id", name: "district" },
  village: { id: "village_id", name: "village" },
};

/** Target kebijakan Program IP400: minimal % pembibitan siap tepat waktu. */
const TARGET_READINESS_PCT = 90;
/** Minimal siklus selesai agar statistik durasi dianggap cukup (bukan menyesatkan). */
const MIN_COMPLETED_FOR_DURATION = 5;

/**
 * Parameter yang dikoreksi otomatis oleh aktuator (kipas/irigasi/lampu) — mirror
 * `frontend/src/constants/actuatorRules.js`. Alert pada parameter ini "ditangani
 * otomatis" dan TIDAK dihitung sebagai alert kritis yang butuh tindakan manusia.
 */
const AUTO_HANDLED_PHRASES = [
  "kelembapan tanah",
  "suhu udara",
  "kelembapan udara",
  "suhu tanah",
  "intensitas cahaya",
];

/**
 * True jika pesan alert = pelanggaran threshold yang ditangani aktuator otomatis.
 * Alert "tidak mengirim data" (offline) tidak punya arah maksimum/minimum → bukan
 * auto-handled → tetap dihitung kritis.
 */
function isAutoHandledMessage(message) {
  const lower = (message || "").toLowerCase();
  const hasDirection =
    lower.includes("maksimum") ||
    lower.includes("melebihi") ||
    lower.includes("minimum") ||
    lower.includes("bawah");
  if (!hasDirection) return false;
  return AUTO_HANDLED_PHRASES.some((p) => lower.includes(p));
}

function paramFromMessage(message) {
  if (!message) return { key: "other", label: "Lainnya" };
  const match = PARAM_LABELS.find((p) => message.includes(p.label));
  return match ?? { key: "other", label: "Lainnya" };
}

function parseDays(raw) {
  const days = Number(raw);
  // Terima rentang bebas 1–90 hari (semua query memakai $::int * INTERVAL '1 day',
  // jadi angka apa pun aman). Preset 24 jam / 7 / 30 hari tetap cocok.
  if (Number.isInteger(days) && days >= 1 && days <= 90) return days;
  return 7;
}

function parseGroupBy(raw) {
  if (raw && GROUP_BY_COLUMNS[raw]) return raw;
  return "district";
}

function parseBool(raw, defaultValue = false) {
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return defaultValue;
}

function wibTodayStr() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

function diffCalendarDays(fromStr, toStr) {
  if (!fromStr) return null;
  const from = new Date(`${String(fromStr).slice(0, 10)}T12:00:00+07:00`);
  const to = toStr
    ? new Date(`${String(toStr).slice(0, 10)}T12:00:00+07:00`)
    : new Date(`${wibTodayStr()}T12:00:00+07:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86400000));
}

function screenhouseVarietasName(sh) {
  return sh.varietas_nama || sh.seed_variety || null;
}

function elapsedSemaiDays(sh) {
  return diffCalendarDays(sh.tanggal_semai, null);
}

function dominantVarietasFromCounts(countsMap) {
  if (!countsMap?.size) return null;
  return [...countsMap.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "id")
  )[0][0];
}

function buildVarietasStressRanking(screenhouses, stressMap) {
  const groups = new Map();
  for (const sh of screenhouses) {
    const name = screenhouseVarietasName(sh);
    const score = stressMap[sh.id];
    if (!name || score == null) continue;
    const list = groups.get(name) ?? [];
    list.push(Number(score));
    groups.set(name, list);
  }

  return [...groups.entries()]
    .map(([nama, scores]) => ({
      nama,
      avg_score: avgNumeric(scores),
      screenhouse_count: scores.length,
    }))
    .sort(
      (a, b) =>
        (b.avg_score ?? 0) - (a.avg_score ?? 0) ||
        b.screenhouse_count - a.screenhouse_count
    );
}

/**
 * Statistik durasi dari siklus yang BENAR-BENAR SELESAI (`semai_cycles.completed`),
 * bukan hari-berjalan siklus aktif. Durasi aktual = tanggal_selesai − tanggal_mulai,
 * dibanding target (durasi_target_hari). Menghindari bias in-progress vs full-duration.
 */
function buildVarietasDurationStats(completedCycles) {
  const groups = new Map();
  for (const cyc of completedCycles) {
    const name = cyc.varietas_nama;
    const actual = diffCalendarDays(cyc.tanggal_mulai, cyc.tanggal_selesai);
    if (!name || actual == null) continue;

    const entry = groups.get(name) ?? {
      nama: name,
      actual_days: [],
      standard_days: [],
    };
    entry.actual_days.push(actual);
    if (cyc.durasi_target_hari != null) {
      entry.standard_days.push(Number(cyc.durasi_target_hari));
    }
    groups.set(name, entry);
  }

  return [...groups.values()]
    .map((g) => {
      const avgActual = avgNumeric(g.actual_days);
      const avgStandard = avgNumeric(g.standard_days);
      return {
        nama: g.nama,
        cycle_count: g.actual_days.length,
        avg_actual_days: avgActual,
        avg_standard_days: avgStandard,
        delay_index_days:
          avgActual != null && avgStandard != null
            ? Math.round((avgActual - avgStandard) * 10) / 10
            : null,
      };
    })
    .sort((a, b) => b.cycle_count - a.cycle_count);
}

/**
 * Throughput = output riil program (inti IP400): berapa siklus selesai dalam periode,
 * beserta distribusi grade A/B/C. Flag `low_adoption` bila fitur "selesaikan siklus"
 * hampir tak dipakai (turnover tak terukur).
 */
function buildCycleThroughput(completedCycles) {
  const grade = { A: 0, B: 0, C: 0, ungraded: 0 };
  for (const cyc of completedCycles) {
    if (cyc.grade === "A" || cyc.grade === "B" || cyc.grade === "C") {
      grade[cyc.grade] += 1;
    } else {
      grade.ungraded += 1;
    }
  }
  const total = completedCycles.length;
  return {
    completed_count: total,
    grade,
    low_adoption: total < MIN_COMPLETED_FOR_DURATION,
  };
}

/**
 * Ringkasan kesiapan tanam (outcome IP400): rasio tepat waktu vs target + kalender
 * kesiapan (bucket sisa hari) untuk penjadwalan olah lahan / transplantasi.
 */
function buildReadinessSummary(screenhouses, estimasiMap) {
  const buckets = { overdue: 0, d0_7: 0, d8_14: 0, d15_30: 0, d30_plus: 0, no_estimate: 0 };
  let onTrack = 0;
  let terlambat = 0;
  let perluEvaluasi = 0;

  for (const sh of screenhouses) {
    const est = estimasiMap[sh.id];
    const status = est?.status ?? sh.status_estimasi;
    if (status === "on_track") onTrack += 1;
    else if (status === "terlambat") terlambat += 1;
    else if (status === "perlu_evaluasi") perluEvaluasi += 1;

    const sisa = est?.sisa_hari;
    if (sisa == null) buckets.no_estimate += 1;
    else if (sisa < 0) buckets.overdue += 1;
    else if (sisa <= 7) buckets.d0_7 += 1;
    else if (sisa <= 14) buckets.d8_14 += 1;
    else if (sisa <= 30) buckets.d15_30 += 1;
    else buckets.d30_plus += 1;
  }

  const withStatus = onTrack + terlambat + perluEvaluasi;
  return {
    on_time_readiness_pct: withStatus > 0 ? Math.round((onTrack / withStatus) * 1000) / 10 : null,
    target_readiness_pct: TARGET_READINESS_PCT,
    behind_count: terlambat + perluEvaluasi,
    ready_within_14d: buckets.d0_7 + buckets.d8_14,
    readiness_buckets: buckets,
    on_track: onTrack,
    terlambat,
    perlu_evaluasi: perluEvaluasi,
    with_estimate: withStatus,
  };
}

function formatEstimasiLabel(estimasi) {
  if (!estimasi?.estimasi_siap) return "—";
  const date = new Date(`${estimasi.estimasi_siap}T12:00:00+07:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
  if (estimasi.sisa_hari == null) return date;
  if (estimasi.sisa_hari > 0) return `${estimasi.sisa_hari} hari · ${date}`;
  if (estimasi.sisa_hari === 0) return `Hari ini · ${date}`;
  return `Lewat ${Math.abs(estimasi.sisa_hari)} hari · ${date}`;
}

function buildStressScoreMap(screenhouseIds, monitoringStats) {
  const map = {};
  for (const id of screenhouseIds) {
    if (!monitoringStats.uptimeIds.has(id)) {
      map[id] = null;
      continue;
    }
    const reading = monitoringStats.sensorAvgs[id];
    const threshold = monitoringStats.thresholds[id];
    if (!reading) {
      map[id] = null;
      continue;
    }
    map[id] = computeStressScore(reading, threshold).score;
  }
  return map;
}

function buildVarietasDistribution(screenhouses) {
  const counts = new Map();
  for (const sh of screenhouses) {
    const name = sh.varietas_nama || sh.seed_variety || "Tidak diisi";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([nama, count]) => ({ nama, count }))
    .sort((a, b) => b.count - a.count || a.nama.localeCompare(b.nama, "id"));
}

function buildSeedlingProgressByDistrict(screenhouses, stressMap, estimasiMap) {
  const groups = new Map();

  for (const sh of screenhouses) {
    const key = sh.district_id;
    if (!groups.has(key)) {
      groups.set(key, {
        district_id: sh.district_id,
        district_name: sh.district,
        regency: sh.regency,
        total: 0,
        on_track: 0,
        terlambat: 0,
        perlu_evaluasi: 0,
        belum_disi: 0,
        stress_scores: [],
        varietas_counts: new Map(),
        cycle_days: [],
      });
    }

    const group = groups.get(key);
    group.total += 1;

    const vName = screenhouseVarietasName(sh) || "Tidak diisi";
    group.varietas_counts.set(vName, (group.varietas_counts.get(vName) ?? 0) + 1);

    const elapsed = elapsedSemaiDays(sh);
    if (elapsed != null) group.cycle_days.push(elapsed);

    const estimasi = estimasiMap[sh.id];
    const status = estimasi?.status ?? sh.status_estimasi;
    if (status === "on_track") group.on_track += 1;
    else if (status === "terlambat") group.terlambat += 1;
    else if (status === "perlu_evaluasi") group.perlu_evaluasi += 1;
    else group.belum_disi += 1;

    const score = stressMap[sh.id];
    if (score != null) group.stress_scores.push(score);
  }

  return [...groups.values()]
    .map((g) => ({
      district_id: g.district_id,
      district_name: g.district_name,
      regency: g.regency,
      total: g.total,
      on_track: g.on_track,
      terlambat: g.terlambat,
      perlu_evaluasi: g.perlu_evaluasi,
      belum_disi: g.belum_disi,
      avg_stress_score: avgNumeric(g.stress_scores),
      dominant_varietas: dominantVarietasFromCounts(g.varietas_counts),
      avg_cycle_duration_days: avgNumeric(g.cycle_days),
    }))
    .sort((a, b) => b.total - a.total || a.district_name.localeCompare(b.district_name, "id"));
}

function buildBibitSummary(screenhouses, stressMap, estimasiMap) {
  const stressScores = screenhouses
    .map((sh) => stressMap[sh.id])
    .filter((v) => v != null);

  const cycleDays = screenhouses
    .map((sh) => elapsedSemaiDays(sh))
    .filter((v) => v != null);

  const varietasRanking = buildVarietasStressRanking(screenhouses, stressMap);
  const mostStable = varietasRanking[0] ?? null;

  let onTrack = 0;
  let terlambat = 0;
  let perluEvaluasi = 0;
  let belumDisi = 0;

  for (const sh of screenhouses) {
    const status = estimasiMap[sh.id]?.status ?? sh.status_estimasi;
    if (status === "on_track") onTrack += 1;
    else if (status === "terlambat") terlambat += 1;
    else if (status === "perlu_evaluasi") perluEvaluasi += 1;
    else belumDisi += 1;
  }

  return {
    avg_stress_score: avgNumeric(stressScores),
    avg_cycle_duration_days: avgNumeric(cycleDays),
    most_stable_varietas: mostStable
      ? {
          nama: mostStable.nama,
          avg_score: mostStable.avg_score,
          screenhouse_count: mostStable.screenhouse_count,
        }
      : null,
    on_track: onTrack,
    terlambat: terlambat,
    perlu_evaluasi: perluEvaluasi,
    belum_disi: belumDisi,
    varietas_count: buildVarietasDistribution(screenhouses).length,
  };
}

async function fetchScreenhouses(filters) {
  const conditions = ["s.status = 'active'"];
  const params = [];

  for (const [col, val] of [
    ["s.province_id", filters.province_id],
    ["s.regency_id", filters.regency_id],
    ["s.district_id", filters.district_id],
    ["s.village_id", filters.village_id],
  ]) {
    const num = Number(val);
    if (Number.isInteger(num)) {
      params.push(num);
      conditions.push(`${col} = $${params.length}`);
    }
  }

  const result = await pool.query(
    `
    SELECT
      s.id,
      s.name,
      s.province_id,
      s.regency_id,
      s.district_id,
      s.village_id,
      s.created_at,
      s.varietas_id,
      s.seed_variety,
      COALESCE(s.tanggal_semai, s.seedling_start_date) AS tanggal_semai,
      s.estimasi_siap_tanam,
      s.status_estimasi,
      vb.nama AS varietas_nama,
      vb.durasi_pembibitan_hari,
      u.name AS owner_name,
      u.phone_number AS owner_phone,
      p.name AS province,
      r.name AS regency,
      d.name AS district,
      v.name AS village
    FROM screenhouses s
    JOIN provinces p ON s.province_id = p.id
    JOIN regencies r ON s.regency_id = r.id
    JOIN districts d ON s.district_id = d.id
    JOIN villages v ON s.village_id = v.id
    LEFT JOIN varietas_bibit vb ON vb.id = s.varietas_id
    LEFT JOIN users u ON s.owner_user_id = u.id
    WHERE ${conditions.join(" AND ")}
    ORDER BY s.id
    `,
    params
  );

  return result.rows;
}

async function fetchMapSummary() {
  const data = await monitoringGet("/sensor-data/map-summary", []);
  return Object.fromEntries(
    (Array.isArray(data) ? data : []).map((item) => [item.screenhouse_id, item])
  );
}

async function fetchMonitoringStats(screenhouseIds, days) {
  if (!screenhouseIds.length) {
    return {
      alertTrend: [],
      alertTrendPrev: [],
      topParams: [],
      sensorAvgs: {},
      uptimeIds: new Set(),
      actuator: {},
      thresholds: {},
      activeAlerts: { critical: 0, auto_handled: 0 },
    };
  }

  if (!monitoringPool) {
    return {
      alertTrend: [],
      alertTrendPrev: [],
      topParams: [],
      sensorAvgs: {},
      uptimeIds: new Set(),
      actuator: {},
      thresholds: {},
      activeAlerts: { critical: 0, auto_handled: 0 },
    };
  }

  const [
    alertTrendRes,
    alertTrendPrevRes,
    topParamsRes,
    sensorAvgRes,
    uptimeRes,
    actuatorRes,
    thresholdRes,
    activeAlertsRes,
  ] = await Promise.all([
    monitoringPool.query(
      `
      SELECT DATE(created_at AT TIME ZONE 'Asia/Jakarta') AS date, COUNT(*)::int AS count
      FROM alerts
      WHERE screenhouse_id = ANY($1::int[])
        AND created_at >= NOW() - ($2::int * INTERVAL '1 day')
      GROUP BY 1
      ORDER BY 1
      `,
      [screenhouseIds, days]
    ),
    monitoringPool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM alerts
      WHERE screenhouse_id = ANY($1::int[])
        AND created_at >= NOW() - ($2::int * 2 * INTERVAL '1 day')
        AND created_at < NOW() - ($2::int * INTERVAL '1 day')
      `,
      [screenhouseIds, days]
    ),
    monitoringPool.query(
      `
      SELECT message, COUNT(*)::int AS count
      FROM alerts
      WHERE screenhouse_id = ANY($1::int[])
        AND created_at >= NOW() - ($2::int * INTERVAL '1 day')
      GROUP BY message
      ORDER BY count DESC
      LIMIT 20
      `,
      [screenhouseIds, days]
    ),
    monitoringPool.query(
      `
      SELECT
        sn.screenhouse_id,
        AVG(sd.nitrogen)::numeric(10,2) AS nitrogen,
        AVG(sd.phosphorus)::numeric(10,2) AS phosphorus,
        AVG(sd.potassium)::numeric(10,2) AS potassium,
        AVG(sd.soil_moisture)::numeric(10,2) AS soil_moisture,
        AVG(sd.soil_temperature)::numeric(10,2) AS soil_temperature,
        AVG(sd.soil_ph)::numeric(4,2) AS soil_ph,
        AVG(sd.air_temperature)::numeric(10,2) AS air_temperature,
        AVG(sd.air_humidity)::numeric(10,2) AS air_humidity
      FROM sensor_data sd
      JOIN sensor_nodes sn ON sn.id = sd.sensor_node_id
      WHERE sn.screenhouse_id = ANY($1::int[])
        AND sd.created_at >= NOW() - ($2::int * INTERVAL '1 day')
      GROUP BY sn.screenhouse_id
      `,
      [screenhouseIds, days]
    ),
    monitoringPool.query(
      `
      SELECT DISTINCT sn.screenhouse_id
      FROM sensor_data sd
      JOIN sensor_nodes sn ON sn.id = sd.sensor_node_id
      WHERE sn.screenhouse_id = ANY($1::int[])
        AND sd.created_at >= NOW() - INTERVAL '24 hours'
      `,
      [screenhouseIds]
    ),
    monitoringPool.query(
      `
      SELECT
        al.screenhouse_id,
        COUNT(*) FILTER (WHERE al.irrigation_status = true)::int AS irrigation_on,
        COUNT(*) FILTER (WHERE al.fan_status = true)::int AS fan_on,
        COUNT(*) FILTER (WHERE al.lamp_status = true)::int AS lamp_on,
        COUNT(*)::int AS total_readings
      FROM actuator_logs al
      WHERE al.screenhouse_id = ANY($1::int[])
        AND al.created_at >= NOW() - ($2::int * INTERVAL '1 day')
      GROUP BY al.screenhouse_id
      `,
      [screenhouseIds, days]
    ),
    monitoringPool.query(
      `SELECT * FROM threshold_snapshots WHERE screenhouse_id = ANY($1::int[])`,
      [screenhouseIds]
    ),
    monitoringPool.query(
      `
      SELECT message, COUNT(*)::int AS count
      FROM alerts
      WHERE screenhouse_id = ANY($1::int[])
        AND status = 'active'
      GROUP BY message
      `,
      [screenhouseIds]
    ),
  ]);

  const sensorAvgs = Object.fromEntries(
    sensorAvgRes.rows.map((row) => [row.screenhouse_id, row])
  );

  const actuator = Object.fromEntries(
    actuatorRes.rows.map((row) => [row.screenhouse_id, row])
  );

  const thresholds = Object.fromEntries(
    thresholdRes.rows.map((row) => [row.screenhouse_id, row])
  );

  let criticalAlerts = 0;
  let autoHandledAlerts = 0;
  for (const row of activeAlertsRes.rows) {
    if (isAutoHandledMessage(row.message)) autoHandledAlerts += row.count;
    else criticalAlerts += row.count;
  }

  return {
    alertTrend: alertTrendRes.rows.map((r) => ({
      date: r.date,
      count: r.count,
    })),
    alertTrendPrev: alertTrendPrevRes.rows[0]?.count ?? 0,
    topParams: topParamsRes.rows,
    sensorAvgs,
    uptimeIds: new Set(uptimeRes.rows.map((r) => r.screenhouse_id)),
    actuator,
    thresholds,
    activeAlerts: { critical: criticalAlerts, auto_handled: autoHandledAlerts },
  };
}

/**
 * Siklus semai yang SELESAI dalam periode (untuk throughput & durasi aktual).
 * Difilter ke screenhouse yang lolos filter wilayah agar konsisten dengan laporan.
 */
async function fetchCompletedCycles(screenhouseIds, days) {
  if (!screenhouseIds.length) return [];
  const result = await pool.query(
    `
    SELECT screenhouse_id, varietas_nama,
           tanggal_mulai::text  AS tanggal_mulai,
           tanggal_selesai::text AS tanggal_selesai,
           durasi_target_hari, grade
    FROM semai_cycles
    WHERE status = 'completed'
      AND screenhouse_id = ANY($1::int[])
      AND tanggal_selesai >= (NOW() AT TIME ZONE 'Asia/Jakarta')::date - ($2::int * INTERVAL '1 day')
    `,
    [screenhouseIds, days]
  );
  return result.rows;
}

async function fetchGrowthStats(days) {
  const [screenhousesRes, farmersRes, ownersRes] = await Promise.all([
    pool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM screenhouses
      WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
      `,
      [days]
    ),
    pool.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected
      FROM users
      WHERE role = 'petani'
        AND created_at >= NOW() - ($1::int * INTERVAL '1 day')
      `,
      [days]
    ),
    pool.query(
      `
      SELECT COUNT(DISTINCT owner_user_id)::int AS distinct_owners
      FROM screenhouses
      WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
        AND owner_user_id IS NOT NULL
      `,
      [days]
    ),
  ]);

  const new_screenhouses = screenhousesRes.rows[0]?.count ?? 0;
  const farmers_approved = farmersRes.rows[0]?.approved ?? 0;
  const farmers_pending = farmersRes.rows[0]?.pending ?? 0;
  const farmers_rejected = farmersRes.rows[0]?.rejected ?? 0;
  const distinct_petani_owners = ownersRes.rows[0]?.distinct_owners ?? 0;

  let note = null;
  if (new_screenhouses > 0 && farmers_approved === 0) {
    note =
      distinct_petani_owners > 0
        ? "Unit screenhouse baru terhubung ke petani yang sudah terdaftar sebelumnya — bukan akun petani baru."
        : "Unit screenhouse baru belum terhubung ke akun petani.";
  } else if (new_screenhouses > 0 || farmers_approved > 0) {
    note =
      "Unit screenhouse dan akun petani dihitung terpisah; penambahan unit tidak selalu berarti petani baru.";
  }

  return {
    new_screenhouses,
    farmers_approved,
    farmers_pending,
    farmers_rejected,
    distinct_petani_owners,
    note,
  };
}

function avgNumeric(values) {
  const nums = values.filter((v) => v != null && !Number.isNaN(Number(v))).map(Number);
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, c) => a + c, 0) / nums.length) * 100) / 100;
}

function buildRegionRows(screenhouses, mapSummary, groupBy, monitoringStats, includeStressScore, estimasiMap = {}) {
  const col = GROUP_BY_COLUMNS[groupBy];
  const groups = new Map();

  for (const sh of screenhouses) {
    const regionId = sh[col.id];
    const regionName = sh[col.name];
    if (!groups.has(regionId)) {
      groups.set(regionId, {
        region_id: regionId,
        region_name: regionName,
        province: sh.province,
        regency: sh.regency,
        screenhouse_ids: [],
        total: 0,
        healthy: 0,
        warning: 0,
        critical: 0,
        offline: 0,
        active_alerts: 0,
        online_count: 0,
        on_track: 0,
        terlambat: 0,
        perlu_evaluasi: 0,
      });
    }

    const group = groups.get(regionId);
    group.screenhouse_ids.push(sh.id);
    group.total += 1;

    const summary = mapSummary[sh.id];
    const status = summary?.status ?? "offline";
    group[status] = (group[status] ?? 0) + 1;
    group.active_alerts += summary?.active_alerts ?? 0;

    if (monitoringStats.uptimeIds.has(sh.id)) {
      group.online_count += 1;
    }

    // Progres IP400 per wilayah (menghormati group_by) — gabung dengan kesehatan.
    const estStatus = estimasiMap[sh.id]?.status ?? sh.status_estimasi;
    if (estStatus === "on_track") group.on_track += 1;
    else if (estStatus === "terlambat") group.terlambat += 1;
    else if (estStatus === "perlu_evaluasi") group.perlu_evaluasi += 1;
  }

  const sensorKeys = [
    "nitrogen", "phosphorus", "potassium",
    "soil_moisture", "soil_temperature", "soil_ph",
    "air_temperature", "air_humidity",
  ];

  return [...groups.values()]
    .map((group) => {
      const sensorRows = group.screenhouse_ids
        .map((id) => monitoringStats.sensorAvgs[id])
        .filter(Boolean);

      const sensor_avg = {};
      sensorKeys.forEach((key) => {
        sensor_avg[key] = avgNumeric(sensorRows.map((r) => r[key]));
      });

      let irrigation_on = 0;
      let fan_on = 0;
      let lamp_on = 0;
      let total_readings = 0;
      group.screenhouse_ids.forEach((id) => {
        const act = monitoringStats.actuator[id];
        if (!act) return;
        irrigation_on += act.irrigation_on ?? 0;
        fan_on += act.fan_on ?? 0;
        lamp_on += act.lamp_on ?? 0;
        total_readings += act.total_readings ?? 0;
      });

      const uptime_pct =
        group.total > 0
          ? Math.round((group.online_count / group.total) * 1000) / 10
          : 0;

      const stressScores = includeStressScore
        ? group.screenhouse_ids
            .map((id) => {
              if (!monitoringStats.uptimeIds.has(id)) return null;
              const reading = monitoringStats.sensorAvgs[id];
              const threshold = monitoringStats.thresholds[id];
              if (!reading) return null;
              return computeStressScore(reading, threshold).score;
            })
            .filter((v) => v != null)
        : [];

      const avg_stress_score = includeStressScore ? avgNumeric(stressScores) : null;

      return {
        region_id: group.region_id,
        region_name: group.region_name,
        province: group.province,
        regency: group.regency,
        total: group.total,
        healthy: group.healthy,
        warning: group.warning,
        critical: group.critical,
        offline: group.offline,
        active_alerts: group.active_alerts,
        on_track: group.on_track,
        terlambat: group.terlambat,
        perlu_evaluasi: group.perlu_evaluasi,
        uptime_pct,
        avg_stress_score,
        sensor_avg,
        actuator: {
          irrigation_on,
          fan_on,
          lamp_on,
          total_readings,
        },
      };
    })
    .sort((a, b) => b.total - a.total || a.region_name.localeCompare(b.region_name, "id"));
}

const STATUS_RANK = { critical: 4, warning: 3, offline: 2, healthy: 1 };

function buildProblematicScreenhouses(screenhouses, mapSummary, stressMap, estimasiMap, includeStressScore, includeEstimasi) {
  const labels = {
    healthy: "Sehat",
    warning: "Peringatan",
    critical: "Kritis",
    offline: "Offline",
  };

  return screenhouses
    .map((sh) => {
      const summary = mapSummary[sh.id];
      const status = summary?.status ?? "offline";
      const stressScore = includeStressScore ? (stressMap[sh.id] ?? null) : null;
      const estimasi = includeEstimasi ? estimasiMap[sh.id] : null;
      const stressCategory =
        stressScore != null ? getCategory(stressScore).category : null;

      return {
        id: sh.id,
        name: sh.name,
        owner_name: sh.owner_name,
        owner_phone: sh.owner_phone,
        village: sh.village,
        district: sh.district,
        regency: sh.regency,
        varietas_nama: sh.varietas_nama || sh.seed_variety || null,
        status,
        status_label: labels[status] ?? status,
        insight: summary?.insight ?? null,
        active_alerts: summary?.active_alerts ?? 0,
        last_seen: summary?.last_seen ?? null,
        abnormal: summary?.abnormal ?? [],
        alerts_pending_review: summary?.alerts_pending_review ?? false,
        rank: STATUS_RANK[status] ?? 0,
        stress_score: stressScore,
        stress_category: stressCategory,
        estimasi_siap: estimasi?.estimasi_siap ?? sh.estimasi_siap_tanam ?? null,
        estimasi_siap_label: includeEstimasi ? formatEstimasiLabel(estimasi) : null,
        sisa_hari: estimasi?.sisa_hari ?? null,
        status_estimasi: estimasi?.status ?? sh.status_estimasi ?? null,
      };
    })
    .filter((row) => row.rank >= STATUS_RANK.warning || row.active_alerts > 0 || (includeStressScore && row.stress_score != null && row.stress_score < 70))
    .sort((a, b) => {
      if (includeStressScore) {
        const sa = a.stress_score;
        const sb = b.stress_score;
        if (sa == null && sb != null) return 1;
        if (sa != null && sb == null) return -1;
        if (sa != null && sb != null && sa !== sb) return sa - sb;
      }
      if (b.rank !== a.rank) return b.rank - a.rank;
      if (b.active_alerts !== a.active_alerts) return b.active_alerts - a.active_alerts;
      return a.name.localeCompare(b.name, "id");
    })
    .slice(0, 50);
}

async function getOperatorReports(req, res) {
  try {
    const days = parseDays(req.query.days);
    const groupBy = parseGroupBy(req.query.group_by);
    const includeStressScore = parseBool(req.query.include_stress_score);
    const includeEstimasi = parseBool(req.query.include_estimasi);
    const filters = {
      province_id: req.query.province_id,
      regency_id: req.query.regency_id,
      district_id: req.query.district_id,
      village_id: req.query.village_id,
    };

    const [screenhouses, mapSummary, growth] = await Promise.all([
      fetchScreenhouses(filters),
      fetchMapSummary(),
      fetchGrowthStats(days),
    ]);

    const screenhouseIds = screenhouses.map((sh) => sh.id);
    const [monitoringStats, completedCycles] = await Promise.all([
      fetchMonitoringStats(screenhouseIds, days),
      fetchCompletedCycles(screenhouseIds, days),
    ]);

    let stressMap = {};
    let estimasiMap = {};

    if (includeStressScore) {
      stressMap = buildStressScoreMap(screenhouseIds, monitoringStats);
    }

    if (includeEstimasi) {
      estimasiMap = await buildEstimasiTanamBatch(screenhouseIds, { persist: true });
    }

    const regions = buildRegionRows(
      screenhouses,
      mapSummary,
      groupBy,
      monitoringStats,
      includeStressScore,
      estimasiMap
    );

    const varietas_distribution = buildVarietasDistribution(screenhouses);
    const varietas_duration_stats = buildVarietasDurationStats(completedCycles);
    const cycle_throughput = buildCycleThroughput(completedCycles);
    const varietas_resilience = buildVarietasStressRanking(screenhouses, stressMap);
    const seedling_progress_by_district =
      includeEstimasi || includeStressScore
        ? buildSeedlingProgressByDistrict(screenhouses, stressMap, estimasiMap)
        : [];

    const bibit_summary =
      includeEstimasi || includeStressScore
        ? buildBibitSummary(screenhouses, stressMap, estimasiMap)
        : null;

    const readiness = buildReadinessSummary(screenhouses, estimasiMap);

    const statusTotals = { healthy: 0, warning: 0, critical: 0, offline: 0 };
    let activeAlerts = 0;
    let onlineCount = 0;

    for (const sh of screenhouses) {
      const summary = mapSummary[sh.id];
      const status = summary?.status ?? "offline";
      statusTotals[status] = (statusTotals[status] ?? 0) + 1;
      activeAlerts += summary?.active_alerts ?? 0;
      if (monitoringStats.uptimeIds.has(sh.id)) onlineCount += 1;
    }

    const alertCountCurrent = monitoringStats.alertTrend.reduce(
      (sum, row) => sum + row.count,
      0
    );

    const topParamsMap = new Map();
    for (const row of monitoringStats.topParams) {
      const param = paramFromMessage(row.message);
      const prev = topParamsMap.get(param.key) ?? { key: param.key, label: param.label, count: 0 };
      prev.count += row.count;
      topParamsMap.set(param.key, prev);
    }

    const top_alert_params = [...topParamsMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const problematic_screenhouses = buildProblematicScreenhouses(
      screenhouses,
      mapSummary,
      stressMap,
      estimasiMap,
      includeStressScore,
      includeEstimasi
    );

    res.json({
      generated_at: new Date().toISOString(),
      period_days: days,
      group_by: groupBy,
      filters,
      include_stress_score: includeStressScore,
      include_estimasi: includeEstimasi,
      kpis: {
        total_screenhouses: screenhouses.length,
        uptime_pct:
          screenhouses.length > 0
            ? Math.round((onlineCount / screenhouses.length) * 1000) / 10
            : 0,
        active_alerts: activeAlerts,
        offline_count: statusTotals.offline ?? 0,
        alert_count_period: alertCountCurrent,
        avg_stress_score: bibit_summary?.avg_stress_score ?? null,
        // Outcome IP400 (headline)
        on_time_readiness_pct: readiness.on_time_readiness_pct,
        target_readiness_pct: readiness.target_readiness_pct,
        ready_within_14d: readiness.ready_within_14d,
        behind_count: readiness.behind_count,
      },
      device_health: {
        uptime_pct:
          screenhouses.length > 0
            ? Math.round((onlineCount / screenhouses.length) * 1000) / 10
            : 0,
        offline_count: statusTotals.offline ?? 0,
        critical_alerts: monitoringStats.activeAlerts.critical,
        auto_handled_alerts: monitoringStats.activeAlerts.auto_handled,
        alerts_delta: alertCountCurrent - monitoringStats.alertTrendPrev,
      },
      readiness,
      cycle_throughput,
      status_totals: statusTotals,
      varietas_distribution,
      varietas_duration_stats,
      varietas_resilience,
      seedling_progress_by_district,
      bibit_summary,
      regions,
      alert_trend: monitoringStats.alertTrend,
      top_alert_params,
      problematic_screenhouses,
      growth,
      period_comparison: {
        alerts_current: alertCountCurrent,
        alerts_previous: monitoringStats.alertTrendPrev,
        alerts_delta: alertCountCurrent - monitoringStats.alertTrendPrev,
      },
    });
  } catch (err) {
    console.error("[operator-reports]", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = { getOperatorReports };
