#!/bin/bash
# Sweep jumlah replica persistence pada satu skenario.
#
#   bash scripts/sweep-replica.sh S9 3 1 2 4
#     └ skenario, jumlah ulangan, lalu daftar jumlah replica
#
# HARUS dijalankan TANPA override prod-sim (profil `unlimited`).
#
# Alasannya: prod-sim memaku seluruh role monitoring ke core 0. Menambah replica
# di sana tidak menambah kapasitas sedikit pun — empat proses tetap berbagi satu
# core, persis seperti menambah pod di node yang sama. Itu model yang benar untuk
# menjawab "apakah redesign menolong deployment saya", tapi mustahil menjawab
# "apakah arsitekturnya bisa menskala".
#
# Sweep ini menjawab pertanyaan kedua, jadi ia butuh core yang benar-benar
# bertambah. Hasilnya karena itu TIDAK boleh dibaca sebagai kapasitas produksi,
# dan laporan memisahkannya ke bagian profil `unlimited`.
#
# Beban harus MENJENUHKAN satu replica. Kalau tidak, ketiga konfigurasi akan
# menghasilkan angka yang sama dan itu terbaca keliru sebagai "menambah replica
# tidak berguna", padahal yang benar "bebannya terlalu ringan untuk membedakan".

set -u
cd "$(dirname "$0")/.." || exit 1

SCENARIO="${1:?id skenario, mis. S9}"
REPEATS="${2:?jumlah ulangan}"
shift 2
REPLICAS=("$@")

COMPOSE_DIR="$(cd .. && pwd)/docker"

echo "=== Sweep replica: ${SCENARIO}, ${REPEATS}× pada replica ${REPLICAS[*]} ==="
echo "Mulai: $(date '+%Y-%m-%d %H:%M:%S')"

for n in "${REPLICAS[@]}"; do
  echo ""
  echo "########## persistence=${n} ##########"

  # Skala diubah SEBELUM seri, lalu dibiarkan tetap selama seluruh ulangan.
  # Mengubahnya di tengah membuat ulangan tidak sebanding satu sama lain.
  (cd "$COMPOSE_DIR" && docker compose \
    -f docker-compose.yaml -f docker-compose.loadtest.yaml \
    up -d --scale "persistence=${n}" --no-recreate 2>&1 | tail -2)

  echo "-> menunggu backend siap"
  for _ in $(seq 1 60); do
    curl -sf http://localhost:3001/stats/ingest >/dev/null 2>&1 && break
    sleep 5
  done

  # Pastikan jumlah replica yang BENAR-BENAR berjalan sesuai permintaan —
  # blok environment di hasil mengambil angka ini, dan kalau meleset seluruh
  # sel sweep akan tercatat di kolom yang salah.
  actual=$(docker ps --filter "label=com.docker.compose.service=persistence" --format '{{.Names}}' | wc -l | tr -d ' ')
  echo "-> replica persistence aktif: ${actual} (diminta ${n})"
  if [ "$actual" != "$n" ]; then
    echo "!!! jumlah replica tidak sesuai — melewati kelompok ini"
    continue
  fi

  for ((i = 1; i <= REPEATS; i++)); do
    echo ""
    echo "--- ${SCENARIO} replica=${n} ulangan ${i} — $(date '+%H:%M:%S') ---"
    npm run --silent run -- "$SCENARIO" || echo "!!! GAGAL — lanjut"
  done
done

echo ""
echo "=== Sweep selesai: $(date '+%Y-%m-%d %H:%M:%S') ==="
echo "Kembalikan ke satu replica:"
echo "  cd ${COMPOSE_DIR} && docker compose -f docker-compose.yaml -f docker-compose.loadtest.yaml up -d --scale persistence=1"
