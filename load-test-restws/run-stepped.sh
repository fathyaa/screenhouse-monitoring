#!/usr/bin/env bash
#
# Stepped load test — menaikkan beban BERTAHAP dari kecil ke besar, satu run
# k6 per level. Tiap run menghasilkan satu file step-<track>-<level>-...json,
# yang jadi SATU titik pada kurva throughput-vs-beban & latensi-vs-beban.
#
# Dua track:
#   rest → REST API murni (tanpa WebSocket). Variabel = jumlah VU (user aktif).
#   ws   → WebSocket murni. Variabel = jumlah koneksi realtime konkuren.
#
# Kenapa run terpisah per level (bukan satu ramp panjang): k6 hanya memberi
# SATU ringkasan agregat per run. Untuk kurva gradual yang bersih, tiap level
# harus punya angka steady-state-nya sendiri → satu run per level.
#
# Prasyarat: app-service:8000, monitoring-service:3001, DB, Redis jalan; dan
# data seed 555 akun (lihat README.md). Idealnya k6 dijalankan dari mesin lain.
#
# Pakai:
#   ./run-stepped.sh              # kedua track, level default
#   ./run-stepped.sh rest         # hanya REST
#   ./run-stepped.sh ws           # hanya WebSocket
#   REST_LEVELS="10 50 100" ./run-stepped.sh rest   # level custom
#
set -euo pipefail
cd "$(dirname "$0")"

TRACK="${1:-all}"

# Level beban bertahap. Mulai dari kecil (10) supaya kaki kurva (kondisi ringan)
# terlihat, lalu naik ~2x tiap langkah sampai membebani.
REST_LEVELS="${REST_LEVELS:-10 25 50 100 200 400}"
WS_LEVELS="${WS_LEVELS:-10 50 100 200 400 800}"

HOLD="${HOLD:-45s}"          # durasi tahan beban di tiap level (fase steady-state)
WS_HOLD_SEC="${WS_HOLD_SEC:-30}"   # berapa detik koneksi WS ditahan
COOLDOWN="${COOLDOWN:-15}"   # jeda antar level, biar server pulih dulu

pad() { printf "%03d" "$1"; }

# Jalankan k6 tanpa mematikan loop kalau threshold NFR terlampaui. k6 keluar
# dengan kode 99 saat threshold crossed (p95 > 2s / gagal > 1%) — itu HASIL yang
# diharapkan di beban tinggi (titik jenuh), bukan kegagalan; JSON tetap tertulis.
# Kode lain (mis. skrip error) tetap ditampilkan supaya masalah nyata kelihatan.
k6run() {
  local rc=0
  k6 run "$@" || rc=$?
  if [ "$rc" -eq 99 ]; then
    echo "  (threshold NFR terlampaui di level ini — normal saat jenuh; JSON tetap tersimpan)"
  elif [ "$rc" -ne 0 ]; then
    echo "  (PERHATIAN: k6 keluar dengan kode $rc — kemungkinan error nyata, cek output di atas)"
  fi
}

run_rest() {
  echo "══ Track REST — level: $REST_LEVELS ══"
  for lvl in $REST_LEVELS; do
    echo ""; echo "─── REST @ ${lvl} VU ───"
    RUN_LABEL="rest-$(pad "$lvl")" \
    PROFILE=baseline VUS="$lvl" DURATION="$HOLD" WS_HOLD_SEC=0 \
      k6run k6-bibitlive-scenarios.js
    echo "(cooldown ${COOLDOWN}s)"; sleep "$COOLDOWN"
  done
}

run_ws() {
  echo "══ Track WebSocket — level: $WS_LEVELS ══"
  for lvl in $WS_LEVELS; do
    echo ""; echo "─── WS @ ${lvl} koneksi ───"
    RUN_LABEL="ws-$(pad "$lvl")" \
    PROFILE=wsstep VUS="$lvl" DURATION="$HOLD" WS_HOLD_SEC="$WS_HOLD_SEC" \
      k6run k6-bibitlive-scenarios.js
    echo "(cooldown ${COOLDOWN}s)"; sleep "$COOLDOWN"
  done
}

case "$TRACK" in
  rest) run_rest ;;
  ws)   run_ws ;;
  all)  run_rest; run_ws ;;
  *) echo "Track tidak dikenal: $TRACK (pilih: rest | ws | all)"; exit 1 ;;
esac

echo ""
echo "Selesai. Bangun laporan HTML:"
echo "  python3 build-report.py"
