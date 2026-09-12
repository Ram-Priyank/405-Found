-- ============================================================================
-- RENEWABLE ENERGY FORECASTING SYSTEM — DATABASE SCHEMA
-- Dialect: PostgreSQL (adjust types slightly for MySQL/SQL Server if needed)
-- ============================================================================
-- Design principles:
--   1. One base "plants" table holds fields common to solar & wind.
--   2. Solar-only and wind-only static specs live in their own 1:1 detail
--      tables (avoids dozens of NULL columns on the base table).
--   3. Anything that changes over time (SOC, load, weather, generation,
--      forecasts, calculated metrics) is a time-series table keyed on
--      (entity_id, timestamp) — never bolted onto a static spec table.
--   4. Lookup-style repeating data (power curves, tariffs, outage logs)
--      gets its own child table instead of a JSON blob, so it stays queryable.
-- ============================================================================


-- ============================================================================
-- 1. CORE PLANT TABLES
-- ============================================================================

CREATE TABLE plants (
    plant_id                SERIAL PRIMARY KEY,
    plant_name              VARCHAR(120) NOT NULL,
    plant_type              VARCHAR(10)  NOT NULL CHECK (plant_type IN ('SOLAR','WIND')),
    latitude                NUMERIC(9,6) NOT NULL,
    longitude               NUMERIC(9,6) NOT NULL,
    elevation_m             NUMERIC(8,2),
    installed_capacity_ac_kw NUMERIC(12,3),   -- solar AC / wind nameplate
    installed_capacity_dc_kw NUMERIC(12,3),   -- solar only, NULL for wind
    commissioning_date      DATE,
    grid_connection_point   VARCHAR(120),
    created_at              TIMESTAMP DEFAULT now()
);

-- ---- Solar-specific static specs (1:1 with plants where plant_type = 'SOLAR') ----
CREATE TABLE solar_plant_details (
    plant_id                    INTEGER PRIMARY KEY REFERENCES plants(plant_id) ON DELETE CASCADE,
    panel_type                  VARCHAR(20) CHECK (panel_type IN ('MONO','POLY','THIN_FILM')),
    panel_wattage_wp             NUMERIC(8,2),
    number_of_panels            INTEGER,
    panel_efficiency_pct        NUMERIC(5,2),
    panel_tilt_deg              NUMERIC(5,2),
    panel_azimuth_deg           NUMERIC(5,2),
    mounting_type               VARCHAR(30) CHECK (mounting_type IN ('FIXED','TRACKING_SINGLE_AXIS','TRACKING_DUAL_AXIS')),
    inverter_type                VARCHAR(20) CHECK (inverter_type IN ('STRING','CENTRAL','MICRO')),
    inverter_capacity_kw         NUMERIC(10,3),
    inverter_efficiency_pct      NUMERIC(5,2),
    dc_ac_ratio                  NUMERIC(5,3),
    temp_coefficient_pmax_pct_c  NUMERIC(5,3),
    noct_c                       NUMERIC(5,2),
    degradation_rate_pct_yr      NUMERIC(5,3),
    total_module_area_m2         NUMERIC(10,2),
    shading_loss_factor_pct      NUMERIC(5,2),
    soiling_loss_factor_pct      NUMERIC(5,2),
    wiring_loss_factor_pct       NUMERIC(5,2)
);

-- ---- Wind-specific static specs (1:1 with plants where plant_type = 'WIND') ----
CREATE TABLE wind_plant_details (
    plant_id                    INTEGER PRIMARY KEY REFERENCES plants(plant_id) ON DELETE CASCADE,
    number_of_turbines          INTEGER,
    turbine_make_model           VARCHAR(120),
    rated_power_per_turbine_kw   NUMERIC(10,3),
    rotor_diameter_m             NUMERIC(6,2),
    swept_area_m2                NUMERIC(10,2),
    hub_height_m                 NUMERIC(6,2),
    cut_in_wind_speed_ms         NUMERIC(5,2),
    rated_wind_speed_ms          NUMERIC(5,2),
    cut_out_wind_speed_ms        NUMERIC(5,2),
    power_coefficient_cp         NUMERIC(5,3),
    wind_shear_coefficient_alpha NUMERIC(5,3),
    surface_roughness_length_m   NUMERIC(6,4),
    turbine_availability_pct     NUMERIC(5,2),
    wake_loss_factor_pct         NUMERIC(5,2),
    air_density_correction_ratio NUMERIC(5,3),
    turbine_layout_spacing_m     NUMERIC(8,2),
    yaw_control_type             VARCHAR(10) CHECK (yaw_control_type IN ('ACTIVE','PASSIVE'))
);

-- Power curve: wind speed -> power output, one row per bin, per plant
CREATE TABLE wind_power_curve (
    curve_id        SERIAL PRIMARY KEY,
    plant_id        INTEGER NOT NULL REFERENCES plants(plant_id) ON DELETE CASCADE,
    wind_speed_ms   NUMERIC(5,2) NOT NULL,
    power_output_kw NUMERIC(10,3) NOT NULL,
    UNIQUE (plant_id, wind_speed_ms)
);


-- ============================================================================
-- 2. BATTERY / STORAGE
-- ============================================================================

CREATE TABLE battery_banks (
    battery_bank_id          SERIAL PRIMARY KEY,
    plant_id                 INTEGER REFERENCES plants(plant_id) ON DELETE SET NULL,
    grid_connection_point    VARCHAR(120),
    chemistry                VARCHAR(20) CHECK (chemistry IN ('LI_ION','LEAD_ACID','FLOW','NAS')),
    rated_capacity_kwh       NUMERIC(12,3) NOT NULL,
    rated_power_kw           NUMERIC(12,3) NOT NULL,
    nominal_voltage_v        NUMERIC(8,2),
    number_of_modules_racks  INTEGER,
    max_charge_rate_kw       NUMERIC(10,3),
    max_discharge_rate_kw    NUMERIC(10,3),
    round_trip_efficiency_pct NUMERIC(5,2),
    dod_limit_pct            NUMERIC(5,2),
    min_soc_limit_pct        NUMERIC(5,2),
    max_soc_limit_pct        NUMERIC(5,2),
    cycle_life_rated         INTEGER,
    calendar_life_years      INTEGER,
    self_discharge_pct_month NUMERIC(5,3),
    op_temp_min_c            NUMERIC(5,2),
    op_temp_max_c            NUMERIC(5,2),
    thermal_management_type  VARCHAR(15) CHECK (thermal_management_type IN ('AIR_COOLED','LIQUID_COOLED','NONE')),
    pcs_efficiency_pct       NUMERIC(5,2),
    warranty_period_years    INTEGER,
    degradation_rate_pct_yr  NUMERIC(5,3),
    replacement_cost         NUMERIC(14,2),
    commissioning_date       DATE
);

-- Real-time / logged battery telemetry (BMS)
CREATE TABLE battery_telemetry (
    telemetry_id      BIGSERIAL PRIMARY KEY,
    battery_bank_id   INTEGER NOT NULL REFERENCES battery_banks(battery_bank_id) ON DELETE CASCADE,
    timestamp         TIMESTAMP NOT NULL,
    soc_pct           NUMERIC(5,2) NOT NULL,
    soh_pct           NUMERIC(5,2),
    cycle_count       INTEGER,
    battery_temp_c    NUMERIC(5,2),
    UNIQUE (battery_bank_id, timestamp)
);


-- ============================================================================
-- 3. GRID CONNECTION
-- ============================================================================

CREATE TABLE grid_connections (
    grid_connection_id        SERIAL PRIMARY KEY,
    plant_id                  INTEGER REFERENCES plants(plant_id) ON DELETE SET NULL,
    substation_name            VARCHAR(120),
    metering_point_id          VARCHAR(60),
    grid_voltage_level_kv      NUMERIC(8,2),
    grid_frequency_nominal_hz  NUMERIC(5,2),
    contracted_import_capacity_kw NUMERIC(12,3),
    contracted_export_capacity_kw NUMERIC(12,3),
    transformer_capacity_kva   NUMERIC(12,3),
    grid_code_compliance_std   VARCHAR(60),
    ppa_terms_ref              VARCHAR(255),
    feed_in_tariff_per_kwh     NUMERIC(10,4)
);

-- Real-time grid telemetry
CREATE TABLE grid_telemetry (
    telemetry_id            BIGSERIAL PRIMARY KEY,
    grid_connection_id      INTEGER NOT NULL REFERENCES grid_connections(grid_connection_id) ON DELETE CASCADE,
    timestamp               TIMESTAMP NOT NULL,
    grid_frequency_hz       NUMERIC(6,3),
    real_time_import_kw     NUMERIC(12,3),
    real_time_export_kw     NUMERIC(12,3),
    grid_availability       BOOLEAN,
    power_factor            NUMERIC(4,3),
    transformer_loading_pct NUMERIC(5,2),
    voltage_fluctuation_pct NUMERIC(5,2),
    grid_stability_index    NUMERIC(6,3),
    curtailment_signal      BOOLEAN,
    UNIQUE (grid_connection_id, timestamp)
);

-- Time-of-use tariff schedule (repeating rows per slot)
CREATE TABLE grid_tariff_schedule (
    tariff_id           SERIAL PRIMARY KEY,
    grid_connection_id  INTEGER NOT NULL REFERENCES grid_connections(grid_connection_id) ON DELETE CASCADE,
    time_slot_start     TIME NOT NULL,
    time_slot_end       TIME NOT NULL,
    rate_per_kwh        NUMERIC(10,4) NOT NULL
);

CREATE TABLE grid_outage_history (
    outage_id           SERIAL PRIMARY KEY,
    grid_connection_id  INTEGER NOT NULL REFERENCES grid_connections(grid_connection_id) ON DELETE CASCADE,
    outage_start        TIMESTAMP NOT NULL,
    duration_minutes    NUMERIC(10,2)
);


-- ============================================================================
-- 4. DEMAND / LOAD
-- ============================================================================

CREATE TABLE demand_sites (
    site_id                       SERIAL PRIMARY KEY,
    consumer_category             VARCHAR(15) CHECK (consumer_category IN ('INDUSTRIAL','RESIDENTIAL','COMMERCIAL','AGRICULTURAL')),
    contracted_load_kw            NUMERIC(12,3),
    load_profile_type             VARCHAR(15) CHECK (load_profile_type IN ('FLAT','PEAKY','SEASONAL')),
    flexible_load_pct             NUMERIC(5,2),
    critical_load_pct             NUMERIC(5,2),
    demand_response_participation BOOLEAN,
    demand_response_capacity_kw   NUMERIC(10,3),
    number_connected_consumers    INTEGER,
    seasonal_variation_factor     NUMERIC(6,3),
    temperature_sensitivity_kw_c  NUMERIC(8,3),
    billing_tariff_category       VARCHAR(60)
);

-- Real-time / historical load readings
CREATE TABLE demand_load_readings (
    reading_id       BIGSERIAL PRIMARY KEY,
    site_id          INTEGER NOT NULL REFERENCES demand_sites(site_id) ON DELETE CASCADE,
    timestamp        TIMESTAMP NOT NULL,
    real_time_load_kw NUMERIC(12,3),
    power_factor     NUMERIC(4,3),
    UNIQUE (site_id, timestamp)
);

CREATE TABLE demand_shiftable_loads (
    shiftable_id  SERIAL PRIMARY KEY,
    site_id       INTEGER NOT NULL REFERENCES demand_sites(site_id) ON DELETE CASCADE,
    appliance_process VARCHAR(120)
);

CREATE TABLE demand_outage_history (
    outage_id     SERIAL PRIMARY KEY,
    site_id       INTEGER NOT NULL REFERENCES demand_sites(site_id) ON DELETE CASCADE,
    outage_start  TIMESTAMP NOT NULL,
    duration_minutes NUMERIC(10,2)
);


-- ============================================================================
-- 5. HISTORICAL GENERATION & WEATHER (time-series, per plant)
-- ============================================================================

CREATE TABLE historical_generation (
    record_id                BIGSERIAL PRIMARY KEY,
    plant_id                 INTEGER NOT NULL REFERENCES plants(plant_id) ON DELETE CASCADE,
    timestamp                TIMESTAMP NOT NULL,
    actual_generation_kwh    NUMERIC(14,3),
    curtailed_energy_kwh     NUMERIC(12,3),
    downtime_flag            BOOLEAN DEFAULT FALSE,
    outage_duration_hrs      NUMERIC(8,2),
    outage_reason            VARCHAR(255),
    plant_availability_pct   NUMERIC(5,2),
    cuf_plf_pct              NUMERIC(5,2),
    historical_demand_kw     NUMERIC(12,3),
    historical_grid_import_export_kwh NUMERIC(12,3),
    historical_storage_soc_pct NUMERIC(5,2),
    historical_forecast_kwh  NUMERIC(14,3),
    historical_forecast_error NUMERIC(10,3),
    data_resolution           VARCHAR(10) CHECK (data_resolution IN ('5MIN','15MIN','HOURLY','DAILY')),
    data_source_system        VARCHAR(60),
    UNIQUE (plant_id, timestamp)
);

CREATE TABLE historical_weather (
    record_id        BIGSERIAL PRIMARY KEY,
    plant_id         INTEGER NOT NULL REFERENCES plants(plant_id) ON DELETE CASCADE,
    timestamp        TIMESTAMP NOT NULL,
    ghi_wm2          NUMERIC(8,2),
    dni_wm2          NUMERIC(8,2),
    dhi_wm2          NUMERIC(8,2),
    ambient_temp_c   NUMERIC(5,2),
    wind_speed_hub_ms NUMERIC(6,2),
    humidity_pct     NUMERIC(5,2),
    raw_weather_json JSONB,          -- catch-all for extra weather-API fields
    UNIQUE (plant_id, timestamp)
);


-- ============================================================================
-- 6. CALCULATED / DERIVED METRICS (time-series, per plant)
-- ============================================================================

CREATE TABLE calculated_metrics (
    record_id                  BIGSERIAL PRIMARY KEY,
    plant_id                   INTEGER NOT NULL REFERENCES plants(plant_id) ON DELETE CASCADE,
    timestamp                  TIMESTAMP NOT NULL,
    dc_ac_ratio                 NUMERIC(6,3),
    capacity_utilization_pct    NUMERIC(5,2),
    estimated_cell_temp_c       NUMERIC(5,2),
    temperature_loss_pct        NUMERIC(5,2),
    soiling_loss_pct            NUMERIC(5,2),
    shading_loss_pct            NUMERIC(5,2),
    wiring_loss_pct             NUMERIC(5,2),
    inverter_loss_pct           NUMERIC(5,2),
    available_dc_power_kw       NUMERIC(12,3),
    expected_ac_power_kw        NUMERIC(12,3),
    performance_ratio_pct       NUMERIC(5,2),
    irradiance_to_power_ratio   NUMERIC(10,6),
    solar_elevation_deg         NUMERIC(6,3),
    solar_zenith_deg            NUMERIC(6,3),
    clear_sky_ghi_wm2           NUMERIC(8,2),
    irradiance_deviation_wm2    NUMERIC(8,2),
    clearness_index             NUMERIC(5,3),   -- GHI actual / GHI clear-sky
    generation_deviation_kw     NUMERIC(12,3),
    plant_availability_pct      NUMERIC(5,2),
    curtailment_loss_kwh_kw     NUMERIC(10,4),
    sensor_deviation            NUMERIC(10,4),
    days_since_cleaning         INTEGER,
    days_since_maintenance      INTEGER,
    rolling_mean_kw             NUMERIC(12,3),
    rolling_std_kw              NUMERIC(12,3),
    generation_ramp_rate_kw     NUMERIC(12,3),
    irradiance_ramp_rate_wm2    NUMERIC(8,2),
    -- Wind-specific calculated fields
    reference_wind_speed_ms     NUMERIC(6,2),   -- Vref = wind_kph / 3.6
    reference_height_m          NUMERIC(6,2),
    wind_shear_exponent         NUMERIC(5,3),
    wind_power_density_wm2      NUMERIC(10,2),
    UNIQUE (plant_id, timestamp)
);


-- ============================================================================
-- 7. FORECAST DATA (time-series, per plant, model input + output)
-- ============================================================================

CREATE TABLE forecast_weather (
    record_id                BIGSERIAL PRIMARY KEY,
    plant_id                 INTEGER NOT NULL REFERENCES plants(plant_id) ON DELETE CASCADE,
    forecast_issued_at       TIMESTAMP NOT NULL,   -- when the forecast was generated
    forecast_valid_for       TIMESTAMP NOT NULL,   -- the timestamp being forecast
    forecast_ghi_wm2         NUMERIC(8,2),
    forecast_dni_wm2         NUMERIC(8,2),
    forecast_dhi_wm2         NUMERIC(8,2),
    forecast_poa_wm2         NUMERIC(8,2),
    forecast_temp_c          NUMERIC(5,2),
    forecast_cloud_cover_pct NUMERIC(5,2),
    forecast_humidity_pct    NUMERIC(5,2),
    forecast_wind_speed_ms   NUMERIC(6,2),
    forecast_wind_direction_deg NUMERIC(6,2),
    forecast_precipitation_mm NUMERIC(8,2),
    forecast_pressure_hpa    NUMERIC(8,2),
    forecast_visibility_km   NUMERIC(6,2),
    UNIQUE (plant_id, forecast_issued_at, forecast_valid_for)
);

CREATE TABLE forecast_generation_output (
    record_id           BIGSERIAL PRIMARY KEY,
    plant_id            INTEGER NOT NULL REFERENCES plants(plant_id) ON DELETE CASCADE,
    forecast_issued_at  TIMESTAMP NOT NULL,
    forecast_valid_for  TIMESTAMP NOT NULL,
    forecast_generation_kwh NUMERIC(14,3),
    model_version       VARCHAR(60),
    UNIQUE (plant_id, forecast_issued_at, forecast_valid_for, model_version)
);


-- ============================================================================
-- INDEXES for common time-series query patterns
-- ============================================================================

CREATE INDEX idx_hist_gen_plant_time      ON historical_generation (plant_id, timestamp);
CREATE INDEX idx_hist_weather_plant_time  ON historical_weather (plant_id, timestamp);
CREATE INDEX idx_calc_metrics_plant_time  ON calculated_metrics (plant_id, timestamp);
CREATE INDEX idx_forecast_weather_valid   ON forecast_weather (plant_id, forecast_valid_for);
CREATE INDEX idx_battery_telemetry_time   ON battery_telemetry (battery_bank_id, timestamp);
CREATE INDEX idx_grid_telemetry_time      ON grid_telemetry (grid_connection_id, timestamp);
CREATE INDEX idx_demand_load_time         ON demand_load_readings (site_id, timestamp);
