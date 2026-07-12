const pool = require("../config/db");
const monitoringPool = require("../config/monitoringDb");
const { wibDateStr } = require("./estimasiTanam");

const PARAM_DEFS = [
  { key: "soil_moisture", label: "Kelembapan Tanah", minCol: "min_soil_moisture", maxCol: "max_soil_moisture", icon: "💧" },
  { key: "air_temperature", label: "Suhu Udara", minCol: "min_air_temperature", maxCol: "max_air_temperature", icon: "🌡️" },
  { key: "air_humidity", label: "Kelembapan Udara", minCol: "min_air_humidity", maxCol: "max_air_humidity", icon: "💨" },
  { key: "soil_temperature", label: "Suhu Tanah", minCol: "min_soil_temperature", maxCol: "max_soil_temperature", icon: "🌱" },
  { key: "nitrogen", label: "Nitrogen", minCol: "min_nitrogen", maxCol: "max_nitrogen", icon: "🧪" },
];

function evaluateReading(key, value, threshold) {
  const def = PARAM_DEFS.find((p) => p.key === key);
  if (!def || value == null || Number.isNaN(Number(value))) return "unknown";
  const min = threshold?.[def.minCol];
  const max = threshold?.[def.maxCol];
  if (min == null || max == null) return "unknown";
  const num = Number(value);
  if (num < Number(min)) return "low";
  if (num > Number(max)) return "high";
  return "ideal";
}

function stabilityQuality(pct) {
  if (pct >= 90) return "Sangat Baik";
  if (pct >= 75) return "Baik";
  if (pct >= 50) return "Perlu Perhatian";
  return "Sering Keluar Batas";
}

function formatDurationMinutes(totalMinutes) {
  const mins = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hours === 0) return `${rem} Menit`;
  if (rem === 0) return `${hours} Jam`;
  return `${hours} Jam ${rem} Menit`;
}

function computeGrade({ totalStressMinutes, uptimePct }) {
  const stressHours = totalStressMinutes / 60;
  if (stressHours < 5 && uptimePct > 95) {
    return {
      letter: "A",
      title: "Premium",
      summary:
        "Bibit dinilai sangat sehat dan minim risiko gagal tumbuh saat dipindah ke sawah terbuka.",
    };
  }
  if (stressHours <= 24) {
    return {
      letter: "B",
      title: "Standar",
      summary: "Bibit cukup baik namun perlu perhatian ekstra di awal penanaman sawah.",
    };
  }
  return {
    letter: "C",
    title: "Perlu Evaluasi",
    summary:
      "Ada risiko pertumbuhan bibit kerdil atau terserang penyakit akibat kondisi lingkungan yang buruk selama di screenhouse.",
  };
}

async function fetchThreshold(screenhouseId) {
  const result = await pool.query(`SELECT * FROM thresholds WHERE screenhouse_id = $1`, [
    screenhouseId,
  ]);
  return result.rows[0] ?? null;
}

async function fetchCycleSensorReadings(screenhouseId, startDate, endDate) {
  if (!monitoringPool) return [];

  const result = await monitoringPool.query(
    `
    SELECT
      sd.soil_moisture,
      sd.air_temperature,
      sd.air_humidity,
      sd.soil_temperature,
      sd.nitrogen,
      sd.created_at,
      sn.send_interval_seconds
    FROM sensor_data sd
    INNER JOIN sensor_nodes sn ON sn.id = sd.sensor_node_id
    WHERE sn.screenhouse_id = $1
      AND sn.is_active = true
      AND sd.created_at >= ($2::date AT TIME ZONE 'Asia/Jakarta')
      AND sd.created_at < (($3::date + INTERVAL '1 day') AT TIME ZONE 'Asia/Jakarta')
    ORDER BY sd.created_at ASC
    `,
    [screenhouseId, startDate, endDate]
  );
  return result.rows;
}

async function fetchAutoActuatorStats(screenhouseId, startDate, endDate) {
  if (!monitoringPool) {
    return { fan: 0, irrigation: 0, lamp: 0, details: [] };
  }

  const result = await monitoringPool.query(
    `
    SELECT fan_status, irrigation_status, lamp_status, reason, created_at
    FROM actuator_logs
    WHERE screenhouse_id = $1
      AND source = 'auto'
      AND created_at >= ($2::date AT TIME ZONE 'Asia/Jakarta')
      AND created_at < (($3::date + INTERVAL '1 day') AT TIME ZONE 'Asia/Jakarta')
    ORDER BY created_at ASC
    `,
    [screenhouseId, startDate, endDate]
  );

  let fan = 0;
  let irrigation = 0;
  let lamp = 0;
  const details = [];

  for (const row of result.rows) {
    if (row.fan_status) {
      fan += 1;
      details.push({ actuator: "fan", label: "Kipas", reason: row.reason });
    }
    if (row.irrigation_status) {
      irrigation += 1;
      details.push({ actuator: "irrigation", label: "Irigasi", reason: row.reason });
    }
    if (row.lamp_status) {
      lamp += 1;
      details.push({ actuator: "lamp", label: "Lampu", reason: row.reason });
    }
  }

  return { fan, irrigation, lamp, details };
}

function toDateStr(value) {
  if (value == null) return null;
  if (value instanceof Date) return wibDateStr(value);
  return String(value).slice(0, 10);
}

function diffCalendarDays(fromStr, toStr) {
  const from = new Date(`${String(fromStr).slice(0, 10)}T12:00:00+07:00`);
  const to = new Date(`${String(toStr).slice(0, 10)}T12:00:00+07:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return Math.max(1, Math.round((to - from) / 86400000) + 1);
}

async function buildCycleAnalytics(cycle) {
  const startDate = toDateStr(cycle.tanggal_mulai);
  const endDate = toDateStr(cycle.tanggal_selesai) ?? wibDateStr();
  const targetHari = cycle.durasi_target_hari ?? null;
  const aktualHari = diffCalendarDays(startDate, endDate);
  const selisih = targetHari != null ? aktualHari - targetHari : null;

  const threshold = await fetchThreshold(cycle.screenhouse_id);
  const readings = await fetchCycleSensorReadings(cycle.screenhouse_id, startDate, endDate);
  const actuatorStats = await fetchAutoActuatorStats(cycle.screenhouse_id, startDate, endDate);

  const intervalMinutes =
    readings.length > 0
      ? Math.max(
          1,
          Math.round(
            (readings.reduce((s, r) => s + (Number(r.send_interval_seconds) || 60), 0) /
              readings.length /
              60) *
              10
          ) / 10
        )
      : 60;

  const totalCycleMinutes = aktualHari * 24 * 60;
  const hoursWithData = new Set(
    readings.map((r) => {
      const d = new Date(r.created_at);
      return `${d.toISOString().slice(0, 13)}`;
    })
  ).size;
  const totalHours = aktualHari * 24;
  const uptimePct = totalHours > 0 ? Math.round((hoursWithData / totalHours) * 1000) / 10 : 0;

  const paramStats = {};
  for (const def of PARAM_DEFS) {
    paramStats[def.key] = { ideal: 0, stress: 0, total: 0, low: 0, high: 0 };
  }

  for (const row of readings) {
    for (const def of PARAM_DEFS) {
      const status = evaluateReading(def.key, row[def.key], threshold);
      if (status === "unknown") continue;
      paramStats[def.key].total += 1;
      if (status === "ideal") paramStats[def.key].ideal += 1;
      else {
        paramStats[def.key].stress += 1;
        if (status === "low") paramStats[def.key].low += 1;
        if (status === "high") paramStats[def.key].high += 1;
      }
    }
  }

  const stability = PARAM_DEFS.map((def) => {
    const s = paramStats[def.key];
    const pct = s.total > 0 ? Math.round((s.ideal / s.total) * 100) : null;
    return {
      key: def.key,
      label: def.label,
      icon: def.icon,
      pct,
      quality: pct != null ? stabilityQuality(pct) : "Belum ada data",
      stress_readings: s.stress,
    };
  }).filter((s) => s.pct != null);

  const stressBreakdown = PARAM_DEFS.map((def) => {
    const minutes = paramStats[def.key].stress * intervalMinutes;
    if (minutes <= 0) return null;
    const s = paramStats[def.key];
    let note = "keluar batas aman";
    if (s.high > s.low) note = "sering terlalu tinggi";
    else if (s.low > s.high) note = "sering terlalu rendah";
    return {
      key: def.key,
      label: def.label,
      minutes,
      label_duration: formatDurationMinutes(minutes),
      note,
    };
  }).filter(Boolean);

  const totalStressMinutes = stressBreakdown.reduce((sum, b) => sum + b.minutes, 0);
  const grade = computeGrade({ totalStressMinutes, uptimePct });

  const durasiLabel =
    selisih == null
      ? null
      : selisih === 0
      ? "Tepat waktu"
      : selisih > 0
      ? `Terlambat ${selisih} hari`
      : `Lebih cepat ${Math.abs(selisih)} hari`;

  const actuators = [];
  if (actuatorStats.fan > 0) {
    actuators.push({
      key: "fan",
      label: "Kipas",
      auto_activations: actuatorStats.fan,
      summary: `Kipas otomatis menyala sebanyak ${actuatorStats.fan} kali selama siklus ini.`,
    });
  }
  if (actuatorStats.irrigation > 0) {
    actuators.push({
      key: "irrigation",
      label: "Irigasi",
      auto_activations: actuatorStats.irrigation,
      summary: `Irigasi otomatis aktif ${actuatorStats.irrigation} kali selama siklus ini.`,
    });
  }
  if (actuatorStats.lamp > 0) {
    actuators.push({
      key: "lamp",
      label: "Lampu",
      auto_activations: actuatorStats.lamp,
      summary: `Lampu otomatis aktif ${actuatorStats.lamp} kali selama siklus ini.`,
    });
  }

  return {
    durasi: {
      target_hari: targetHari,
      aktual_hari: aktualHari,
      selisih_hari: selisih,
      label: durasiLabel,
    },
    uptime: {
      pct: uptimePct,
      online_hours: hoursWithData,
      total_hours: totalHours,
      offline_pct: Math.max(0, Math.round((100 - uptimePct) * 10) / 10),
    },
    stability,
    stress: {
      total_minutes: totalStressMinutes,
      total_label: formatDurationMinutes(totalStressMinutes),
      breakdown: stressBreakdown,
      summary:
        totalStressMinutes > 0
          ? `Selama ${aktualHari} hari siklus berjalan, tanaman mengalami stres akumulatif selama ${formatDurationMinutes(totalStressMinutes)}.`
          : "Tidak ada stres signifikan tercatat selama siklus ini.",
    },
    actuators,
    grade,
    computed_at: new Date().toISOString(),
  };
}

module.exports = { buildCycleAnalytics, diffCalendarDays };
