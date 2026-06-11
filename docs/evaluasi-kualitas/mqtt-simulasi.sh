#!/usr/bin/env bash
# Simulasi MQTT tanpa hardware — model tray + sink (terbaru)
# Usage:
#   chmod +x docs/evaluasi-kualitas/mqtt-simulasi.sh
#   ./docs/evaluasi-kualitas/mqtt-simulasi.sh normal
#   ./docs/evaluasi-kualitas/mqtt-simulasi.sh alert-panas
#   ./docs/evaluasi-kualitas/mqtt-simulasi.sh alert-kering
#   ./docs/evaluasi-kualitas/mqtt-simulasi.sh aktuator-on
#   ./docs/evaluasi-kualitas/mqtt-simulasi.sh listen-command
#
# Prasyarat: Mosquitto jalan (docker compose), monitoring-service aktif, seed.sql sudah di-import.

set -euo pipefail

BROKER="${MQTT_BROKER:-localhost}"
TOPIC_SENSOR="screenhouse/1/sink/SH01-SINK/sensor"
TOPIC_COMMAND='screenhouse/+/sink/+/command'

# ─── Mapping seed demo (Screenhouse Sukabumi 01, milik Pak Eko) ───
# Tray sensor : SH01-T01, SH01-T02
# Sink gateway: SH01-SINK (relay fan / irigasi / lampu)

pub() {
  mosquitto_pub -h "$BROKER" -t "$TOPIC_SENSOR" -m "$1"
  echo "→ published to $TOPIC_SENSOR"
}

case "${1:-help}" in
  normal)
    echo "Telemetry tray SH01-T01 via sink (semua parameter normal / sehat)"
    pub '{
      "node_id": "SH01-T01",
      "destination_id": "SH01-SINK",
      "nitrogen": 30,
      "phosphorus": 20,
      "potassium": 30,
      "soil_moisture": 65,
      "soil_temperature": 27.0,
      "soil_ph": 6.3,
      "conductivity": 450,
      "air_temperature": 28,
      "air_humidity": 70,
      "light_intensity": 20000
    }'
    ;;

  tray-b)
    echo "Telemetry tray kedua SH01-T02"
    pub '{
      "node_id": "SH01-T02",
      "destination_id": "SH01-SINK",
      "nitrogen": 28,
      "phosphorus": 18,
      "potassium": 25,
      "soil_moisture": 62,
      "soil_temperature": 26.5,
      "soil_ph": 6.2,
      "conductivity": 430,
      "air_temperature": 27,
      "air_humidity": 68,
      "light_intensity": 18000
    }'
    ;;

  alert-panas)
    echo "Trigger alert: suhu udara 41°C > max 35°C (Increment 3 / UC-16)"
    pub '{
      "node_id": "SH01-T01",
      "destination_id": "SH01-SINK",
      "nitrogen": 30,
      "phosphorus": 20,
      "potassium": 30,
      "soil_moisture": 65,
      "soil_temperature": 27.0,
      "soil_ph": 6.3,
      "conductivity": 450,
      "air_temperature": 41,
      "air_humidity": 55,
      "light_intensity": 22000
    }'
    ;;

  alert-kering)
    echo "Trigger alert: kelembapan tanah 35% < min 50% (Increment 3 / UC-16)"
    pub '{
      "node_id": "SH01-T01",
      "destination_id": "SH01-SINK",
      "nitrogen": 30,
      "phosphorus": 20,
      "potassium": 30,
      "soil_moisture": 35,
      "soil_temperature": 27.0,
      "soil_ph": 6.3,
      "conductivity": 450,
      "air_temperature": 29,
      "air_humidity": 68,
      "light_intensity": 18000
    }'
    ;;

  aktuator-on)
    echo "Simulasi sink membalas status relay (setelah toggle di web atau command MQTT)"
    pub '{
      "node_id": "SH01-SINK",
      "destination_id": "SH01-SINK",
      "fan_status": true,
      "irrigation_status": false,
      "lamp_status": false,
      "source": "telemetry"
    }'
    ;;

  aktuator-off)
    echo "Simulasi semua relay OFF"
    pub '{
      "node_id": "SH01-SINK",
      "destination_id": "SH01-SINK",
      "fan_status": false,
      "irrigation_status": false,
      "lamp_status": false,
      "source": "telemetry"
    }'
    ;;

  listen-command)
    echo "Dengarkan perintah aktuator dari dashboard (Ctrl+C untuk stop)"
    echo "Topic: $TOPIC_COMMAND"
    mosquitto_sub -h "$BROKER" -t "$TOPIC_COMMAND" -v
    ;;

  loop-normal)
    echo "Publish telemetry normal 10× (untuk isi metrics-boxplot / reliability)"
    for i in $(seq 1 10); do
      echo "Run $i/10"
      "$0" normal
      sleep 2
    done
    ;;

  sh2-peringatan)
    echo "Telemetry SH02-T01 — kelembapan rendah (screenhouse 2)"
    mosquitto_pub -h "$BROKER" -t "screenhouse/2/sink/SH02-SINK/sensor" -m '{
      "node_id": "SH02-T01",
      "destination_id": "SH02-SINK",
      "nitrogen": 30, "phosphorus": 20, "potassium": 30,
      "soil_moisture": 35, "soil_temperature": 27.0, "soil_ph": 6.3,
      "conductivity": 450, "air_temperature": 29, "air_humidity": 68,
      "light_intensity": 18000
    }'
    ;;

  legacy)
    echo "Topic lama masih didukung (node_code, tanpa destination_id)"
    mosquitto_pub -h "$BROKER" -t "screenhouse/1/node/SH01-T01/sensor" -m '{
      "node_code": "SH01-T01",
      "nitrogen": 30, "soil_moisture": 65, "air_temperature": 28
    }'
    ;;

  help|*)
    cat <<'EOF'
Perintah:
  normal          Telemetry tray SH01-T01 (sehat)
  tray-b          Telemetry tray SH01-T02
  alert-panas     Alert suhu udara tinggi
  alert-kering    Alert kelembapan tanah rendah
  aktuator-on     Balasan status relay ON (fan)
  aktuator-off    Balasan semua relay OFF
  listen-command  Subscrib command dari dashboard
  loop-normal     Publish normal 10×
  sh2-peringatan   Demo screenhouse 2
  legacy          Topic/payload format lama (fallback)

Kode node (setelah migrasi sink):
  SH01  →  T01, T02 (tray)  +  SH01-SINK (gateway)
  SH02  →  T01               +  SH02-SINK
  SH03  →  T01               +  SH03-SINK
EOF
    ;;
esac
