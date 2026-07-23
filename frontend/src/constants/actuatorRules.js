/** Label aktuator yang direkomendasikan otomatis saat alert (mirror backend rules). */
export const ACTUATOR_HINTS = {
  soil_moisture: { low: "Irigasi dinyalakan otomatis", high: "Irigasi dimatikan otomatis" },
  air_temperature: { high: "Kipas dinyalakan otomatis", low: "Kipas dimatikan otomatis" },
  air_humidity: { high: "Kipas dinyalakan otomatis", low: "Kipas dimatikan otomatis" },
  soil_temperature: { high: "Kipas dinyalakan otomatis", low: "Lampu dinyalakan otomatis" },
  light_intensity: { low: "Lampu dinyalakan otomatis", high: "Lampu dimatikan otomatis" },
};

/**
 * Aktuator untuk hint ini tersedia di perangkat?
 * capabilities = { fan, irrigation, lamp } (dari API). null/undefined → anggap
 * tersedia (backward-compatible untuk screenhouse tanpa data kapabilitas).
 */
function isActuatorAvailable(hint, capabilities) {
  if (!capabilities) return true;
  const key = getActuatorKeyFromHint(hint);
  return !key || capabilities[key] !== false;
}

export function getActuatorHintForAlert(alert, capabilities = null) {
  const lower = alert?.message?.toLowerCase() ?? "";
  const direction = lower.includes("maksimum") || lower.includes("melebihi")
    ? "high"
    : lower.includes("minimum") || lower.includes("bawah")
    ? "low"
    : null;
  if (!direction) return null;

  const param =
    lower.includes("kelembapan tanah") ? "soil_moisture"
    : lower.includes("suhu udara") ? "air_temperature"
    : lower.includes("kelembapan udara") ? "air_humidity"
    : lower.includes("suhu tanah") ? "soil_temperature"
    : lower.includes("intensitas cahaya") ? "light_intensity"
    : null;

  const hint = param ? ACTUATOR_HINTS[param]?.[direction] ?? null : null;
  // Auto-aktuator dimatikan global (AUTO_ACTUATOR_ENABLED=false) → tidak ada yang
  // ditangani otomatis, jadi tak ada lock; tampilkan saran manual saja.
  if (hint && capabilities && capabilities.autoEnabled === false) return null;
  // Aktuator tak ada di perangkat (mis. gh01 tanpa kipas/lampu) → bukan
  // "ditangani otomatis"; biarkan UI menampilkan saran manual.
  if (hint && !isActuatorAvailable(hint, capabilities)) return null;
  return hint;
}

/** True jika alert ini ditangani sistem (kipas/irigasi/lampu), bukan manual petani. */
export function isAutoHandledAlert(alert, capabilities = null) {
  return getActuatorHintForAlert(alert, capabilities) != null;
}

/** Teks notifikasi bila kondisi ditangani aktuator otomatis (kipas/irigasi/lampu). */
export function getAutoHandledNotice(alert, capabilities = null) {
  const hint = getActuatorHintForAlert(alert, capabilities);
  return hint ? `Ditangani otomatis: ${hint}` : null;
}

/** Penjelasan singkat untuk petani — siapa, apa, kapan. */
export function getAutoHandledExplanation(alert, capabilities = null) {
  const hint = getActuatorHintForAlert(alert, capabilities);
  if (!hint) return null;

  const at = alert?.created_at
    ? new Date(alert.created_at).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return at ? `${hint} oleh sistem pukul ${at}` : `${hint} oleh sistem`;
}

/** Override status aktuator dari teks hint otomatis (mis. "Kipas dinyalakan otomatis" → fan ON). */
export function getActuatorStatusFromHint(hint) {
  if (!hint) return {};
  const isOn = hint.includes("dinyalakan");
  if (hint.startsWith("Kipas")) return { fan_status: isOn };
  if (hint.startsWith("Irigasi")) return { irrigation_status: isOn };
  if (hint.startsWith("Lampu")) return { lamp_status: isOn };
  return {};
}

export function getActuatorKeyFromHint(hint) {
  if (!hint) return null;
  if (hint.startsWith("Kipas")) return "fan";
  if (hint.startsWith("Irigasi")) return "irrigation";
  if (hint.startsWith("Lampu")) return "lamp";
  return null;
}

const AUTO_BANNER_REASONS = [
  [/suhu udara.*(maksimum|melebihi)|melebihi.*suhu udara/, "suhu udara tinggi"],
  [/suhu udara.*(minimum|bawah)|bawah.*suhu udara/, "suhu udara rendah"],
  [/kelembapan udara.*(maksimum|melebihi)|melebihi.*kelembapan udara/, "kelembapan udara tinggi"],
  [/kelembapan udara.*(minimum|bawah)|bawah.*kelembapan udara/, "kelembapan udara rendah"],
  [/kelembapan tanah.*(minimum|bawah)|bawah.*kelembapan tanah/, "kelembapan tanah rendah"],
  [/kelembapan tanah.*(maksimum|melebihi)|melebihi.*kelembapan tanah/, "kelembapan tanah berlebih"],
  [/suhu tanah.*(maksimum|melebihi)|melebihi.*suhu tanah/, "suhu tanah tinggi"],
  [/suhu tanah.*(minimum|bawah)|bawah.*suhu tanah/, "suhu tanah rendah"],
  [/intensitas cahaya.*(minimum|bawah)|bawah.*intensitas cahaya/, "cahaya kurang"],
  [/intensitas cahaya.*(maksimum|melebihi)|melebihi.*intensitas cahaya/, "cahaya berlebih"],
];

/** Teks banner ramah petani saat aktuator dikunci otomatis. */
export function getAutoControlBannerText(alert) {
  const hint = getActuatorHintForAlert(alert);
  if (!hint) return null;

  const lower = alert?.message?.toLowerCase() ?? "";
  let because = "kondisi di luar batas aman";
  for (const [pattern, label] of AUTO_BANNER_REASONS) {
    if (pattern.test(lower)) {
      because = label;
      break;
    }
  }

  const name = hint.split(" ")[0];
  const verb = hint.includes("dinyalakan") ? "dinyalakan" : "dimatikan";
  return `${name} ${verb} karena ${because}`;
}

/**
 * Map aktuator → lock otomatis dari alert aktif screenhouse.
 * @returns {Record<string, { message: string, expectedOn: boolean }>}
 */
export function buildAutoActuatorLocks(alerts = [], { screenhouseId, capabilities = null } = {}) {
  const locks = {};

  for (const alert of alerts) {
    if (alert?.status && alert.status !== "active") continue;
    if (
      screenhouseId != null &&
      Number(alert.screenhouse_id) !== Number(screenhouseId)
    ) {
      continue;
    }

    const hint = getActuatorHintForAlert(alert, capabilities);
    const key = getActuatorKeyFromHint(hint);
    if (!key) continue;

    locks[key] = {
      message: getAutoControlBannerText(alert),
      expectedOn: hint.includes("dinyalakan"),
    };
  }

  return locks;
}

/**
 * Cek apakah parameter (mis. "air_humidity") pada arah "low"/"high" sedang
 * ditangani otomatis — dipakai ParamHealthCards untuk mengganti saran manual
 * jadi info "ditangani otomatis" saat aktuator terkait sudah terkunci aktif.
 */
export function getParamAutoHandledHint(paramKey, status, autoLocks = {}, capabilities = null) {
  const hint = ACTUATOR_HINTS[paramKey]?.[status];
  if (!hint) return null;

  // Aktuator tak ada di perangkat → tidak "ditangani otomatis" (fallback ke saran manual).
  if (!isActuatorAvailable(hint, capabilities)) return null;

  const actuatorKey = getActuatorKeyFromHint(hint);
  const lock = autoLocks[actuatorKey];
  if (!lock) return null;

  const expectedOn = hint.includes("dinyalakan");
  return lock.expectedOn === expectedOn ? hint : null;
}
