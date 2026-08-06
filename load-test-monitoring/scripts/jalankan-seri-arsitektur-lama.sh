#!/bin/bash
# Jalankan seri uji beban pada ARSITEKTUR LAMA (branch main), memakai harness
# dari branch arsitektur-redesign.
#
#   bash scripts/jalankan-seri-arsitektur-lama.sh 3 S6 S7
#
# Kenapa pakai git worktree, bukan `git checkout main`:
#
#   Harness pengukuran ada di branch arsitektur-redesign. Kalau repo utama
#   di-checkout ke main, harness-nya ikut hilang — padahal justru harness yang
#   sama itulah yang membuat kedua seri sebanding. Worktree memberi salinan
#   kode main di direktori terpisah tanpa memindahkan repo utama, jadi harness
#   tetap di tempatnya dan bisa dipanggil dari sini.
#
# Nama project Docker Compose ditentukan nama direktori compose-nya — sama-sama
# "docker" di kedua worktree. Itu DISENGAJA: keduanya berbagi volume Postgres
# yang sama, sehingga populasi sensor node dan ukuran database tidak berubah
# antar seri. Konsekuensinya kedua stack tidak boleh hidup bersamaan; skrip ini
# mematikan yang sedang jalan lebih dulu.

set -euo pipefail

REPEATS="${1:?jumlah pengulangan}"
shift
SCENARIOS=("$@")

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
WORKTREE="${REPO}/../bibitlive-arsitektur-lama"
HARNESS="${REPO}/load-test-monitoring"

echo "=== Persiapan arsitektur lama ==="

# 1. Matikan stack arsitektur baru (container saja; volume dipertahankan).
echo "-> menghentikan stack arsitektur baru"
(cd "${REPO}/docker" && docker compose down --remove-orphans) || true

# 2. Siapkan worktree berisi kode main.
if [ ! -d "$WORKTREE" ]; then
  echo "-> membuat worktree main di ${WORKTREE}"
  git -C "$REPO" worktree add "$WORKTREE" main
else
  echo "-> worktree sudah ada, menyegarkan ke main"
  git -C "$WORKTREE" checkout main
  git -C "$WORKTREE" pull --ff-only 2>/dev/null || true
fi

# 3. Naikkan stack lama dengan alokasi core yang IDENTIK dengan arsitektur baru.
#    Override ketiga memaku tiap service ke core yang sama persis seperti
#    prod-sim di branch redesign — tanpa itu, arsitektur lama memakai `cpus: 1`
#    yang boleh berpindah core sementara yang baru terkurung di core 0, dan
#    selisih mekanisme itu ikut terukur sebagai selisih arsitektur.
CPUSET_OVERRIDE="${HARNESS}/config/compose-arsitektur-lama-cpuset.yaml"
echo "-> membangun & menaikkan stack arsitektur lama (prod-sim + cpuset selaras)"
(cd "${WORKTREE}/docker" && docker compose \
  -f docker-compose.yaml \
  -f docker-compose.prod-sim.yaml \
  -f docker-compose.rabbitmq.yaml \
  -f "$CPUSET_OVERRIDE" \
  up -d --build --remove-orphans)

echo "-> menunggu backend siap"
for _ in $(seq 1 60); do
  if curl -sf http://localhost:3001/stats/ingest >/dev/null 2>&1; then break; fi
  sleep 5
done

curl -s http://localhost:3001/ | head -c 200
echo ""

# 4. Jalankan seri memakai harness dari branch redesign.
echo "=== Seri arsitektur lama: ${REPEATS}× ${SCENARIOS[*]} ==="
cd "$HARNESS"
bash scripts/run-series.sh "$REPEATS" "${SCENARIOS[@]}"

echo ""
echo "Selesai. Untuk kembali ke arsitektur baru:"
echo "  cd ${WORKTREE}/docker && docker compose down"
echo "  cd ${REPO}/docker && docker compose -f docker-compose.yaml -f docker-compose.prod-sim.yaml -f docker-compose.loadtest.yaml up -d"
