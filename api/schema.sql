CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS homes (
  id            text PRIMARY KEY,
  block         text NOT NULL,
  lat           double precision NOT NULL,
  lon           double precision NOT NULL,
  age_band      text,
  medical_needs text NOT NULL DEFAULT '',   -- comma-separated, e.g. 'oxygen,mobility'
  language      text NOT NULL DEFAULT 'en',
  phone         text,
  battery       boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS readings (
  time      timestamptz NOT NULL,           -- simulated time
  run_id    text NOT NULL,
  home_id   text NOT NULL,
  temp_f    double precision NOT NULL,      -- indoor °F
  co_ppm    double precision NOT NULL DEFAULT 0,
  power_on  boolean NOT NULL,
  heating   boolean NOT NULL,               -- furnace actually heating
  outdoor_f double precision NOT NULL       -- outdoor °F at this reading
);
SELECT create_hypertable('readings', by_range('time'), if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS readings_run_home_time ON readings (run_id, home_id, time DESC);

CREATE TABLE IF NOT EXISTS calls (
  id          serial PRIMARY KEY,
  run_id      text NOT NULL,
  home_id     text NOT NULL,
  started_at  timestamptz NOT NULL,         -- simulated time
  status      text NOT NULL,                -- call_status enum
  source      text NOT NULL,                -- live | scripted
  transcript  text,
  extracted   jsonb,
  outcome     text NOT NULL DEFAULT 'none'  -- outcome enum
);

CREATE TABLE IF NOT EXISTS predictions (
  made_at     timestamptz NOT NULL,         -- simulated time
  run_id      text NOT NULL,
  home_id     text NOT NULL,
  horizon_min int NOT NULL,                 -- 30 or 60
  k_source    text NOT NULL,                -- learned | global
  target_time timestamptz NOT NULL,
  predicted_f double precision NOT NULL
);
CREATE INDEX IF NOT EXISTS predictions_run_target ON predictions (run_id, target_time);
