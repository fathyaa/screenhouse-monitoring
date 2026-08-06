#!/bin/bash
# Jalankan satu seri skenario berulang kali, satu per satu.
#
#   bash scripts/run-series.sh 3 S6 S7
#
# Argumen pertama = jumlah pengulangan, sisanya = id skenario.
#
# Pengulangan diperlukan karena selisih antar-run pada beban tinggi pernah
# mencapai 14 poin persen; klaim dari satu run mudah dipatahkan. Skenario
# dijalankan bergantian (S6, S7, S6, S7, ...) bukan berurutan penuh, supaya
# kalau seri terputus di tengah, tiap skenario tetap punya jumlah run yang
# seimbang alih-alih S6 lengkap dan S7 kosong.

set -u
cd "$(dirname "$0")/.." || exit 1

REPEATS="${1:?jumlah pengulangan}"
shift
SCENARIOS=("$@")

echo "=== Seri: ${REPEATS}× ${SCENARIOS[*]} ==="
echo "Mulai: $(date '+%Y-%m-%d %H:%M:%S')"

total=$((REPEATS * ${#SCENARIOS[@]}))
done_count=0

for ((i = 1; i <= REPEATS; i++)); do
  for id in "${SCENARIOS[@]}"; do
    done_count=$((done_count + 1))
    echo ""
    echo "--- [${done_count}/${total}] ${id} ulangan ${i} — $(date '+%H:%M:%S') ---"
    if ! npm run --silent run -- "$id"; then
      echo "!!! ${id} ulangan ${i} GAGAL — lanjut ke berikutnya"
    fi
  done
done

echo ""
echo "=== Seri selesai: $(date '+%Y-%m-%d %H:%M:%S') ==="
