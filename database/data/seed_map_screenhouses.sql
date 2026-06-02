-- Screenhouse Cicurug Utara

INSERT INTO screenhouses (name, province_id, regency_id, district_id, village_id, owner_user_id, address_detail, latitude, longitude, status)
SELECT 'Screenhouse Cicurug Utara', p.id, r.id, d.id,
       (SELECT v.id FROM villages v WHERE v.district_id = d.id ORDER BY v.id LIMIT 1),
       1, 'Dekat pasar Cicurug', -6.7821, 106.7892, 'active'
FROM provinces p
JOIN regencies r ON r.kode = '32.02' AND r.province_id = p.id
JOIN districts d ON d.regency_id = r.id AND lower(d.name) = lower('Cicurug')
WHERE p.kode = '32'
  AND NOT EXISTS (SELECT 1 FROM screenhouses s WHERE s.name = 'Screenhouse Cicurug Utara');

INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
SELECT s.id, 'SHM01-N01', 'Node Utama', 'Pusat screenhouse', 60, true
FROM screenhouses s
WHERE s.name = 'Screenhouse Cicurug Utara'
  AND NOT EXISTS (SELECT 1 FROM sensor_nodes sn WHERE sn.node_code = 'SHM01-N01');

INSERT INTO thresholds (screenhouse_id, min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus, min_potassium, max_potassium, min_soil_moisture, max_soil_moisture, min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph, min_conductivity, max_conductivity, min_air_temperature, max_air_temperature, min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity)
SELECT s.id, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000
FROM screenhouses s
WHERE s.name = 'Screenhouse Cicurug Utara'
  AND NOT EXISTS (SELECT 1 FROM thresholds t WHERE t.screenhouse_id = s.id);

INSERT INTO sensor_data (sensor_node_id, nitrogen, phosphorus, potassium, soil_temperature, soil_moisture, soil_ph, conductivity, air_temperature, air_humidity, light_intensity, fan_status, irrigation_status, lamp_status, created_at)
SELECT sn.id, 21, 13, 17, 26.3, 56.0, 6.1, 405, 28, 61, 11200, false, true, false, NOW() - INTERVAL '2 hours'
FROM sensor_nodes sn
JOIN screenhouses s ON s.id = sn.screenhouse_id
WHERE s.name = 'Screenhouse Cicurug Utara' AND sn.node_code LIKE 'SHM01-N%'
  AND NOT EXISTS (
    SELECT 1 FROM sensor_data sd WHERE sd.sensor_node_id = sn.id AND sd.created_at >= NOW() - INTERVAL '24 hours'
  );



-- Screenhouse Cicurug Selatan

INSERT INTO screenhouses (name, province_id, regency_id, district_id, village_id, owner_user_id, address_detail, latitude, longitude, status)
SELECT 'Screenhouse Cicurug Selatan', p.id, r.id, d.id,
       (SELECT v.id FROM villages v WHERE v.district_id = d.id ORDER BY v.id LIMIT 1),
       1, 'Area persawahan', -6.8012, 106.7756, 'active'
FROM provinces p
JOIN regencies r ON r.kode = '32.02' AND r.province_id = p.id
JOIN districts d ON d.regency_id = r.id AND lower(d.name) = lower('Cicurug')
WHERE p.kode = '32'
  AND NOT EXISTS (SELECT 1 FROM screenhouses s WHERE s.name = 'Screenhouse Cicurug Selatan');

INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
SELECT s.id, 'SHM02-N01', 'Node Utama', 'Pusat screenhouse', 60, true
FROM screenhouses s
WHERE s.name = 'Screenhouse Cicurug Selatan'
  AND NOT EXISTS (SELECT 1 FROM sensor_nodes sn WHERE sn.node_code = 'SHM02-N01');

INSERT INTO thresholds (screenhouse_id, min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus, min_potassium, max_potassium, min_soil_moisture, max_soil_moisture, min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph, min_conductivity, max_conductivity, min_air_temperature, max_air_temperature, min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity)
SELECT s.id, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000
FROM screenhouses s
WHERE s.name = 'Screenhouse Cicurug Selatan'
  AND NOT EXISTS (SELECT 1 FROM thresholds t WHERE t.screenhouse_id = s.id);

INSERT INTO sensor_data (sensor_node_id, nitrogen, phosphorus, potassium, soil_temperature, soil_moisture, soil_ph, conductivity, air_temperature, air_humidity, light_intensity, fan_status, irrigation_status, lamp_status, created_at)
SELECT sn.id, 22, 14, 18, 26.6, 57.0, 6.2, 410, 29, 62, 11400, true, true, false, NOW() - INTERVAL '3 hours'
FROM sensor_nodes sn
JOIN screenhouses s ON s.id = sn.screenhouse_id
WHERE s.name = 'Screenhouse Cicurug Selatan' AND sn.node_code LIKE 'SHM02-N%'
  AND NOT EXISTS (
    SELECT 1 FROM sensor_data sd WHERE sd.sensor_node_id = sn.id AND sd.created_at >= NOW() - INTERVAL '24 hours'
  );



-- Screenhouse Cibadak

INSERT INTO screenhouses (name, province_id, regency_id, district_id, village_id, owner_user_id, address_detail, latitude, longitude, status)
SELECT 'Screenhouse Cibadak', p.id, r.id, d.id,
       (SELECT v.id FROM villages v WHERE v.district_id = d.id ORDER BY v.id LIMIT 1),
       1, 'Pembibitan padi varietas lokal', -6.8945, 106.7321, 'active'
FROM provinces p
JOIN regencies r ON r.kode = '32.02' AND r.province_id = p.id
JOIN districts d ON d.regency_id = r.id AND lower(d.name) = lower('Cibadak')
WHERE p.kode = '32'
  AND NOT EXISTS (SELECT 1 FROM screenhouses s WHERE s.name = 'Screenhouse Cibadak');

INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
SELECT s.id, 'SHM03-N01', 'Node Utama', 'Pusat screenhouse', 60, true
FROM screenhouses s
WHERE s.name = 'Screenhouse Cibadak'
  AND NOT EXISTS (SELECT 1 FROM sensor_nodes sn WHERE sn.node_code = 'SHM03-N01');

INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
SELECT s.id, 'SHM03-N02', 'Node Timur', 'Zona timur', 60, true
FROM screenhouses s
WHERE s.name = 'Screenhouse Cibadak'
  AND NOT EXISTS (SELECT 1 FROM sensor_nodes sn WHERE sn.node_code = 'SHM03-N02');

INSERT INTO thresholds (screenhouse_id, min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus, min_potassium, max_potassium, min_soil_moisture, max_soil_moisture, min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph, min_conductivity, max_conductivity, min_air_temperature, max_air_temperature, min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity)
SELECT s.id, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000
FROM screenhouses s
WHERE s.name = 'Screenhouse Cibadak'
  AND NOT EXISTS (SELECT 1 FROM thresholds t WHERE t.screenhouse_id = s.id);

INSERT INTO sensor_data (sensor_node_id, nitrogen, phosphorus, potassium, soil_temperature, soil_moisture, soil_ph, conductivity, air_temperature, air_humidity, light_intensity, fan_status, irrigation_status, lamp_status, created_at)
SELECT sn.id, 23, 15, 19, 26.9, 58.0, 6.3, 415, 30, 63, 11600, false, true, true, NOW() - INTERVAL '4 hours'
FROM sensor_nodes sn
JOIN screenhouses s ON s.id = sn.screenhouse_id
WHERE s.name = 'Screenhouse Cibadak' AND sn.node_code LIKE 'SHM03-N%'
  AND NOT EXISTS (
    SELECT 1 FROM sensor_data sd WHERE sd.sensor_node_id = sn.id AND sd.created_at >= NOW() - INTERVAL '24 hours'
  );



-- Screenhouse Cikidang (pegunungan selatan)

INSERT INTO screenhouses (name, province_id, regency_id, district_id, village_id, owner_user_id, address_detail, latitude, longitude, status)
SELECT 'Screenhouse Cikidang', p.id, r.id, d.id,
       (SELECT v.id FROM villages v WHERE v.district_id = d.id ORDER BY v.id LIMIT 1),
       1, 'Kaki Gunung Gede', -6.7145, 106.9241, 'active'
FROM provinces p
JOIN regencies r ON r.kode = '32.02' AND r.province_id = p.id
JOIN districts d ON d.regency_id = r.id AND lower(d.name) = lower('Cikidang')
WHERE p.kode = '32'
  AND NOT EXISTS (SELECT 1 FROM screenhouses s WHERE s.name = 'Screenhouse Cikidang');

INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
SELECT s.id, 'SHM04-N01', 'Node Utama', 'Pusat screenhouse', 60, true
FROM screenhouses s
WHERE s.name = 'Screenhouse Cikidang'
  AND NOT EXISTS (SELECT 1 FROM sensor_nodes sn WHERE sn.node_code = 'SHM04-N01');

INSERT INTO thresholds (screenhouse_id, min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus, min_potassium, max_potassium, min_soil_moisture, max_soil_moisture, min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph, min_conductivity, max_conductivity, min_air_temperature, max_air_temperature, min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity)
SELECT s.id, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000
FROM screenhouses s
WHERE s.name = 'Screenhouse Cikidang'
  AND NOT EXISTS (SELECT 1 FROM thresholds t WHERE t.screenhouse_id = s.id);

INSERT INTO sensor_data (sensor_node_id, nitrogen, phosphorus, potassium, soil_temperature, soil_moisture, soil_ph, conductivity, air_temperature, air_humidity, light_intensity, fan_status, irrigation_status, lamp_status, created_at)
SELECT sn.id, 24, 16, 20, 27.2, 59.0, 6.0, 420, 27, 64, 11800, true, true, false, NOW() - INTERVAL '5 hours'
FROM sensor_nodes sn
JOIN screenhouses s ON s.id = sn.screenhouse_id
WHERE s.name = 'Screenhouse Cikidang' AND sn.node_code LIKE 'SHM04-N%'
  AND NOT EXISTS (
    SELECT 1 FROM sensor_data sd WHERE sd.sensor_node_id = sn.id AND sd.created_at >= NOW() - INTERVAL '24 hours'
  );



-- Screenhouse Palabuhanratu

INSERT INTO screenhouses (name, province_id, regency_id, district_id, village_id, owner_user_id, address_detail, latitude, longitude, status)
SELECT 'Screenhouse Palabuhanratu', p.id, r.id, d.id,
       (SELECT v.id FROM villages v WHERE v.district_id = d.id ORDER BY v.id LIMIT 1),
       1, 'Dekat pantai selatan', -6.9886, 106.5374, 'active'
FROM provinces p
JOIN regencies r ON r.kode = '32.02' AND r.province_id = p.id
JOIN districts d ON d.regency_id = r.id AND lower(d.name) = lower('Palabuhanratu')
WHERE p.kode = '32'
  AND NOT EXISTS (SELECT 1 FROM screenhouses s WHERE s.name = 'Screenhouse Palabuhanratu');

INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
SELECT s.id, 'SHM05-N01', 'Node Utama', 'Pusat screenhouse', 60, true
FROM screenhouses s
WHERE s.name = 'Screenhouse Palabuhanratu'
  AND NOT EXISTS (SELECT 1 FROM sensor_nodes sn WHERE sn.node_code = 'SHM05-N01');

INSERT INTO thresholds (screenhouse_id, min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus, min_potassium, max_potassium, min_soil_moisture, max_soil_moisture, min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph, min_conductivity, max_conductivity, min_air_temperature, max_air_temperature, min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity)
SELECT s.id, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000
FROM screenhouses s
WHERE s.name = 'Screenhouse Palabuhanratu'
  AND NOT EXISTS (SELECT 1 FROM thresholds t WHERE t.screenhouse_id = s.id);

INSERT INTO sensor_data (sensor_node_id, nitrogen, phosphorus, potassium, soil_temperature, soil_moisture, soil_ph, conductivity, air_temperature, air_humidity, light_intensity, fan_status, irrigation_status, lamp_status, created_at)
SELECT sn.id, 25, 17, 21, 26.0, 60.0, 6.1, 425, 28, 65, 12000, false, true, false, NOW() - INTERVAL '6 hours'
FROM sensor_nodes sn
JOIN screenhouses s ON s.id = sn.screenhouse_id
WHERE s.name = 'Screenhouse Palabuhanratu' AND sn.node_code LIKE 'SHM05-N%'
  AND NOT EXISTS (
    SELECT 1 FROM sensor_data sd WHERE sd.sensor_node_id = sn.id AND sd.created_at >= NOW() - INTERVAL '24 hours'
  );



-- Screenhouse Sukaraja

INSERT INTO screenhouses (name, province_id, regency_id, district_id, village_id, owner_user_id, address_detail, latitude, longitude, status)
SELECT 'Screenhouse Sukaraja', p.id, r.id, d.id,
       (SELECT v.id FROM villages v WHERE v.district_id = d.id ORDER BY v.id LIMIT 1),
       1, 'Lahan datar irigasi', -6.9578, 106.5123, 'active'
FROM provinces p
JOIN regencies r ON r.kode = '32.02' AND r.province_id = p.id
JOIN districts d ON d.regency_id = r.id AND lower(d.name) = lower('Sukaraja')
WHERE p.kode = '32'
  AND NOT EXISTS (SELECT 1 FROM screenhouses s WHERE s.name = 'Screenhouse Sukaraja');

INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
SELECT s.id, 'SHM06-N01', 'Node Utama', 'Pusat screenhouse', 60, true
FROM screenhouses s
WHERE s.name = 'Screenhouse Sukaraja'
  AND NOT EXISTS (SELECT 1 FROM sensor_nodes sn WHERE sn.node_code = 'SHM06-N01');

INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
SELECT s.id, 'SHM06-N02', 'Node Timur', 'Zona timur', 60, true
FROM screenhouses s
WHERE s.name = 'Screenhouse Sukaraja'
  AND NOT EXISTS (SELECT 1 FROM sensor_nodes sn WHERE sn.node_code = 'SHM06-N02');

INSERT INTO thresholds (screenhouse_id, min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus, min_potassium, max_potassium, min_soil_moisture, max_soil_moisture, min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph, min_conductivity, max_conductivity, min_air_temperature, max_air_temperature, min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity)
SELECT s.id, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000
FROM screenhouses s
WHERE s.name = 'Screenhouse Sukaraja'
  AND NOT EXISTS (SELECT 1 FROM thresholds t WHERE t.screenhouse_id = s.id);

INSERT INTO sensor_data (sensor_node_id, nitrogen, phosphorus, potassium, soil_temperature, soil_moisture, soil_ph, conductivity, air_temperature, air_humidity, light_intensity, fan_status, irrigation_status, lamp_status, created_at)
SELECT sn.id, 26, 18, 16, 26.3, 61.0, 6.2, 430, 29, 66, 12200, true, true, true, NOW() - INTERVAL '7 hours'
FROM sensor_nodes sn
JOIN screenhouses s ON s.id = sn.screenhouse_id
WHERE s.name = 'Screenhouse Sukaraja' AND sn.node_code LIKE 'SHM06-N%'
  AND NOT EXISTS (
    SELECT 1 FROM sensor_data sd WHERE sd.sensor_node_id = sn.id AND sd.created_at >= NOW() - INTERVAL '24 hours'
  );



-- Screenhouse Simpenan

INSERT INTO screenhouses (name, province_id, regency_id, district_id, village_id, owner_user_id, address_detail, latitude, longitude, status)
SELECT 'Screenhouse Simpenan', p.id, r.id, d.id,
       (SELECT v.id FROM villages v WHERE v.district_id = d.id ORDER BY v.id LIMIT 1),
       1, 'Tepi hutan produksi', -7.0712, 106.4521, 'active'
FROM provinces p
JOIN regencies r ON r.kode = '32.02' AND r.province_id = p.id
JOIN districts d ON d.regency_id = r.id AND lower(d.name) = lower('Simpenan')
WHERE p.kode = '32'
  AND NOT EXISTS (SELECT 1 FROM screenhouses s WHERE s.name = 'Screenhouse Simpenan');

INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
SELECT s.id, 'SHM07-N01', 'Node Utama', 'Pusat screenhouse', 60, true
FROM screenhouses s
WHERE s.name = 'Screenhouse Simpenan'
  AND NOT EXISTS (SELECT 1 FROM sensor_nodes sn WHERE sn.node_code = 'SHM07-N01');

INSERT INTO thresholds (screenhouse_id, min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus, min_potassium, max_potassium, min_soil_moisture, max_soil_moisture, min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph, min_conductivity, max_conductivity, min_air_temperature, max_air_temperature, min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity)
SELECT s.id, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000
FROM screenhouses s
WHERE s.name = 'Screenhouse Simpenan'
  AND NOT EXISTS (SELECT 1 FROM thresholds t WHERE t.screenhouse_id = s.id);

INSERT INTO sensor_data (sensor_node_id, nitrogen, phosphorus, potassium, soil_temperature, soil_moisture, soil_ph, conductivity, air_temperature, air_humidity, light_intensity, fan_status, irrigation_status, lamp_status, created_at)
SELECT sn.id, 27, 19, 17, 26.6, 62.0, 6.3, 435, 30, 67, 12400, false, true, false, NOW() - INTERVAL '8 hours'
FROM sensor_nodes sn
JOIN screenhouses s ON s.id = sn.screenhouse_id
WHERE s.name = 'Screenhouse Simpenan' AND sn.node_code LIKE 'SHM07-N%'
  AND NOT EXISTS (
    SELECT 1 FROM sensor_data sd WHERE sd.sensor_node_id = sn.id AND sd.created_at >= NOW() - INTERVAL '24 hours'
  );



-- Screenhouse Parungkuda

INSERT INTO screenhouses (name, province_id, regency_id, district_id, village_id, owner_user_id, address_detail, latitude, longitude, status)
SELECT 'Screenhouse Parungkuda', p.id, r.id, d.id,
       (SELECT v.id FROM villages v WHERE v.district_id = d.id ORDER BY v.id LIMIT 1),
       1, 'Blok B pembibitan', -6.8543, 106.7215, 'active'
FROM provinces p
JOIN regencies r ON r.kode = '32.02' AND r.province_id = p.id
JOIN districts d ON d.regency_id = r.id AND lower(d.name) = lower('Parungkuda')
WHERE p.kode = '32'
  AND NOT EXISTS (SELECT 1 FROM screenhouses s WHERE s.name = 'Screenhouse Parungkuda');

INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
SELECT s.id, 'SHM08-N01', 'Node Utama', 'Pusat screenhouse', 60, true
FROM screenhouses s
WHERE s.name = 'Screenhouse Parungkuda'
  AND NOT EXISTS (SELECT 1 FROM sensor_nodes sn WHERE sn.node_code = 'SHM08-N01');

INSERT INTO thresholds (screenhouse_id, min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus, min_potassium, max_potassium, min_soil_moisture, max_soil_moisture, min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph, min_conductivity, max_conductivity, min_air_temperature, max_air_temperature, min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity)
SELECT s.id, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000
FROM screenhouses s
WHERE s.name = 'Screenhouse Parungkuda'
  AND NOT EXISTS (SELECT 1 FROM thresholds t WHERE t.screenhouse_id = s.id);

INSERT INTO sensor_data (sensor_node_id, nitrogen, phosphorus, potassium, soil_temperature, soil_moisture, soil_ph, conductivity, air_temperature, air_humidity, light_intensity, fan_status, irrigation_status, lamp_status, created_at)
SELECT sn.id, 28, 12, 18, 26.9, 63.0, 6.0, 440, 27, 68, 12600, true, true, false, NOW() - INTERVAL '9 hours'
FROM sensor_nodes sn
JOIN screenhouses s ON s.id = sn.screenhouse_id
WHERE s.name = 'Screenhouse Parungkuda' AND sn.node_code LIKE 'SHM08-N%'
  AND NOT EXISTS (
    SELECT 1 FROM sensor_data sd WHERE sd.sensor_node_id = sn.id AND sd.created_at >= NOW() - INTERVAL '24 hours'
  );



-- Screenhouse Cikembar

INSERT INTO screenhouses (name, province_id, regency_id, district_id, village_id, owner_user_id, address_detail, latitude, longitude, status)
SELECT 'Screenhouse Cikembar', p.id, r.id, d.id,
       (SELECT v.id FROM villages v WHERE v.district_id = d.id ORDER BY v.id LIMIT 1),
       1, 'Naungan screenhouse baru', -6.9215, 106.8123, 'active'
FROM provinces p
JOIN regencies r ON r.kode = '32.02' AND r.province_id = p.id
JOIN districts d ON d.regency_id = r.id AND lower(d.name) = lower('Cikembar')
WHERE p.kode = '32'
  AND NOT EXISTS (SELECT 1 FROM screenhouses s WHERE s.name = 'Screenhouse Cikembar');

INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
SELECT s.id, 'SHM09-N01', 'Node Utama', 'Pusat screenhouse', 60, true
FROM screenhouses s
WHERE s.name = 'Screenhouse Cikembar'
  AND NOT EXISTS (SELECT 1 FROM sensor_nodes sn WHERE sn.node_code = 'SHM09-N01');

INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
SELECT s.id, 'SHM09-N02', 'Node Timur', 'Zona timur', 60, true
FROM screenhouses s
WHERE s.name = 'Screenhouse Cikembar'
  AND NOT EXISTS (SELECT 1 FROM sensor_nodes sn WHERE sn.node_code = 'SHM09-N02');

INSERT INTO thresholds (screenhouse_id, min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus, min_potassium, max_potassium, min_soil_moisture, max_soil_moisture, min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph, min_conductivity, max_conductivity, min_air_temperature, max_air_temperature, min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity)
SELECT s.id, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000
FROM screenhouses s
WHERE s.name = 'Screenhouse Cikembar'
  AND NOT EXISTS (SELECT 1 FROM thresholds t WHERE t.screenhouse_id = s.id);

INSERT INTO sensor_data (sensor_node_id, nitrogen, phosphorus, potassium, soil_temperature, soil_moisture, soil_ph, conductivity, air_temperature, air_humidity, light_intensity, fan_status, irrigation_status, lamp_status, created_at)
SELECT sn.id, 29, 13, 19, 27.2, 64.0, 6.1, 445, 28, 69, 12800, false, true, true, NOW() - INTERVAL '10 hours'
FROM sensor_nodes sn
JOIN screenhouses s ON s.id = sn.screenhouse_id
WHERE s.name = 'Screenhouse Cikembar' AND sn.node_code LIKE 'SHM09-N%'
  AND NOT EXISTS (
    SELECT 1 FROM sensor_data sd WHERE sd.sensor_node_id = sn.id AND sd.created_at >= NOW() - INTERVAL '24 hours'
  );



-- Screenhouse Surade

INSERT INTO screenhouses (name, province_id, regency_id, district_id, village_id, owner_user_id, address_detail, latitude, longitude, status)
SELECT 'Screenhouse Surade', p.id, r.id, d.id,
       (SELECT v.id FROM villages v WHERE v.district_id = d.id ORDER BY v.id LIMIT 1),
       1, 'Dekat jalan raya Surade', -7.0345, 106.5721, 'active'
FROM provinces p
JOIN regencies r ON r.kode = '32.02' AND r.province_id = p.id
JOIN districts d ON d.regency_id = r.id AND lower(d.name) = lower('Surade')
WHERE p.kode = '32'
  AND NOT EXISTS (SELECT 1 FROM screenhouses s WHERE s.name = 'Screenhouse Surade');

INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
SELECT s.id, 'SHM10-N01', 'Node Utama', 'Pusat screenhouse', 60, true
FROM screenhouses s
WHERE s.name = 'Screenhouse Surade'
  AND NOT EXISTS (SELECT 1 FROM sensor_nodes sn WHERE sn.node_code = 'SHM10-N01');

INSERT INTO thresholds (screenhouse_id, min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus, min_potassium, max_potassium, min_soil_moisture, max_soil_moisture, min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph, min_conductivity, max_conductivity, min_air_temperature, max_air_temperature, min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity)
SELECT s.id, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000
FROM screenhouses s
WHERE s.name = 'Screenhouse Surade'
  AND NOT EXISTS (SELECT 1 FROM thresholds t WHERE t.screenhouse_id = s.id);

INSERT INTO sensor_data (sensor_node_id, nitrogen, phosphorus, potassium, soil_temperature, soil_moisture, soil_ph, conductivity, air_temperature, air_humidity, light_intensity, fan_status, irrigation_status, lamp_status, created_at)
SELECT sn.id, 30, 14, 20, 26.0, 65.0, 6.2, 450, 29, 60, 13000, true, true, false, NOW() - INTERVAL '11 hours'
FROM sensor_nodes sn
JOIN screenhouses s ON s.id = sn.screenhouse_id
WHERE s.name = 'Screenhouse Surade' AND sn.node_code LIKE 'SHM10-N%'
  AND NOT EXISTS (
    SELECT 1 FROM sensor_data sd WHERE sd.sensor_node_id = sn.id AND sd.created_at >= NOW() - INTERVAL '24 hours'
  );



-- Screenhouse Tegalbuleud

INSERT INTO screenhouses (name, province_id, regency_id, district_id, village_id, owner_user_id, address_detail, latitude, longitude, status)
SELECT 'Screenhouse Tegalbuleud', p.id, r.id, d.id,
       (SELECT v.id FROM villages v WHERE v.district_id = d.id ORDER BY v.id LIMIT 1),
       1, 'Zona trial varietas', -7.2123, 106.6521, 'active'
FROM provinces p
JOIN regencies r ON r.kode = '32.02' AND r.province_id = p.id
JOIN districts d ON d.regency_id = r.id AND lower(d.name) = lower('Tegalbuleud')
WHERE p.kode = '32'
  AND NOT EXISTS (SELECT 1 FROM screenhouses s WHERE s.name = 'Screenhouse Tegalbuleud');

INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
SELECT s.id, 'SHM11-N01', 'Node Utama', 'Pusat screenhouse', 60, true
FROM screenhouses s
WHERE s.name = 'Screenhouse Tegalbuleud'
  AND NOT EXISTS (SELECT 1 FROM sensor_nodes sn WHERE sn.node_code = 'SHM11-N01');

INSERT INTO thresholds (screenhouse_id, min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus, min_potassium, max_potassium, min_soil_moisture, max_soil_moisture, min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph, min_conductivity, max_conductivity, min_air_temperature, max_air_temperature, min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity)
SELECT s.id, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000
FROM screenhouses s
WHERE s.name = 'Screenhouse Tegalbuleud'
  AND NOT EXISTS (SELECT 1 FROM thresholds t WHERE t.screenhouse_id = s.id);

INSERT INTO sensor_data (sensor_node_id, nitrogen, phosphorus, potassium, soil_temperature, soil_moisture, soil_ph, conductivity, air_temperature, air_humidity, light_intensity, fan_status, irrigation_status, lamp_status, created_at)
SELECT sn.id, 31, 15, 21, 26.3, 66.0, 6.3, 455, 30, 61, 13200, false, true, false, NOW() - INTERVAL '12 hours'
FROM sensor_nodes sn
JOIN screenhouses s ON s.id = sn.screenhouse_id
WHERE s.name = 'Screenhouse Tegalbuleud' AND sn.node_code LIKE 'SHM11-N%'
  AND NOT EXISTS (
    SELECT 1 FROM sensor_data sd WHERE sd.sensor_node_id = sn.id AND sd.created_at >= NOW() - INTERVAL '24 hours'
  );



-- Screenhouse Cidahu

INSERT INTO screenhouses (name, province_id, regency_id, district_id, village_id, owner_user_id, address_detail, latitude, longitude, status)
SELECT 'Screenhouse Cidahu', p.id, r.id, d.id,
       (SELECT v.id FROM villages v WHERE v.district_id = d.id ORDER BY v.id LIMIT 1),
       1, 'Area perbukitan', -6.7689, 106.8521, 'active'
FROM provinces p
JOIN regencies r ON r.kode = '32.02' AND r.province_id = p.id
JOIN districts d ON d.regency_id = r.id AND lower(d.name) = lower('Cidahu')
WHERE p.kode = '32'
  AND NOT EXISTS (SELECT 1 FROM screenhouses s WHERE s.name = 'Screenhouse Cidahu');

INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
SELECT s.id, 'SHM12-N01', 'Node Utama', 'Pusat screenhouse', 60, true
FROM screenhouses s
WHERE s.name = 'Screenhouse Cidahu'
  AND NOT EXISTS (SELECT 1 FROM sensor_nodes sn WHERE sn.node_code = 'SHM12-N01');

INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
SELECT s.id, 'SHM12-N02', 'Node Timur', 'Zona timur', 60, true
FROM screenhouses s
WHERE s.name = 'Screenhouse Cidahu'
  AND NOT EXISTS (SELECT 1 FROM sensor_nodes sn WHERE sn.node_code = 'SHM12-N02');

INSERT INTO thresholds (screenhouse_id, min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus, min_potassium, max_potassium, min_soil_moisture, max_soil_moisture, min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph, min_conductivity, max_conductivity, min_air_temperature, max_air_temperature, min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity)
SELECT s.id, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000
FROM screenhouses s
WHERE s.name = 'Screenhouse Cidahu'
  AND NOT EXISTS (SELECT 1 FROM thresholds t WHERE t.screenhouse_id = s.id);

INSERT INTO sensor_data (sensor_node_id, nitrogen, phosphorus, potassium, soil_temperature, soil_moisture, soil_ph, conductivity, air_temperature, air_humidity, light_intensity, fan_status, irrigation_status, lamp_status, created_at)
SELECT sn.id, 32, 16, 16, 26.6, 67.0, 6.0, 460, 27, 62, 13400, true, true, true, NOW() - INTERVAL '1 hours'
FROM sensor_nodes sn
JOIN screenhouses s ON s.id = sn.screenhouse_id
WHERE s.name = 'Screenhouse Cidahu' AND sn.node_code LIKE 'SHM12-N%'
  AND NOT EXISTS (
    SELECT 1 FROM sensor_data sd WHERE sd.sensor_node_id = sn.id AND sd.created_at >= NOW() - INTERVAL '24 hours'
  );



-- Screenhouse Cibitung

INSERT INTO screenhouses (name, province_id, regency_id, district_id, village_id, owner_user_id, address_detail, latitude, longitude, status)
SELECT 'Screenhouse Cibitung', p.id, r.id, d.id,
       (SELECT v.id FROM villages v WHERE v.district_id = d.id ORDER BY v.id LIMIT 1),
       1, 'Samping saluran air', -6.8456, 106.7012, 'active'
FROM provinces p
JOIN regencies r ON r.kode = '32.02' AND r.province_id = p.id
JOIN districts d ON d.regency_id = r.id AND lower(d.name) = lower('Cibitung')
WHERE p.kode = '32'
  AND NOT EXISTS (SELECT 1 FROM screenhouses s WHERE s.name = 'Screenhouse Cibitung');

INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
SELECT s.id, 'SHM13-N01', 'Node Utama', 'Pusat screenhouse', 60, true
FROM screenhouses s
WHERE s.name = 'Screenhouse Cibitung'
  AND NOT EXISTS (SELECT 1 FROM sensor_nodes sn WHERE sn.node_code = 'SHM13-N01');

INSERT INTO thresholds (screenhouse_id, min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus, min_potassium, max_potassium, min_soil_moisture, max_soil_moisture, min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph, min_conductivity, max_conductivity, min_air_temperature, max_air_temperature, min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity)
SELECT s.id, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000
FROM screenhouses s
WHERE s.name = 'Screenhouse Cibitung'
  AND NOT EXISTS (SELECT 1 FROM thresholds t WHERE t.screenhouse_id = s.id);

INSERT INTO sensor_data (sensor_node_id, nitrogen, phosphorus, potassium, soil_temperature, soil_moisture, soil_ph, conductivity, air_temperature, air_humidity, light_intensity, fan_status, irrigation_status, lamp_status, created_at)
SELECT sn.id, 33, 17, 17, 26.9, 68.0, 6.1, 465, 28, 63, 13600, false, true, false, NOW() - INTERVAL '2 hours'
FROM sensor_nodes sn
JOIN screenhouses s ON s.id = sn.screenhouse_id
WHERE s.name = 'Screenhouse Cibitung' AND sn.node_code LIKE 'SHM13-N%'
  AND NOT EXISTS (
    SELECT 1 FROM sensor_data sd WHERE sd.sensor_node_id = sn.id AND sd.created_at >= NOW() - INTERVAL '24 hours'
  );



-- Screenhouse Nagrak

INSERT INTO screenhouses (name, province_id, regency_id, district_id, village_id, owner_user_id, address_detail, latitude, longitude, status)
SELECT 'Screenhouse Nagrak', p.id, r.id, d.id,
       (SELECT v.id FROM villages v WHERE v.district_id = d.id ORDER BY v.id LIMIT 1),
       1, 'Cluster petani muda', -6.7534, 106.6789, 'active'
FROM provinces p
JOIN regencies r ON r.kode = '32.02' AND r.province_id = p.id
JOIN districts d ON d.regency_id = r.id AND lower(d.name) = lower('Nagrak')
WHERE p.kode = '32'
  AND NOT EXISTS (SELECT 1 FROM screenhouses s WHERE s.name = 'Screenhouse Nagrak');

INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
SELECT s.id, 'SHM14-N01', 'Node Utama', 'Pusat screenhouse', 60, true
FROM screenhouses s
WHERE s.name = 'Screenhouse Nagrak'
  AND NOT EXISTS (SELECT 1 FROM sensor_nodes sn WHERE sn.node_code = 'SHM14-N01');

INSERT INTO thresholds (screenhouse_id, min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus, min_potassium, max_potassium, min_soil_moisture, max_soil_moisture, min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph, min_conductivity, max_conductivity, min_air_temperature, max_air_temperature, min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity)
SELECT s.id, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000
FROM screenhouses s
WHERE s.name = 'Screenhouse Nagrak'
  AND NOT EXISTS (SELECT 1 FROM thresholds t WHERE t.screenhouse_id = s.id);

INSERT INTO sensor_data (sensor_node_id, nitrogen, phosphorus, potassium, soil_temperature, soil_moisture, soil_ph, conductivity, air_temperature, air_humidity, light_intensity, fan_status, irrigation_status, lamp_status, created_at)
SELECT sn.id, 34, 18, 18, 27.2, 69.0, 6.2, 470, 29, 64, 13800, true, true, false, NOW() - INTERVAL '3 hours'
FROM sensor_nodes sn
JOIN screenhouses s ON s.id = sn.screenhouse_id
WHERE s.name = 'Screenhouse Nagrak' AND sn.node_code LIKE 'SHM14-N%'
  AND NOT EXISTS (
    SELECT 1 FROM sensor_data sd WHERE sd.sensor_node_id = sn.id AND sd.created_at >= NOW() - INTERVAL '24 hours'
  );



-- Screenhouse Sukalarang

INSERT INTO screenhouses (name, province_id, regency_id, district_id, village_id, owner_user_id, address_detail, latitude, longitude, status)
SELECT 'Screenhouse Sukalarang', p.id, r.id, d.id,
       (SELECT v.id FROM villages v WHERE v.district_id = d.id ORDER BY v.id LIMIT 1),
       1, 'Dekat UPTD cabang', -6.8756, 106.8012, 'active'
FROM provinces p
JOIN regencies r ON r.kode = '32.02' AND r.province_id = p.id
JOIN districts d ON d.regency_id = r.id AND lower(d.name) = lower('Sukalarang')
WHERE p.kode = '32'
  AND NOT EXISTS (SELECT 1 FROM screenhouses s WHERE s.name = 'Screenhouse Sukalarang');

INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
SELECT s.id, 'SHM15-N01', 'Node Utama', 'Pusat screenhouse', 60, true
FROM screenhouses s
WHERE s.name = 'Screenhouse Sukalarang'
  AND NOT EXISTS (SELECT 1 FROM sensor_nodes sn WHERE sn.node_code = 'SHM15-N01');

INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
SELECT s.id, 'SHM15-N02', 'Node Timur', 'Zona timur', 60, true
FROM screenhouses s
WHERE s.name = 'Screenhouse Sukalarang'
  AND NOT EXISTS (SELECT 1 FROM sensor_nodes sn WHERE sn.node_code = 'SHM15-N02');

INSERT INTO thresholds (screenhouse_id, min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus, min_potassium, max_potassium, min_soil_moisture, max_soil_moisture, min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph, min_conductivity, max_conductivity, min_air_temperature, max_air_temperature, min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity)
SELECT s.id, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000
FROM screenhouses s
WHERE s.name = 'Screenhouse Sukalarang'
  AND NOT EXISTS (SELECT 1 FROM thresholds t WHERE t.screenhouse_id = s.id);

INSERT INTO sensor_data (sensor_node_id, nitrogen, phosphorus, potassium, soil_temperature, soil_moisture, soil_ph, conductivity, air_temperature, air_humidity, light_intensity, fan_status, irrigation_status, lamp_status, created_at)
SELECT sn.id, 20, 19, 19, 26.0, 70.0, 6.3, 475, 30, 65, 14000, false, true, true, NOW() - INTERVAL '4 hours'
FROM sensor_nodes sn
JOIN screenhouses s ON s.id = sn.screenhouse_id
WHERE s.name = 'Screenhouse Sukalarang' AND sn.node_code LIKE 'SHM15-N%'
  AND NOT EXISTS (
    SELECT 1 FROM sensor_data sd WHERE sd.sensor_node_id = sn.id AND sd.created_at >= NOW() - INTERVAL '24 hours'
  );



-- Screenhouse Warung Kiara

INSERT INTO screenhouses (name, province_id, regency_id, district_id, village_id, owner_user_id, address_detail, latitude, longitude, status)
SELECT 'Screenhouse Warung Kiara', p.id, r.id, d.id,
       (SELECT v.id FROM villages v WHERE v.district_id = d.id ORDER BY v.id LIMIT 1),
       1, 'Lahan miring terasering', -6.8123, 106.7678, 'active'
FROM provinces p
JOIN regencies r ON r.kode = '32.02' AND r.province_id = p.id
JOIN districts d ON d.regency_id = r.id AND lower(d.name) = lower('Warungkiara')
WHERE p.kode = '32'
  AND NOT EXISTS (SELECT 1 FROM screenhouses s WHERE s.name = 'Screenhouse Warung Kiara');

INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
SELECT s.id, 'SHM16-N01', 'Node Utama', 'Pusat screenhouse', 60, true
FROM screenhouses s
WHERE s.name = 'Screenhouse Warung Kiara'
  AND NOT EXISTS (SELECT 1 FROM sensor_nodes sn WHERE sn.node_code = 'SHM16-N01');

INSERT INTO thresholds (screenhouse_id, min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus, min_potassium, max_potassium, min_soil_moisture, max_soil_moisture, min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph, min_conductivity, max_conductivity, min_air_temperature, max_air_temperature, min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity)
SELECT s.id, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000
FROM screenhouses s
WHERE s.name = 'Screenhouse Warung Kiara'
  AND NOT EXISTS (SELECT 1 FROM thresholds t WHERE t.screenhouse_id = s.id);

INSERT INTO sensor_data (sensor_node_id, nitrogen, phosphorus, potassium, soil_temperature, soil_moisture, soil_ph, conductivity, air_temperature, air_humidity, light_intensity, fan_status, irrigation_status, lamp_status, created_at)
SELECT sn.id, 21, 12, 20, 26.3, 71.0, 6.0, 480, 27, 66, 14200, true, true, false, NOW() - INTERVAL '5 hours'
FROM sensor_nodes sn
JOIN screenhouses s ON s.id = sn.screenhouse_id
WHERE s.name = 'Screenhouse Warung Kiara' AND sn.node_code LIKE 'SHM16-N%'
  AND NOT EXISTS (
    SELECT 1 FROM sensor_data sd WHERE sd.sensor_node_id = sn.id AND sd.created_at >= NOW() - INTERVAL '24 hours'
  );



-- Screenhouse Bojonggenteng

INSERT INTO screenhouses (name, province_id, regency_id, district_id, village_id, owner_user_id, address_detail, latitude, longitude, status)
SELECT 'Screenhouse Bojonggenteng', p.id, r.id, d.id,
       (SELECT v.id FROM villages v WHERE v.district_id = d.id ORDER BY v.id LIMIT 1),
       1, 'Pesisir selatan', -7.1567, 106.8123, 'active'
FROM provinces p
JOIN regencies r ON r.kode = '32.02' AND r.province_id = p.id
JOIN districts d ON d.regency_id = r.id AND lower(d.name) = lower('Bojonggenteng')
WHERE p.kode = '32'
  AND NOT EXISTS (SELECT 1 FROM screenhouses s WHERE s.name = 'Screenhouse Bojonggenteng');

INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
SELECT s.id, 'SHM17-N01', 'Node Utama', 'Pusat screenhouse', 60, true
FROM screenhouses s
WHERE s.name = 'Screenhouse Bojonggenteng'
  AND NOT EXISTS (SELECT 1 FROM sensor_nodes sn WHERE sn.node_code = 'SHM17-N01');

INSERT INTO thresholds (screenhouse_id, min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus, min_potassium, max_potassium, min_soil_moisture, max_soil_moisture, min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph, min_conductivity, max_conductivity, min_air_temperature, max_air_temperature, min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity)
SELECT s.id, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000
FROM screenhouses s
WHERE s.name = 'Screenhouse Bojonggenteng'
  AND NOT EXISTS (SELECT 1 FROM thresholds t WHERE t.screenhouse_id = s.id);

INSERT INTO sensor_data (sensor_node_id, nitrogen, phosphorus, potassium, soil_temperature, soil_moisture, soil_ph, conductivity, air_temperature, air_humidity, light_intensity, fan_status, irrigation_status, lamp_status, created_at)
SELECT sn.id, 22, 13, 21, 26.6, 72.0, 6.1, 485, 28, 67, 14400, false, true, false, NOW() - INTERVAL '6 hours'
FROM sensor_nodes sn
JOIN screenhouses s ON s.id = sn.screenhouse_id
WHERE s.name = 'Screenhouse Bojonggenteng' AND sn.node_code LIKE 'SHM17-N%'
  AND NOT EXISTS (
    SELECT 1 FROM sensor_data sd WHERE sd.sensor_node_id = sn.id AND sd.created_at >= NOW() - INTERVAL '24 hours'
  );



-- Screenhouse Ciemas

INSERT INTO screenhouses (name, province_id, regency_id, district_id, village_id, owner_user_id, address_detail, latitude, longitude, status)
SELECT 'Screenhouse Ciemas', p.id, r.id, d.id,
       (SELECT v.id FROM villages v WHERE v.district_id = d.id ORDER BY v.id LIMIT 1),
       1, 'Zona pantai Ciemas', -7.2345, 106.5123, 'active'
FROM provinces p
JOIN regencies r ON r.kode = '32.02' AND r.province_id = p.id
JOIN districts d ON d.regency_id = r.id AND lower(d.name) = lower('Ciemas')
WHERE p.kode = '32'
  AND NOT EXISTS (SELECT 1 FROM screenhouses s WHERE s.name = 'Screenhouse Ciemas');

INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
SELECT s.id, 'SHM18-N01', 'Node Utama', 'Pusat screenhouse', 60, true
FROM screenhouses s
WHERE s.name = 'Screenhouse Ciemas'
  AND NOT EXISTS (SELECT 1 FROM sensor_nodes sn WHERE sn.node_code = 'SHM18-N01');

INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
SELECT s.id, 'SHM18-N02', 'Node Timur', 'Zona timur', 60, true
FROM screenhouses s
WHERE s.name = 'Screenhouse Ciemas'
  AND NOT EXISTS (SELECT 1 FROM sensor_nodes sn WHERE sn.node_code = 'SHM18-N02');

INSERT INTO thresholds (screenhouse_id, min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus, min_potassium, max_potassium, min_soil_moisture, max_soil_moisture, min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph, min_conductivity, max_conductivity, min_air_temperature, max_air_temperature, min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity)
SELECT s.id, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000
FROM screenhouses s
WHERE s.name = 'Screenhouse Ciemas'
  AND NOT EXISTS (SELECT 1 FROM thresholds t WHERE t.screenhouse_id = s.id);

INSERT INTO sensor_data (sensor_node_id, nitrogen, phosphorus, potassium, soil_temperature, soil_moisture, soil_ph, conductivity, air_temperature, air_humidity, light_intensity, fan_status, irrigation_status, lamp_status, created_at)
SELECT sn.id, 23, 14, 16, 26.9, 73.0, 6.2, 490, 29, 68, 14600, true, true, true, NOW() - INTERVAL '7 hours'
FROM sensor_nodes sn
JOIN screenhouses s ON s.id = sn.screenhouse_id
WHERE s.name = 'Screenhouse Ciemas' AND sn.node_code LIKE 'SHM18-N%'
  AND NOT EXISTS (
    SELECT 1 FROM sensor_data sd WHERE sd.sensor_node_id = sn.id AND sd.created_at >= NOW() - INTERVAL '24 hours'
  );



-- Screenhouse Kalapanunggal

INSERT INTO screenhouses (name, province_id, regency_id, district_id, village_id, owner_user_id, address_detail, latitude, longitude, status)
SELECT 'Screenhouse Kalapanunggal', p.id, r.id, d.id,
       (SELECT v.id FROM villages v WHERE v.district_id = d.id ORDER BY v.id LIMIT 1),
       1, 'Trans Cibadak', -6.7689, 106.6234, 'active'
FROM provinces p
JOIN regencies r ON r.kode = '32.02' AND r.province_id = p.id
JOIN districts d ON d.regency_id = r.id AND lower(d.name) = lower('Kalapanunggal')
WHERE p.kode = '32'
  AND NOT EXISTS (SELECT 1 FROM screenhouses s WHERE s.name = 'Screenhouse Kalapanunggal');

INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
SELECT s.id, 'SHM19-N01', 'Node Utama', 'Pusat screenhouse', 60, true
FROM screenhouses s
WHERE s.name = 'Screenhouse Kalapanunggal'
  AND NOT EXISTS (SELECT 1 FROM sensor_nodes sn WHERE sn.node_code = 'SHM19-N01');

INSERT INTO thresholds (screenhouse_id, min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus, min_potassium, max_potassium, min_soil_moisture, max_soil_moisture, min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph, min_conductivity, max_conductivity, min_air_temperature, max_air_temperature, min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity)
SELECT s.id, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000
FROM screenhouses s
WHERE s.name = 'Screenhouse Kalapanunggal'
  AND NOT EXISTS (SELECT 1 FROM thresholds t WHERE t.screenhouse_id = s.id);

INSERT INTO sensor_data (sensor_node_id, nitrogen, phosphorus, potassium, soil_temperature, soil_moisture, soil_ph, conductivity, air_temperature, air_humidity, light_intensity, fan_status, irrigation_status, lamp_status, created_at)
SELECT sn.id, 24, 15, 17, 27.2, 74.0, 6.3, 495, 30, 69, 14800, false, true, false, NOW() - INTERVAL '8 hours'
FROM sensor_nodes sn
JOIN screenhouses s ON s.id = sn.screenhouse_id
WHERE s.name = 'Screenhouse Kalapanunggal' AND sn.node_code LIKE 'SHM19-N%'
  AND NOT EXISTS (
    SELECT 1 FROM sensor_data sd WHERE sd.sensor_node_id = sn.id AND sd.created_at >= NOW() - INTERVAL '24 hours'
  );



-- Screenhouse Gegerbitung

INSERT INTO screenhouses (name, province_id, regency_id, district_id, village_id, owner_user_id, address_detail, latitude, longitude, status)
SELECT 'Screenhouse Gegerbitung', p.id, r.id, d.id,
       (SELECT v.id FROM villages v WHERE v.district_id = d.id ORDER BY v.id LIMIT 1),
       1, 'Pusat pembibitan desa', -6.9234, 106.6789, 'active'
FROM provinces p
JOIN regencies r ON r.kode = '32.02' AND r.province_id = p.id
JOIN districts d ON d.regency_id = r.id AND lower(d.name) = lower('Gegerbitung')
WHERE p.kode = '32'
  AND NOT EXISTS (SELECT 1 FROM screenhouses s WHERE s.name = 'Screenhouse Gegerbitung');

INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
SELECT s.id, 'SHM20-N01', 'Node Utama', 'Pusat screenhouse', 60, true
FROM screenhouses s
WHERE s.name = 'Screenhouse Gegerbitung'
  AND NOT EXISTS (SELECT 1 FROM sensor_nodes sn WHERE sn.node_code = 'SHM20-N01');

INSERT INTO thresholds (screenhouse_id, min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus, min_potassium, max_potassium, min_soil_moisture, max_soil_moisture, min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph, min_conductivity, max_conductivity, min_air_temperature, max_air_temperature, min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity)
SELECT s.id, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000
FROM screenhouses s
WHERE s.name = 'Screenhouse Gegerbitung'
  AND NOT EXISTS (SELECT 1 FROM thresholds t WHERE t.screenhouse_id = s.id);

INSERT INTO sensor_data (sensor_node_id, nitrogen, phosphorus, potassium, soil_temperature, soil_moisture, soil_ph, conductivity, air_temperature, air_humidity, light_intensity, fan_status, irrigation_status, lamp_status, created_at)
SELECT sn.id, 25, 16, 18, 26.0, 55.0, 6.0, 500, 27, 60, 15000, true, true, false, NOW() - INTERVAL '9 hours'
FROM sensor_nodes sn
JOIN screenhouses s ON s.id = sn.screenhouse_id
WHERE s.name = 'Screenhouse Gegerbitung' AND sn.node_code LIKE 'SHM20-N%'
  AND NOT EXISTS (
    SELECT 1 FROM sensor_data sd WHERE sd.sensor_node_id = sn.id AND sd.created_at >= NOW() - INTERVAL '24 hours'
  );



-- Screenhouse Caringin

INSERT INTO screenhouses (name, province_id, regency_id, district_id, village_id, owner_user_id, address_detail, latitude, longitude, status)
SELECT 'Screenhouse Caringin', p.id, r.id, d.id,
       (SELECT v.id FROM villages v WHERE v.district_id = d.id ORDER BY v.id LIMIT 1),
       1, 'Lahan sayur dataran', -6.8412, 106.7612, 'active'
FROM provinces p
JOIN regencies r ON r.kode = '32.02' AND r.province_id = p.id
JOIN districts d ON d.regency_id = r.id AND lower(d.name) = lower('Caringin')
WHERE p.kode = '32'
  AND NOT EXISTS (SELECT 1 FROM screenhouses s WHERE s.name = 'Screenhouse Caringin');

INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
SELECT s.id, 'SHM21-N01', 'Node Utama', 'Pusat screenhouse', 60, true
FROM screenhouses s WHERE s.name = 'Screenhouse Caringin'
  AND NOT EXISTS (SELECT 1 FROM sensor_nodes sn WHERE sn.node_code = 'SHM21-N01');

INSERT INTO thresholds (screenhouse_id, min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus, min_potassium, max_potassium, min_soil_moisture, max_soil_moisture, min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph, min_conductivity, max_conductivity, min_air_temperature, max_air_temperature, min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity)
SELECT s.id, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000
FROM screenhouses s WHERE s.name = 'Screenhouse Caringin'
  AND NOT EXISTS (SELECT 1 FROM thresholds t WHERE t.screenhouse_id = s.id);

INSERT INTO sensor_data (sensor_node_id, nitrogen, phosphorus, potassium, soil_temperature, soil_moisture, soil_ph, conductivity, air_temperature, air_humidity, light_intensity, fan_status, irrigation_status, lamp_status, created_at)
SELECT sn.id, 23, 14, 19, 26.8, 68.0, 6.1, 460, 28, 65, 13500, true, true, false, NOW() - INTERVAL '3 hours'
FROM sensor_nodes sn JOIN screenhouses s ON s.id = sn.screenhouse_id
WHERE s.name = 'Screenhouse Caringin' AND sn.node_code LIKE 'SHM21-N%'
  AND NOT EXISTS (SELECT 1 FROM sensor_data sd WHERE sd.sensor_node_id = sn.id AND sd.created_at >= NOW() - INTERVAL '24 hours');



-- Screenhouse Ciracap

INSERT INTO screenhouses (name, province_id, regency_id, district_id, village_id, owner_user_id, address_detail, latitude, longitude, status)
SELECT 'Screenhouse Ciracap', p.id, r.id, d.id,
       (SELECT v.id FROM villages v WHERE v.district_id = d.id ORDER BY v.id LIMIT 1),
       1, 'Pesisir selatan Ciracap', -7.1023, 106.4812, 'active'
FROM provinces p
JOIN regencies r ON r.kode = '32.02' AND r.province_id = p.id
JOIN districts d ON d.regency_id = r.id AND lower(d.name) = lower('Ciracap')
WHERE p.kode = '32'
  AND NOT EXISTS (SELECT 1 FROM screenhouses s WHERE s.name = 'Screenhouse Ciracap');

INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
SELECT s.id, 'SHM22-N01', 'Node Utama', 'Pusat screenhouse', 60, true
FROM screenhouses s WHERE s.name = 'Screenhouse Ciracap'
  AND NOT EXISTS (SELECT 1 FROM sensor_nodes sn WHERE sn.node_code = 'SHM22-N01');

INSERT INTO thresholds (screenhouse_id, min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus, min_potassium, max_potassium, min_soil_moisture, max_soil_moisture, min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph, min_conductivity, max_conductivity, min_air_temperature, max_air_temperature, min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity)
SELECT s.id, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000
FROM screenhouses s WHERE s.name = 'Screenhouse Ciracap'
  AND NOT EXISTS (SELECT 1 FROM thresholds t WHERE t.screenhouse_id = s.id);

INSERT INTO sensor_data (sensor_node_id, nitrogen, phosphorus, potassium, soil_temperature, soil_moisture, soil_ph, conductivity, air_temperature, air_humidity, light_intensity, fan_status, irrigation_status, lamp_status, created_at)
SELECT sn.id, 20, 11, 17, 25.5, 75.0, 6.2, 410, 29, 72, 9800, false, true, false, NOW() - INTERVAL '4 hours'
FROM sensor_nodes sn JOIN screenhouses s ON s.id = sn.screenhouse_id
WHERE s.name = 'Screenhouse Ciracap' AND sn.node_code LIKE 'SHM22-N%'
  AND NOT EXISTS (SELECT 1 FROM sensor_data sd WHERE sd.sensor_node_id = sn.id AND sd.created_at >= NOW() - INTERVAL '24 hours');



-- Screenhouse Gunungguruh

INSERT INTO screenhouses (name, province_id, regency_id, district_id, village_id, owner_user_id, address_detail, latitude, longitude, status)
SELECT 'Screenhouse Gunungguruh', p.id, r.id, d.id,
       (SELECT v.id FROM villages v WHERE v.district_id = d.id ORDER BY v.id LIMIT 1),
       1, 'Dekat perkebunan teh', -6.9912, 106.6234, 'active'
FROM provinces p
JOIN regencies r ON r.kode = '32.02' AND r.province_id = p.id
JOIN districts d ON d.regency_id = r.id AND lower(d.name) = lower('Gunungguruh')
WHERE p.kode = '32'
  AND NOT EXISTS (SELECT 1 FROM screenhouses s WHERE s.name = 'Screenhouse Gunungguruh');

INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
SELECT s.id, 'SHM23-N01', 'Node Utama', 'Pusat screenhouse', 60, true
FROM screenhouses s WHERE s.name = 'Screenhouse Gunungguruh'
  AND NOT EXISTS (SELECT 1 FROM sensor_nodes sn WHERE sn.node_code = 'SHM23-N01');

INSERT INTO thresholds (screenhouse_id, min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus, min_potassium, max_potassium, min_soil_moisture, max_soil_moisture, min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph, min_conductivity, max_conductivity, min_air_temperature, max_air_temperature, min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity)
SELECT s.id, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000
FROM screenhouses s WHERE s.name = 'Screenhouse Gunungguruh'
  AND NOT EXISTS (SELECT 1 FROM thresholds t WHERE t.screenhouse_id = s.id);

INSERT INTO sensor_data (sensor_node_id, nitrogen, phosphorus, potassium, soil_temperature, soil_moisture, soil_ph, conductivity, air_temperature, air_humidity, light_intensity, fan_status, irrigation_status, lamp_status, created_at)
SELECT sn.id, 26, 15, 22, 24.8, 62.0, 5.9, 520, 25, 58, 11200, true, false, false, NOW() - INTERVAL '2 hours'
FROM sensor_nodes sn JOIN screenhouses s ON s.id = sn.screenhouse_id
WHERE s.name = 'Screenhouse Gunungguruh' AND sn.node_code LIKE 'SHM23-N%'
  AND NOT EXISTS (SELECT 1 FROM sensor_data sd WHERE sd.sensor_node_id = sn.id AND sd.created_at >= NOW() - INTERVAL '24 hours');



-- Screenhouse Cisaat

INSERT INTO screenhouses (name, province_id, regency_id, district_id, village_id, owner_user_id, address_detail, latitude, longitude, status)
SELECT 'Screenhouse Cisaat', p.id, r.id, d.id,
       (SELECT v.id FROM villages v WHERE v.district_id = d.id ORDER BY v.id LIMIT 1),
       1, 'Jalur nasional Cisaat', -6.9312, 106.8812, 'active'
FROM provinces p
JOIN regencies r ON r.kode = '32.02' AND r.province_id = p.id
JOIN districts d ON d.regency_id = r.id AND lower(d.name) = lower('Cisaat')
WHERE p.kode = '32'
  AND NOT EXISTS (SELECT 1 FROM screenhouses s WHERE s.name = 'Screenhouse Cisaat');

INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
SELECT s.id, 'SHM24-N01', 'Node Utama', 'Pusat screenhouse', 60, true
FROM screenhouses s WHERE s.name = 'Screenhouse Cisaat'
  AND NOT EXISTS (SELECT 1 FROM sensor_nodes sn WHERE sn.node_code = 'SHM24-N01');

INSERT INTO thresholds (screenhouse_id, min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus, min_potassium, max_potassium, min_soil_moisture, max_soil_moisture, min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph, min_conductivity, max_conductivity, min_air_temperature, max_air_temperature, min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity)
SELECT s.id, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000
FROM screenhouses s WHERE s.name = 'Screenhouse Cisaat'
  AND NOT EXISTS (SELECT 1 FROM thresholds t WHERE t.screenhouse_id = s.id);

INSERT INTO sensor_data (sensor_node_id, nitrogen, phosphorus, potassium, soil_temperature, soil_moisture, soil_ph, conductivity, air_temperature, air_humidity, light_intensity, fan_status, irrigation_status, lamp_status, created_at)
SELECT sn.id, 22, 13, 18, 27.0, 58.0, 6.0, 445, 28, 62, 12800, true, true, false, NOW() - INTERVAL '6 hours'
FROM sensor_nodes sn JOIN screenhouses s ON s.id = sn.screenhouse_id
WHERE s.name = 'Screenhouse Cisaat' AND sn.node_code LIKE 'SHM24-N%'
  AND NOT EXISTS (SELECT 1 FROM sensor_data sd WHERE sd.sensor_node_id = sn.id AND sd.created_at >= NOW() - INTERVAL '24 hours');



-- Screenhouse Cimanggu

INSERT INTO screenhouses (name, province_id, regency_id, district_id, village_id, owner_user_id, address_detail, latitude, longitude, status)
SELECT 'Screenhouse Cimanggu', p.id, r.id, d.id,
       (SELECT v.id FROM villages v WHERE v.district_id = d.id ORDER BY v.id LIMIT 1),
       1, 'Sentra hortikultura', -6.8812, 106.7612, 'active'
FROM provinces p
JOIN regencies r ON r.kode = '32.02' AND r.province_id = p.id
JOIN districts d ON d.regency_id = r.id AND lower(d.name) = lower('Cimanggu')
WHERE p.kode = '32'
  AND NOT EXISTS (SELECT 1 FROM screenhouses s WHERE s.name = 'Screenhouse Cimanggu');

INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
SELECT s.id, 'SHM25-N01', 'Node Utama', 'Pusat screenhouse', 60, true
FROM screenhouses s WHERE s.name = 'Screenhouse Cimanggu'
  AND NOT EXISTS (SELECT 1 FROM sensor_nodes sn WHERE sn.node_code = 'SHM25-N01');

INSERT INTO thresholds (screenhouse_id, min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus, min_potassium, max_potassium, min_soil_moisture, max_soil_moisture, min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph, min_conductivity, max_conductivity, min_air_temperature, max_air_temperature, min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity)
SELECT s.id, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000
FROM screenhouses s WHERE s.name = 'Screenhouse Cimanggu'
  AND NOT EXISTS (SELECT 1 FROM thresholds t WHERE t.screenhouse_id = s.id);

INSERT INTO sensor_data (sensor_node_id, nitrogen, phosphorus, potassium, soil_temperature, soil_moisture, soil_ph, conductivity, air_temperature, air_humidity, light_intensity, fan_status, irrigation_status, lamp_status, created_at)
SELECT sn.id, 27, 17, 21, 26.5, 64.0, 6.2, 470, 27, 63, 14100, true, true, false, NOW() - INTERVAL '7 hours'
FROM sensor_nodes sn JOIN screenhouses s ON s.id = sn.screenhouse_id
WHERE s.name = 'Screenhouse Cimanggu' AND sn.node_code LIKE 'SHM25-N%'
  AND NOT EXISTS (SELECT 1 FROM sensor_data sd WHERE sd.sensor_node_id = sn.id AND sd.created_at >= NOW() - INTERVAL '24 hours');



-- Screenhouse Cidadap

INSERT INTO screenhouses (name, province_id, regency_id, district_id, village_id, owner_user_id, address_detail, latitude, longitude, status)
SELECT 'Screenhouse Cidadap', p.id, r.id, d.id,
       (SELECT v.id FROM villages v WHERE v.district_id = d.id ORDER BY v.id LIMIT 1),
       1, 'Lahan pesisir Cidadap', -7.0812, 106.5512, 'active'
FROM provinces p
JOIN regencies r ON r.kode = '32.02' AND r.province_id = p.id
JOIN districts d ON d.regency_id = r.id AND lower(d.name) = lower('Cidadap')
WHERE p.kode = '32'
  AND NOT EXISTS (SELECT 1 FROM screenhouses s WHERE s.name = 'Screenhouse Cidadap');

INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
SELECT s.id, 'SHM26-N01', 'Node Utama', 'Pusat screenhouse', 60, true
FROM screenhouses s WHERE s.name = 'Screenhouse Cidadap'
  AND NOT EXISTS (SELECT 1 FROM sensor_nodes sn WHERE sn.node_code = 'SHM26-N01');

INSERT INTO thresholds (screenhouse_id, min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus, min_potassium, max_potassium, min_soil_moisture, max_soil_moisture, min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph, min_conductivity, max_conductivity, min_air_temperature, max_air_temperature, min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity)
SELECT s.id, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000
FROM screenhouses s WHERE s.name = 'Screenhouse Cidadap'
  AND NOT EXISTS (SELECT 1 FROM thresholds t WHERE t.screenhouse_id = s.id);

INSERT INTO sensor_data (sensor_node_id, nitrogen, phosphorus, potassium, soil_temperature, soil_moisture, soil_ph, conductivity, air_temperature, air_humidity, light_intensity, fan_status, irrigation_status, lamp_status, created_at)
SELECT sn.id, 19, 10, 16, 25.8, 78.0, 6.3, 390, 29, 74, 9200, false, true, false, NOW() - INTERVAL '5 hours'
FROM sensor_nodes sn JOIN screenhouses s ON s.id = sn.screenhouse_id
WHERE s.name = 'Screenhouse Cidadap' AND sn.node_code LIKE 'SHM26-N%'
  AND NOT EXISTS (SELECT 1 FROM sensor_data sd WHERE sd.sensor_node_id = sn.id AND sd.created_at >= NOW() - INTERVAL '24 hours');



-- Screenhouse Jampang Kulon

INSERT INTO screenhouses (name, province_id, regency_id, district_id, village_id, owner_user_id, address_detail, latitude, longitude, status)
SELECT 'Screenhouse Jampang Kulon', p.id, r.id, d.id,
       (SELECT v.id FROM villages v WHERE v.district_id = d.id ORDER BY v.id LIMIT 1),
       1, 'Zona selatan Jampang', -7.1812, 106.5812, 'active'
FROM provinces p
JOIN regencies r ON r.kode = '32.02' AND r.province_id = p.id
JOIN districts d ON d.regency_id = r.id AND lower(d.name) = lower('Jampangkulon')
WHERE p.kode = '32'
  AND NOT EXISTS (SELECT 1 FROM screenhouses s WHERE s.name = 'Screenhouse Jampang Kulon');

INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
SELECT s.id, 'SHM27-N01', 'Node Utama', 'Pusat screenhouse', 60, true
FROM screenhouses s WHERE s.name = 'Screenhouse Jampang Kulon'
  AND NOT EXISTS (SELECT 1 FROM sensor_nodes sn WHERE sn.node_code = 'SHM27-N01');

INSERT INTO thresholds (screenhouse_id, min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus, min_potassium, max_potassium, min_soil_moisture, max_soil_moisture, min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph, min_conductivity, max_conductivity, min_air_temperature, max_air_temperature, min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity)
SELECT s.id, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000
FROM screenhouses s WHERE s.name = 'Screenhouse Jampang Kulon'
  AND NOT EXISTS (SELECT 1 FROM thresholds t WHERE t.screenhouse_id = s.id);

INSERT INTO sensor_data (sensor_node_id, nitrogen, phosphorus, potassium, soil_temperature, soil_moisture, soil_ph, conductivity, air_temperature, air_humidity, light_intensity, fan_status, irrigation_status, lamp_status, created_at)
SELECT sn.id, 21, 12, 18, 26.2, 70.0, 6.0, 430, 28, 68, 10500, false, true, false, NOW() - INTERVAL '8 hours'
FROM sensor_nodes sn JOIN screenhouses s ON s.id = sn.screenhouse_id
WHERE s.name = 'Screenhouse Jampang Kulon' AND sn.node_code LIKE 'SHM27-N%'
  AND NOT EXISTS (SELECT 1 FROM sensor_data sd WHERE sd.sensor_node_id = sn.id AND sd.created_at >= NOW() - INTERVAL '24 hours');



-- Screenhouse Sagaranten

INSERT INTO screenhouses (name, province_id, regency_id, district_id, village_id, owner_user_id, address_detail, latitude, longitude, status)
SELECT 'Screenhouse Sagaranten', p.id, r.id, d.id,
       (SELECT v.id FROM villages v WHERE v.district_id = d.id ORDER BY v.id LIMIT 1),
       1, 'Perkebunan Sagaranten', -7.0512, 106.6812, 'active'
FROM provinces p
JOIN regencies r ON r.kode = '32.02' AND r.province_id = p.id
JOIN districts d ON d.regency_id = r.id AND lower(d.name) = lower('Sagaranten')
WHERE p.kode = '32'
  AND NOT EXISTS (SELECT 1 FROM screenhouses s WHERE s.name = 'Screenhouse Sagaranten');

INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
SELECT s.id, 'SHM28-N01', 'Node Utama', 'Pusat screenhouse', 60, true
FROM screenhouses s WHERE s.name = 'Screenhouse Sagaranten'
  AND NOT EXISTS (SELECT 1 FROM sensor_nodes sn WHERE sn.node_code = 'SHM28-N01');

INSERT INTO thresholds (screenhouse_id, min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus, min_potassium, max_potassium, min_soil_moisture, max_soil_moisture, min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph, min_conductivity, max_conductivity, min_air_temperature, max_air_temperature, min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity)
SELECT s.id, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000
FROM screenhouses s WHERE s.name = 'Screenhouse Sagaranten'
  AND NOT EXISTS (SELECT 1 FROM thresholds t WHERE t.screenhouse_id = s.id);

INSERT INTO sensor_data (sensor_node_id, nitrogen, phosphorus, potassium, soil_temperature, soil_moisture, soil_ph, conductivity, air_temperature, air_humidity, light_intensity, fan_status, irrigation_status, lamp_status, created_at)
SELECT sn.id, 24, 14, 20, 26.9, 66.0, 6.1, 455, 27, 64, 13200, true, true, false, NOW() - INTERVAL '4 hours'
FROM sensor_nodes sn JOIN screenhouses s ON s.id = sn.screenhouse_id
WHERE s.name = 'Screenhouse Sagaranten' AND sn.node_code LIKE 'SHM28-N%'
  AND NOT EXISTS (SELECT 1 FROM sensor_data sd WHERE sd.sensor_node_id = sn.id AND sd.created_at >= NOW() - INTERVAL '24 hours');



-- Screenhouse Waluran

INSERT INTO screenhouses (name, province_id, regency_id, district_id, village_id, owner_user_id, address_detail, latitude, longitude, status)
SELECT 'Screenhouse Waluran', p.id, r.id, d.id,
       (SELECT v.id FROM villages v WHERE v.district_id = d.id ORDER BY v.id LIMIT 1),
       1, 'Dataran Waluran', -6.9612, 106.7012, 'active'
FROM provinces p
JOIN regencies r ON r.kode = '32.02' AND r.province_id = p.id
JOIN districts d ON d.regency_id = r.id AND lower(d.name) = lower('Waluran')
WHERE p.kode = '32'
  AND NOT EXISTS (SELECT 1 FROM screenhouses s WHERE s.name = 'Screenhouse Waluran');

INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
SELECT s.id, 'SHM29-N01', 'Node Utama', 'Pusat screenhouse', 60, true
FROM screenhouses s WHERE s.name = 'Screenhouse Waluran'
  AND NOT EXISTS (SELECT 1 FROM sensor_nodes sn WHERE sn.node_code = 'SHM29-N01');

INSERT INTO thresholds (screenhouse_id, min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus, min_potassium, max_potassium, min_soil_moisture, max_soil_moisture, min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph, min_conductivity, max_conductivity, min_air_temperature, max_air_temperature, min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity)
SELECT s.id, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000
FROM screenhouses s WHERE s.name = 'Screenhouse Waluran'
  AND NOT EXISTS (SELECT 1 FROM thresholds t WHERE t.screenhouse_id = s.id);

INSERT INTO sensor_data (sensor_node_id, nitrogen, phosphorus, potassium, soil_temperature, soil_moisture, soil_ph, conductivity, air_temperature, air_humidity, light_intensity, fan_status, irrigation_status, lamp_status, created_at)
SELECT sn.id, 23, 15, 19, 27.1, 61.0, 6.0, 490, 28, 61, 14600, true, false, false, NOW() - INTERVAL '3 hours'
FROM sensor_nodes sn JOIN screenhouses s ON s.id = sn.screenhouse_id
WHERE s.name = 'Screenhouse Waluran' AND sn.node_code LIKE 'SHM29-N%'
  AND NOT EXISTS (SELECT 1 FROM sensor_data sd WHERE sd.sensor_node_id = sn.id AND sd.created_at >= NOW() - INTERVAL '24 hours');



-- Screenhouse Kabandungan

INSERT INTO screenhouses (name, province_id, regency_id, district_id, village_id, owner_user_id, address_detail, latitude, longitude, status)
SELECT 'Screenhouse Kabandungan', p.id, r.id, d.id,
       (SELECT v.id FROM villages v WHERE v.district_id = d.id ORDER BY v.id LIMIT 1),
       1, 'Hulu sungai Kabandungan', -6.9812, 106.7812, 'active'
FROM provinces p
JOIN regencies r ON r.kode = '32.02' AND r.province_id = p.id
JOIN districts d ON d.regency_id = r.id AND lower(d.name) = lower('Kabandungan')
WHERE p.kode = '32'
  AND NOT EXISTS (SELECT 1 FROM screenhouses s WHERE s.name = 'Screenhouse Kabandungan');

INSERT INTO sensor_nodes (screenhouse_id, node_code, node_name, location, send_interval_seconds, is_active)
SELECT s.id, 'SHM30-N01', 'Node Utama', 'Pusat screenhouse', 60, true
FROM screenhouses s WHERE s.name = 'Screenhouse Kabandungan'
  AND NOT EXISTS (SELECT 1 FROM sensor_nodes sn WHERE sn.node_code = 'SHM30-N01');

INSERT INTO thresholds (screenhouse_id, min_nitrogen, max_nitrogen, min_phosphorus, max_phosphorus, min_potassium, max_potassium, min_soil_moisture, max_soil_moisture, min_soil_temperature, max_soil_temperature, min_soil_ph, max_soil_ph, min_conductivity, max_conductivity, min_air_temperature, max_air_temperature, min_air_humidity, max_air_humidity, min_light_intensity, max_light_intensity)
SELECT s.id, 20, 45, 10, 30, 15, 50, 50, 80, 20, 35, 5.5, 7.0, 200, 800, 22, 35, 40, 85, 5000, 50000
FROM screenhouses s WHERE s.name = 'Screenhouse Kabandungan'
  AND NOT EXISTS (SELECT 1 FROM thresholds t WHERE t.screenhouse_id = s.id);

INSERT INTO sensor_data (sensor_node_id, nitrogen, phosphorus, potassium, soil_temperature, soil_moisture, soil_ph, conductivity, air_temperature, air_humidity, light_intensity, fan_status, irrigation_status, lamp_status, created_at)
SELECT sn.id, 25, 16, 22, 25.2, 57.0, 5.8, 510, 26, 59, 10900, true, true, false, NOW() - INTERVAL '9 hours'
FROM sensor_nodes sn JOIN screenhouses s ON s.id = sn.screenhouse_id
WHERE s.name = 'Screenhouse Kabandungan' AND sn.node_code LIKE 'SHM30-N%'
  AND NOT EXISTS (SELECT 1 FROM sensor_data sd WHERE sd.sensor_node_id = sn.id AND sd.created_at >= NOW() - INTERVAL '24 hours');





