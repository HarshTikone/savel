CREATE TABLE IF NOT EXISTS homes (
  id text PRIMARY KEY,
  block text,
  lat float,
  lon float,
  age_band text,
  medical_needs text,
  language text,
  phone text,
  battery bool
);

CREATE TABLE IF NOT EXISTS readings (
  time timestamptz NOT NULL,
  home_id text,
  temp_f float,
  co_ppm float,
  power_on bool
);
SELECT create_hypertable('readings', by_range('time'), if_not_exists => TRUE);

CREATE TABLE IF NOT EXISTS calls (
  id serial,
  home_id text,
  started_at timestamptz,
  status text,
  transcript text,
  extracted jsonb,
  outcome text
);
