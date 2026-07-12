const PHONE_LOCAL_RE = /^08[0-9]{8,11}$/;

function normalizeIndonesianPhone(input) {
  if (input == null || input === "") return null;
  let digits = String(input).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("62")) {
    digits = `0${digits.slice(2)}`;
  } else if (digits.startsWith("8")) {
    digits = `0${digits}`;
  }
  if (!digits.startsWith("0")) return null;
  return digits;
}

function validateIndonesianPhone(input) {
  const normalized = normalizeIndonesianPhone(input);
  if (!normalized) {
    return {
      ok: false,
      message: "Nomor HP wajib diisi dengan format Indonesia (contoh: 081234567890).",
    };
  }
  if (!PHONE_LOCAL_RE.test(normalized)) {
    return {
      ok: false,
      message: "Nomor HP tidak valid. Gunakan format 08xxxxxxxxxx (10–13 digit).",
    };
  }
  return { ok: true, normalized };
}

module.exports = {
  normalizeIndonesianPhone,
  validateIndonesianPhone,
};
