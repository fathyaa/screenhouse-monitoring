/** Nama petani demo — dipakai seed stress / seed petani. */
export const FARMER_NAMES = [
  "Budi Santoso",
  "Siti Rahayu",
  "Agus Wijaya",
  "Dewi Lestari",
  "Rudi Hartono",
  "Neneng Suryani",
  "Joko Susilo",
  "Maya Kurnia",
  "Hendra Gunawan",
  "Fitri Handayani",
  "Asep Saepudin",
  "Yuni Astuti",
  "Dani Pratama",
  "Rina Marlina",
  "Ujang Kurniawan",
  "Sri Wahyuni",
  "Oki Setiawan",
  "Lina Anggraini",
  "Dedi Mulyadi",
  "Ani Pertiwi",
  "Rizki Ramadhan",
  "Wati Suhartini",
  "Ferdi Nugroho",
  "Tuti Alawiyah",
  "Guntur Saputra",
];

export const SEED_VARIETIES = [
  "Inpari 32",
  "Inpari 42",
  "Ciherang",
  "IR64",
  "Inpari 43",
  "Situbagendit",
];

export function farmerName(index) {
  const i = Math.max(1, index) - 1;
  return FARMER_NAMES[i % FARMER_NAMES.length];
}

export function seedProfile(index) {
  const i = Math.max(0, index);
  return {
    seed_variety: SEED_VARIETIES[i % SEED_VARIETIES.length],
    seedling_days: 5 + (i % 21),
  };
}
