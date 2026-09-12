from sqlalchemy import create_engine, Column, Integer, Float, String, DateTime, ForeignKey, Date, Boolean, Numeric, BigInteger
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./renewiq_v2.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class Plant(Base):
    __tablename__ = 'plants'
    plant_id = Column(Integer, primary_key=True)
    plant_name = Column(String(120), nullable=False)
    plant_type = Column(String(10), nullable=False) # 'SOLAR' or 'WIND'
    latitude = Column(Numeric(9,6), nullable=False)
    longitude = Column(Numeric(9,6), nullable=False)
    elevation_m = Column(Numeric(8,2))
    installed_capacity_ac_kw = Column(Numeric(12,3))
    installed_capacity_dc_kw = Column(Numeric(12,3))
    commissioning_date = Column(Date)
    grid_connection_point = Column(String(120))
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class SolarPlantDetail(Base):
    __tablename__ = 'solar_plant_details'
    plant_id = Column(Integer, ForeignKey('plants.plant_id'), primary_key=True)
    panel_type = Column(String(20))
    panel_wattage_wp = Column(Numeric(8,2))
    number_of_panels = Column(Integer)
    panel_efficiency_pct = Column(Numeric(5,2))

class WindPlantDetail(Base):
    __tablename__ = 'wind_plant_details'
    plant_id = Column(Integer, ForeignKey('plants.plant_id'), primary_key=True)
    number_of_turbines = Column(Integer)
    turbine_make_model = Column(String(120))
    rated_power_per_turbine_kw = Column(Numeric(10,3))

class BatteryBank(Base):
    __tablename__ = 'battery_banks'
    battery_bank_id = Column(Integer, primary_key=True)
    plant_id = Column(Integer, ForeignKey('plants.plant_id'))
    grid_connection_point = Column(String(120))
    chemistry = Column(String(20))
    rated_capacity_kwh = Column(Numeric(12,3), nullable=False)
    rated_power_kw = Column(Numeric(12,3), nullable=False)

class BatteryTelemetry(Base):
    __tablename__ = 'battery_telemetry'
    telemetry_id = Column(Integer, primary_key=True, autoincrement=True)
    battery_bank_id = Column(Integer, ForeignKey('battery_banks.battery_bank_id'))
    timestamp = Column(DateTime, nullable=False, default=datetime.datetime.utcnow)
    soc_pct = Column(Numeric(5,2), nullable=False)
    soh_pct = Column(Numeric(5,2))
    cycle_count = Column(Integer)
    battery_temp_c = Column(Numeric(5,2))

class HistoricalGeneration(Base):
    __tablename__ = 'historical_generation'
    record_id = Column(Integer, primary_key=True, autoincrement=True)
    plant_id = Column(Integer, ForeignKey('plants.plant_id'))
    timestamp = Column(DateTime, nullable=False, default=datetime.datetime.utcnow)
    actual_generation_kwh = Column(Numeric(14,3))
    curtailed_energy_kwh = Column(Numeric(12,3))

class GridConnection(Base):
    __tablename__ = 'grid_connections'
    grid_connection_id = Column(Integer, primary_key=True)
    plant_id = Column(Integer, ForeignKey('plants.plant_id'))
    substation_name = Column(String(120))
    grid_voltage_level_kv = Column(Numeric(8,2))

class GridTelemetry(Base):
    __tablename__ = 'grid_telemetry'
    telemetry_id = Column(Integer, primary_key=True, autoincrement=True)
    grid_connection_id = Column(Integer, ForeignKey('grid_connections.grid_connection_id'))
    timestamp = Column(DateTime, nullable=False, default=datetime.datetime.utcnow)
    grid_frequency_hz = Column(Numeric(6,3))
    real_time_import_kw = Column(Numeric(12,3))
    real_time_export_kw = Column(Numeric(12,3))

# Carbon capture specific to the previous dashboard (not in standard SQL schema but needed for UI)
class CarbonCaptureTelemetry(Base):
    __tablename__ = 'carbon_capture_telemetry'
    telemetry_id = Column(Integer, primary_key=True, autoincrement=True)
    plant_id = Column(Integer, ForeignKey('plants.plant_id'))
    timestamp = Column(DateTime, nullable=False, default=datetime.datetime.utcnow)
    cces_soc_pct = Column(Numeric(5,2))
    co2_captured_tons = Column(Numeric(10,3))

Base.metadata.create_all(bind=engine)
