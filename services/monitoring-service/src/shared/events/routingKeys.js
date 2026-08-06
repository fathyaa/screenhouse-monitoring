/**
 * Routing key untuk exchange `shms.events`.
 *
 * Aturan penamaan: `<domain>.<peristiwa lampau>`. Nama harus menyebut apa yang
 * SUDAH terjadi, bukan apa yang harus dikerjakan penerima — begitu sebuah key
 * berbunyi seperti perintah ("kirim.notifikasi"), listener-nya jadi terikat ke
 * satu pemakai dan tidak bisa ditumpangi listener kedua.
 */
const RK = {
  // Pembacaan sensor sudah tervalidasi & node-nya terselesaikan, TAPI belum
  // masuk database — belum punya id.
  SENSOR_RAW: "sensor.raw",

  // Baris sensor_data sudah commit. Payload membawa `sensorDataId`; inilah satu-
  // satunya event yang boleh dipakai pihak yang butuh foreign key ke sensor_data
  // (lihat alerts.sensor_data_id).
  SENSOR_PERSISTED: "sensor.persisted",

  ALERT_CREATED: "alert.created",
  ALERT_RESOLVED: "alert.resolved",

  ACTUATOR_UPDATED: "actuator.updated",

  // Diterbitkan app-service saat katalog berubah. Konsumennya listener alert,
  // yang menyimpan salinannya di DB monitoring (threshold_snapshots,
  // screenhouse_registry) supaya evaluasi ambang tidak perlu lintas database.
  CONFIG_THRESHOLD: "config.threshold",
  CONFIG_REGISTRY: "config.registry",

  // Telemetri internal untuk uji beban. Tiap proses melaporkan counter-nya
  // sendiri ke role `api`, yang menjumlahkannya. Tanpa ini, /stats/ingest hanya
  // melihat proses yang kebetulan melayaninya — dan role api tidak mengonsumsi
  // satu pun pesan sensor, jadi angkanya akan selalu nol.
  METRICS_REPORT: "metrics.report",
  // Perintah reset dari /stats/ingest/reset, disiarkan ke semua proses supaya
  // satu run pengujian punya titik nol yang sama.
  METRICS_RESET: "metrics.reset",
};

const BINDINGS = {
  PERSIST: [RK.SENSOR_RAW],
  ALERT: [RK.SENSOR_PERSISTED],
  CONFIG: [RK.CONFIG_THRESHOLD, RK.CONFIG_REGISTRY],
  NOTIF: [RK.ALERT_CREATED],
  // Gateway realtime menonton semua yang tampil di layar petani. Ia sengaja
  // menumpang `sensor.persisted` (bukan `sensor.raw`) karena payload dashboard
  // memakai kolom hasil INSERT — id dan created_at final.
  REALTIME: [RK.SENSOR_PERSISTED, RK.ALERT_CREATED, RK.ALERT_RESOLVED, RK.ACTUATOR_UPDATED],
};

module.exports = { RK, BINDINGS };
