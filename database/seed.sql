-- =========================================
-- SCREENHOUSE MONITORING SYSTEM
-- SEED DATA
-- =========================================

-- =========================================
-- PROVINCES
-- =========================================

INSERT INTO provinces (id, name)
VALUES
(1, 'Jawa Barat');

-- =========================================
-- REGENCIES
-- =========================================

INSERT INTO regencies (
    id,
    province_id,
    name
)
VALUES
(1, 1, 'Sukabumi');

-- =========================================
-- DISTRICTS
-- =========================================

INSERT INTO districts (
    id,
    regency_id,
    name
)
VALUES
(1, 1, 'Cisaat'),
(2, 1, 'Kadudampit');

-- =========================================
-- VILLAGES
-- =========================================

INSERT INTO villages (
    id,
    district_id,
    name
)
VALUES
(1, 1, 'Babakan'),
(2, 1, 'Sukamanah'),
(3, 2, 'Gedepangrango');

-- =========================================
-- USERS
-- Password semua:
-- 123456
-- =========================================

INSERT INTO users (
    id,
    name,
    phone_number,
    password,
    role,
    status
)
VALUES
(
    1,
    'Pak Eko',
    '081111111111',
    '$2b$10$8U9Qh9M0jV4Q8Q5Y7M6YQeM7F4vXnG2JjQ9Lw1J2A0f2mW5zQz8vW',
    'petani',
    'approved'
),
(
    2,
    'Operator MCtan',
    '089999999999',
    '$2b$10$8U9Qh9M0jV4Q8Q5Y7M6YQeM7F4vXnG2JjQ9Lw1J2A0f2mW5zQz8vW',
    'operator',
    'approved'
),
(
    3,
    'Super Admin',
    '088888888888',
    '$2b$10$8U9Qh9M0jV4Q8Q5Y7M6YQeM7F4vXnG2JjQ9Lw1J2A0f2mW5zQz8vW',
    'super_admin',
    'approved'
);

-- =========================================
-- SCREENHOUSES
-- =========================================

INSERT INTO screenhouses (
    id,
    name,
    province_id,
    regency_id,
    district_id,
    village_id,
    owner_user_id,
    address_detail,
    latitude,
    longitude,
    status
)
VALUES
(
    1,
    'Screenhouse Sukabumi 01',
    1,
    1,
    1,
    1,
    1,
    'Dekat irigasi timur',
    -6.9175,
    106.9287,
    'active'
),
(
    2,
    'Screenhouse Sukabumi 02',
    1,
    1,
    1,
    2,
    1,
    'Area pembibitan selatan',
    -6.9200,
    106.9310,
    'active'
),
(
    3,
    'Screenhouse Kadudampit 01',
    1,
    1,
    2,
    3,
    1,
    'Dekat jalan desa',
    -6.8900,
    106.9500,
    'active'
);

-- =========================================
-- SENSORS
-- =========================================

INSERT INTO sensors (
    id,
    screenhouse_id,
    name,
    status
)
VALUES
(1, 1, 'WSN-SH-001', 'online'),
(2, 1, 'WSN-SH-002', 'online'),
(3, 2, 'WSN-SH-003', 'online'),
(4, 3, 'WSN-SH-004', 'offline');

-- =========================================
-- SENSOR DATA
-- =========================================

INSERT INTO sensor_data (
    id,
    screenhouse_id,
    nitrogen,
    phosphorus,
    potassium,
    moisture
)
VALUES
(
    1,
    1,
    25,
    15,
    18,
    70
),
(
    2,
    1,
    18,
    14,
    17,
    55
),
(
    3,
    2,
    22,
    16,
    19,
    68
);

-- =========================================
-- THRESHOLDS
-- =========================================

INSERT INTO thresholds (
    id,
    screenhouse_id,
    min_nitrogen,
    min_moisture
)
VALUES
(
    1,
    1,
    20,
    60
),
(
    2,
    2,
    20,
    60
),
(
    3,
    3,
    20,
    60
);

-- =========================================
-- ALERTS
-- =========================================

INSERT INTO alerts (
    id,
    sensor_data_id,
    screenhouse_id,
    message,
    status
)
VALUES
(
    1,
    2,
    1,
    'Nitrogen di bawah batas minimum',
    'active'
),
(
    2,
    2,
    1,
    'Kelembaban di bawah batas minimum',
    'active'
);