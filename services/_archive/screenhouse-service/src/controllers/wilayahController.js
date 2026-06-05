const pool = require("../db");

const NOMINATIM = "https://nominatim.openstreetmap.org";
const USER_AGENT = "ScreenhouseMonitoring/1.0 (UPTD Mektan)";

function normalizeName(value) {
  return (value || "")
    .toLowerCase()
    .replace(/^(kabupaten|kota|kecamatan|kelurahan|desa)\s+/g, "")
    .trim();
}

async function nominatimFetch(path) {
  const res = await fetch(`${NOMINATIM}${path}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Gagal menghubungi layanan peta");
  return res.json();
}

async function matchWilayah(address) {
  const provinceName =
    address.state || address.region || address.province || "";
  const provinceAliases = {
    "west java": "Jawa Barat",
    "jawa barat": "Jawa Barat",
  };
  const normalizedProvince =
    provinceAliases[normalizeName(provinceName)] || provinceName;

  const regencyName =
    address.city ||
    address.county ||
    address.city_district ||
    address.regency ||
    "";
  const districtName =
    address.subdistrict ||
    address.district ||
    address.city_district ||
    "";
  const villageName =
    address.village ||
    address.hamlet ||
    address.suburb ||
    address.neighbourhood ||
    "";

  const province = await pool.query(
    `SELECT id, name, kode FROM provinces
     WHERE kode = $2
        OR lower(name) = lower($1)
        OR lower(name) LIKE '%' || lower($1) || '%'
        OR lower($1) LIKE '%' || lower(name) || '%'
     ORDER BY CASE WHEN kode = $2 THEN 0 ELSE 1 END
     LIMIT 1`,
    [normalizedProvince, address["ISO3166-2-lvl4"]?.split("-")[1] || null]
  );
  if (!province.rows[0]) return null;

  const regency = await pool.query(
    `SELECT id, name, kode FROM regencies
     WHERE province_id = $1
       AND (
         lower(name) = lower($2)
         OR lower(name) LIKE '%' || lower($2) || '%'
         OR lower($2) LIKE '%' || lower(name) || '%'
         OR lower(name) LIKE '%' || lower($3) || '%'
       )
     ORDER BY CASE WHEN lower(name) LIKE '%' || lower($3) || '%' THEN 0 ELSE 1 END
     LIMIT 1`,
    [
      province.rows[0].id,
      regencyName,
      normalizeName(regencyName) || regencyName,
    ]
  );
  if (!regency.rows[0]) return null;

  const district = await pool.query(
    `SELECT id, name, kode FROM districts
     WHERE regency_id = $1
       AND (lower(name) = lower($2) OR lower(name) LIKE '%' || lower($2) || '%' OR lower($2) LIKE '%' || lower(name) || '%')
     LIMIT 1`,
    [regency.rows[0].id, normalizeName(districtName) || districtName]
  );

  let districtRow = district.rows[0];
  if (!districtRow) {
    const fallbackDistrict = await pool.query(
      `SELECT id, name FROM districts WHERE regency_id = $1 ORDER BY id ASC LIMIT 1`,
      [regency.rows[0].id]
    );
    districtRow = fallbackDistrict.rows[0];
  }
  if (!districtRow) return null;

  const village = await pool.query(
    `SELECT id, name, kode FROM villages
     WHERE district_id = $1
       AND (lower(name) = lower($2) OR lower(name) LIKE '%' || lower($2) || '%' OR lower($2) LIKE '%' || lower(name) || '%')
     LIMIT 1`,
    [districtRow.id, normalizeName(villageName) || villageName]
  );

  let villageRow = village.rows[0];
  if (!villageRow) {
    const fallbackVillage = await pool.query(
      `SELECT id, name FROM villages WHERE district_id = $1 ORDER BY id ASC LIMIT 1`,
      [districtRow.id]
    );
    villageRow = fallbackVillage.rows[0];
  }
  if (!villageRow) return null;

  return {
    province_id: province.rows[0].id,
    regency_id: regency.rows[0].id,
    district_id: districtRow.id,
    village_id: villageRow.id,
    province_kode: province.rows[0].kode,
    regency_kode: regency.rows[0].kode,
    district_kode: districtRow.kode,
    village_kode: villageRow.kode,
    province: province.rows[0].name,
    regency: regency.rows[0].name,
    district: districtRow.name,
    village: villageRow.name,
  };
}

async function geocodeSearch(req, res) {
  try {
    const { q } = req.query;
    if (!q?.trim()) {
      return res.status(400).json({ message: "Kata kunci pencarian wajib diisi" });
    }

    const data = await nominatimFetch(
      `/search?format=json&addressdetails=1&limit=5&countrycodes=id&q=${encodeURIComponent(q.trim())}`
    );

    res.json(
      (Array.isArray(data) ? data : []).map((item) => ({
        lat: Number(item.lat),
        lon: Number(item.lon),
        display_name: item.display_name,
      }))
    );
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Pencarian alamat gagal" });
  }
}

async function resolveFromCoordinates(req, res) {
  try {
    const { latitude, longitude } = req.query;
    if (latitude == null || longitude == null) {
      return res.status(400).json({ message: "latitude dan longitude wajib diisi" });
    }

    const data = await nominatimFetch(
      `/reverse?format=json&addressdetails=1&lat=${latitude}&lon=${longitude}`
    );

    const matched = await matchWilayah(data.address || {});
    if (!matched) {
      return res.status(404).json({
        message:
          "Wilayah belum tersedia di sistem. Pilih titik di Jawa Barat (area Sukabumi/Bogor/Cianjur) atau hubungi operator.",
        display_name: data.display_name,
      });
    }

    res.json({
      ...matched,
      display_name: data.display_name,
      latitude: Number(latitude),
      longitude: Number(longitude),
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Gagal membaca lokasi dari peta" });
  }
}

async function getProvinces(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, name FROM provinces ORDER BY name ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getRegencies(req, res) {
  try {
    const { province_id } = req.query;
    if (!province_id) {
      return res.status(400).json({ message: "province_id wajib diisi" });
    }
    const result = await pool.query(
      `SELECT id, name FROM regencies WHERE province_id = $1 ORDER BY name ASC`,
      [province_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getDistricts(req, res) {
  try {
    const { regency_id } = req.query;
    if (!regency_id) {
      return res.status(400).json({ message: "regency_id wajib diisi" });
    }
    const result = await pool.query(
      `SELECT id, name FROM districts WHERE regency_id = $1 ORDER BY name ASC`,
      [regency_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getVillages(req, res) {
  try {
    const { district_id } = req.query;
    if (!district_id) {
      return res.status(400).json({ message: "district_id wajib diisi" });
    }
    const result = await pool.query(
      `SELECT id, name FROM villages WHERE district_id = $1 ORDER BY name ASC`,
      [district_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  geocodeSearch,
  resolveFromCoordinates,
  getProvinces,
  getRegencies,
  getDistricts,
  getVillages,
};
