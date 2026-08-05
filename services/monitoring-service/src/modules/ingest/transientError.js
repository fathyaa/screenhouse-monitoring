/**
 * Pemilah kegagalan ingest: infrastruktur (sementara) vs payload (permanen).
 *
 * Dipakai consumer RabbitMQ untuk memutuskan nasib satu pesan:
 *   transient → dikembalikan ke queue, dicoba lagi (data tidak boleh hilang
 *               cuma karena Postgres/Redis sedang mati)
 *   permanen  → dipindah ke dead-letter queue (mengulang payload rusak
 *               selamanya cuma bikin consumer macet)
 *
 * Prinsipnya konservatif: yang tidak dikenali dianggap permanen supaya tidak
 * ada pesan yang berputar tanpa henti. Konsekuensinya, error infrastruktur baru
 * yang belum terdaftar akan mendarat di dead-letter queue — masih bisa
 * diinspeksi dan di-replay, bukan hilang.
 */

// Kode syscall Node saat koneksi TCP ke Postgres/Redis bermasalah.
const TRANSIENT_SYSCALL_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EPIPE",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "EAI_AGAIN",
]);

// SQLSTATE spesifik yang layak diulang.
//   40001 serialization failure, 40P01 deadlock — sukses kalau diulang.
const TRANSIENT_SQLSTATES = new Set(["40001", "40P01"]);

// Kelas SQLSTATE (2 digit pertama) yang selalu bersifat sementara.
//   08 connection exception
//   53 insufficient resources (too many clients, out of memory, disk full)
//   57 operator intervention (shutdown, restart, admin command, starting up)
const TRANSIENT_SQLSTATE_CLASSES = new Set(["08", "53", "57"]);

// node-redis dan pg tidak selalu mengisi .code — beberapa kegagalan koneksi
// hanya muncul sebagai pesan teks.
const TRANSIENT_MESSAGE_PATTERNS = [
  /connection terminated/i,
  /connection ended/i,
  /connection closed/i,
  /client has encountered a connection error/i,
  /timeout exceeded when trying to connect/i,
  /the client is closed/i,
  /socket closed unexpectedly/i,
  /connection timeout/i,
  /server closed the connection/i,
  /pool is (?:ending|ended)/i,
];

function isTransientError(err) {
  if (!err) return false;

  if (err.code && TRANSIENT_SYSCALL_CODES.has(String(err.code))) return true;

  // pg menaruh SQLSTATE di .code juga, jadi cek setelah syscall code.
  const sqlState = String(err.code ?? "");
  if (TRANSIENT_SQLSTATES.has(sqlState)) return true;
  if (sqlState.length === 5 && TRANSIENT_SQLSTATE_CLASSES.has(sqlState.slice(0, 2))) return true;

  const message = String(err.message ?? "");
  if (TRANSIENT_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))) return true;

  // Error terbungkus (mis. AggregateError dari node-redis).
  if (err.cause && err.cause !== err) return isTransientError(err.cause);

  return false;
}

module.exports = { isTransientError };
