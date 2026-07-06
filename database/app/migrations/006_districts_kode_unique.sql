-- districts.kode UNIQUE (selaras dengan schema.sql; DB lama mungkin belum punya)
ALTER TABLE districts ADD CONSTRAINT districts_kode_key UNIQUE (kode);
