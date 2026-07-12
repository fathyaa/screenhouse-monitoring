/**
 * Status kesehatan screenhouse — selaras popup peta (map-summary) & halaman detail.
 * 1 parameter/alert aktif → warning; 2+ → critical.
 */
function deriveScreenhouseStatus({ abnormalCount = 0, activeAlertCount = 0 } = {}) {
  if (activeAlertCount >= 2 || abnormalCount >= 2) return "critical";
  if (activeAlertCount >= 1 || abnormalCount >= 1) return "warning";
  return "healthy";
}

module.exports = { deriveScreenhouseStatus };
