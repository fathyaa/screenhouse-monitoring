import { useEffect, useState } from "react";

import { API_URL } from "../config/api";

export default function WilayahFilter({ value, onChange, showRegency = true }) {
  const [regencies, setRegencies] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [villages, setVillages] = useState([]);

  useEffect(() => {
    fetch(`${API_URL}/wilayah/regencies?province_id=1`)
      .then((r) => r.json())
      .then((data) => setRegencies(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!value.regency_id) {
      setDistricts([]);
      setVillages([]);
      return;
    }
    fetch(`${API_URL}/wilayah/districts?regency_id=${value.regency_id}`)
      .then((r) => r.json())
      .then((data) => setDistricts(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, [value.regency_id]);

  useEffect(() => {
    if (!value.district_id) {
      setVillages([]);
      return;
    }
    fetch(`${API_URL}/wilayah/villages?district_id=${value.district_id}`)
      .then((r) => r.json())
      .then((data) => setVillages(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, [value.district_id]);

  const selectClass =
    "h-9 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-800 outline-none focus:ring-1 focus:ring-green-300 min-w-[140px]";

  return (
    <div className="flex flex-wrap gap-2 items-center text-left">
      {showRegency && (
        <select
          value={value.regency_id || ""}
          onChange={(e) =>
            onChange({
              regency_id: e.target.value || "",
              district_id: "",
              village_id: "",
            })
          }
          className={selectClass}
        >
          <option value="">Semua kab/kota</option>
          {regencies.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      )}
      <select
        value={value.district_id || ""}
        onChange={(e) =>
          onChange({
            ...value,
            district_id: e.target.value || "",
            village_id: "",
          })
        }
        disabled={!value.regency_id}
        className={`${selectClass} disabled:opacity-50`}
      >
        <option value="">Semua kecamatan</option>
        {districts.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      <select
        value={value.village_id || ""}
        onChange={(e) => onChange({ ...value, village_id: e.target.value || "" })}
        disabled={!value.district_id}
        className={`${selectClass} disabled:opacity-50`}
      >
        <option value="">Semua desa</option>
        {villages.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function buildWilayahQuery(wilayah) {
  const params = new URLSearchParams();
  if (wilayah.regency_id) params.set("regency_id", wilayah.regency_id);
  if (wilayah.district_id) params.set("district_id", wilayah.district_id);
  if (wilayah.village_id) params.set("village_id", wilayah.village_id);
  return params.toString();
}
