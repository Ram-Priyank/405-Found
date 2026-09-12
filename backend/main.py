from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import datetime
import math
import random
import os
import time
import requests
from dotenv import load_dotenv
from database import SessionLocal, engine, Plant, SolarPlantDetail, WindPlantDetail, BatteryBank, BatteryTelemetry, HistoricalGeneration, GridConnection, GridTelemetry, CarbonCaptureTelemetry
from ml.inference import get_ml_prediction

load_dotenv()
TOMORROW_IO_API_KEY = os.getenv("TOMORROW_IO_API_KEY")
WEATHER_LAT = os.getenv("WEATHER_LAT", "33.8303")
WEATHER_LON = os.getenv("WEATHER_LON", "-116.5453")
ENERGYMAP_API_KEY = os.getenv("ENERGYMAP_API_KEY")

app = FastAPI(title="RenewIQ Backend")

# Allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Internal State (for Digital Twin simulation)
state = {
    "battery_soc": 72.4,
    "cces_soc": 58.1,
    "co2_captured": 12.4
}

energymap_cache = {
    "data": None,
    "timestamp": 0
}

def get_energymap_grid_data():
    if time.time() - energymap_cache["timestamp"] < 300 and energymap_cache["data"] is not None:
        return energymap_cache["data"]
        
    if not ENERGYMAP_API_KEY:
        return None
        
    headers = {"X-API-Key": ENERGYMAP_API_KEY}
    
    try:
        # Fetch Demand
        print("Fetching Energymap Demand...")
        req_demand = requests.get("https://api.energymap.in/developer/v1/grid/demand/latest", headers=headers, timeout=10)
        req_demand.raise_for_status()
        demand_data = req_demand.json()
        
        # Fetch Frequency
        print("Fetching Energymap Frequency...")
        req_freq = requests.get("https://api.energymap.in/developer/v1/grid/frequency/latest", headers=headers, timeout=10)
        req_freq.raise_for_status()
        freq_data = req_freq.json()
        
        result = {
            "national_demand_mw": demand_data.get("national", {}).get("demand_mw", 0),
            "frequency_hz": freq_data.get("frequency_hz", 50.0)
        }
        
        energymap_cache["data"] = result
        energymap_cache["timestamp"] = time.time()
        return result
    except Exception as e:
        print(f"Error fetching energymap: {e}")
        return None

forecast_cache = {}

def get_tomorrow_io_forecast(lat: str, lon: str):
    cache_key = f"{lat},{lon}"
    cache_entry = forecast_cache.get(cache_key)
    
    # Cache for 1 hour
    if cache_entry and time.time() - cache_entry["timestamp"] < 3600:
        return cache_entry["data"]
        
    if not TOMORROW_IO_API_KEY or TOMORROW_IO_API_KEY == "PASTE_YOUR_API_KEY_HERE":
        return None
        
    url = f"https://api.tomorrow.io/v4/weather/forecast?location={lat},{lon}&apikey={TOMORROW_IO_API_KEY}"
    try:
        print(f"Fetching real weather data from Tomorrow.io for {lat}, {lon}...")
        res = requests.get(url, timeout=10)
        res.raise_for_status()
        data = res.json()
        forecast_cache[cache_key] = {
            "data": data,
            "timestamp": time.time()
        }
        return data
    except Exception as e:
        print(f"Error fetching from tomorrow.io: {e}")
        return None

def clamp(val, min_val, max_val):
    return max(min_val, min(val, max_val))

@app.on_event("startup")
def seed_database():
    db = SessionLocal()
    
    # Check if plants exist, if not, create the whole structure
    if db.query(Plant).count() == 0:
        print("Database empty. Seeding full relational database structure...")
        
        # 1. Create Plants
        solar_plant = Plant(plant_name="Solar Farm A", plant_type="SOLAR", latitude=33.8, longitude=-116.5, installed_capacity_ac_kw=400)
        wind_plant = Plant(plant_name="Wind Farm B", plant_type="WIND", latitude=33.8, longitude=-116.5, installed_capacity_ac_kw=150)
        db.add(solar_plant)
        db.add(wind_plant)
        db.commit() # commit to get plant_ids
        
        # 2. Create Plant Details
        solar_details = SolarPlantDetail(plant_id=solar_plant.plant_id, panel_type="MONO", panel_wattage_wp=400.0)
        wind_details = WindPlantDetail(plant_id=wind_plant.plant_id, number_of_turbines=5)
        db.add(solar_details)
        db.add(wind_details)
        
        # 3. Create Battery Bank
        battery = BatteryBank(plant_id=solar_plant.plant_id, rated_capacity_kwh=1000, rated_power_kw=250)
        db.add(battery)
        
        # 4. Create Grid Connection
        grid = GridConnection(plant_id=solar_plant.plant_id, grid_voltage_level_kv=33.0)
        db.add(grid)
        
        db.commit() # commit to get battery and grid ids
        
        # 5. Seed Historical Telemetry Data
        now = datetime.datetime.utcnow()
        for i in range(7 * 24, 0, -1):
            past_time = now - datetime.timedelta(hours=i)
            
            s_gen = max(0, math.sin(math.pi * (past_time.hour - 6) / 12) * 400 + random.gauss(0, 50))
            w_gen = max(20, 150 + random.gauss(0, 40))
            
            db.add(HistoricalGeneration(plant_id=solar_plant.plant_id, timestamp=past_time, actual_generation_kwh=s_gen, curtailed_energy_kwh=max(0, random.gauss(10,15))))
            db.add(HistoricalGeneration(plant_id=wind_plant.plant_id, timestamp=past_time, actual_generation_kwh=w_gen, curtailed_energy_kwh=0))
            
        db.commit()
        print("Relational Database seeded.")
    db.close()

@app.get("/api/telemetry/live")
def get_live_telemetry(solarCap: float = 320, windCap: float = 150, baseDemand: float = 260, lat: float = None, lon: float = None, db: Session = Depends(get_db)):
    now = datetime.datetime.utcnow()
    hour = now.hour
    
    # 1. Weather
    cloud_cover = clamp(random.gauss(30, 20), 0, 100)
    wind_speed = clamp(random.gauss(7, 2), 0, 25)

    use_lat = str(lat) if lat is not None else WEATHER_LAT
    use_lon = str(lon) if lon is not None else WEATHER_LON

    # Override with real weather if available
    real_weather = get_tomorrow_io_forecast(use_lat, use_lon)
    if real_weather and "timelines" in real_weather and "hourly" in real_weather["timelines"]:
        for interval in real_weather["timelines"]["hourly"]:
            dt = datetime.datetime.fromisoformat(interval["time"].replace('Z', '+00:00')).replace(tzinfo=None)
            diff_hours = abs((dt - now).total_seconds() / 3600)
            if diff_hours < 1:
                vals = interval["values"]
                cloud_cover = vals.get("cloudCover", cloud_cover)
                wind_speed = vals.get("windSpeed", wind_speed)
                break
    
    # 2. Simulate Generation (Mocking ML with standard math)
    solar_gen = max(0, math.sin(math.pi * (hour - 6) / 12) * solarCap * (1 - cloud_cover/100))
    wind_gen = min(windCap, max(0, (wind_speed ** 3) * 0.5))
    
    # Add high-frequency sensor noise to make the dashboard live
    solar_gen = max(0, solar_gen + random.uniform(-0.02, 0.02) * solarCap)
    wind_gen = max(0, wind_gen + random.uniform(-0.05, 0.05) * windCap)
        
    # 3. Simulate demand
    demand = max(100, baseDemand + random.gauss(0, 10))
    
    # 4. Energy Management System (EMS) Logic
    renewable = solar_gen + wind_gen
    surplus = max(0, renewable - demand)
    
    battCharge = min(surplus * 0.42, 100) if state["battery_soc"] < 100 else 0
    ccesCharge = min(surplus * 0.3, 90) if state["cces_soc"] < 100 else 0
    gridExport = min(surplus * 0.28, 80)
    curtailed = max(0, surplus - battCharge - ccesCharge - gridExport)
    
    # Update Internal State
    state["battery_soc"] = clamp(state["battery_soc"] + (battCharge * 0.01) - 0.1, 0, 100)
    state["cces_soc"] = clamp(state["cces_soc"] + (ccesCharge * 0.01) - 0.1, 0, 100)
    state["co2_captured"] = state["co2_captured"] + random.gauss(0, 0.1)

    grid_stats = get_energymap_grid_data()
    national_demand = grid_stats["national_demand_mw"] if grid_stats else 218450
    grid_freq = grid_stats["frequency_hz"] if grid_stats else 50.0

    # 5. Store in Relational Database
    # Fetch IDs
    solar_plant = db.query(Plant).filter(Plant.plant_type == "SOLAR").first()
    wind_plant = db.query(Plant).filter(Plant.plant_type == "WIND").first()
    battery = db.query(BatteryBank).first()
    grid = db.query(GridConnection).first()
    
    if solar_plant and wind_plant and battery and grid:
        db.add(HistoricalGeneration(plant_id=solar_plant.plant_id, timestamp=now, actual_generation_kwh=solar_gen, curtailed_energy_kwh=curtailed))
        db.add(HistoricalGeneration(plant_id=wind_plant.plant_id, timestamp=now, actual_generation_kwh=wind_gen, curtailed_energy_kwh=0))
        db.add(BatteryTelemetry(battery_bank_id=battery.battery_bank_id, timestamp=now, soc_pct=state["battery_soc"]))
        db.add(GridTelemetry(grid_connection_id=grid.grid_connection_id, timestamp=now, grid_frequency_hz=grid_freq, real_time_import_kw=demand))
        db.add(CarbonCaptureTelemetry(plant_id=solar_plant.plant_id, timestamp=now, cces_soc_pct=state["cces_soc"], co2_captured_tons=state["co2_captured"]))
        db.commit()

    return {
        "solar": round(solar_gen, 1),
        "wind": round(wind_gen, 1),
        "demand": round(demand, 1),
        "national_demand_mw": national_demand,
        "grid_frequency_hz": grid_freq,
        "batt": round(state["battery_soc"], 1),
        "cces": round(state["cces_soc"], 1),
        "co2": round(state["co2_captured"], 1),
        "weather": {
            "cloud_cover": round(cloud_cover, 1),
            "wind_speed": round(wind_speed, 1)
        }
    }

@app.get("/api/plants")
def get_plants(db: Session = Depends(get_db)):
    plants = db.query(Plant).all()
    return [{"plant_id": p.plant_id, "plant_name": p.plant_name, "plant_type": p.plant_type, "capacity": float(p.installed_capacity_ac_kw)} for p in plants]

@app.get("/api/forecast")
def get_forecast(lat: float = None, lon: float = None, plant_id: int = None, db: Session = Depends(get_db)):
    now = datetime.datetime.utcnow()
    forecast_data = []
    
    use_lat = str(lat) if lat is not None else WEATHER_LAT
    use_lon = str(lon) if lon is not None else WEATHER_LON
    
    target_plant = db.query(Plant).filter(Plant.plant_id == plant_id).first() if plant_id else None

    # Try fetching real weather data...
    try:
        print(f"Fetching real weather data from Tomorrow.io for {use_lat}, {use_lon}...")
        url = f"https://api.tomorrow.io/v4/timelines?location={use_lat},{use_lon}&fields=temperature,cloudCover,windSpeed&timesteps=1h&units=metric&apikey={TOMORROW_IO_API_KEY}"
        resp = requests.get(url, timeout=5)
        weather_json = resp.json()
        intervals = weather_json['data']['timelines'][0]['intervals']
    except:
        intervals = None

    for i in range(-24, 73):
        dt = now + datetime.timedelta(hours=i)
        
        # Real weather if available
        cloud_cover = 20
        wind_speed = 5
        # shift index for intervals since i starts from -24
        interval_idx = i
        if intervals and interval_idx >= 0 and interval_idx < len(intervals):
            cloud_cover = intervals[interval_idx]['values'].get('cloudCover', 20)
            wind_speed = intervals[interval_idx]['values'].get('windSpeed', 5)
        
        # Calculate local time based on longitude to align solar curve
        longitude = float(use_lon)
        local_time_offset = longitude / 15.0
        local_hour = (dt.hour + dt.minute/60.0 + local_time_offset) % 24
        
        is_ml_used = False
        gen = 0
        
        if target_plant:
            try:
                gen = get_ml_prediction(target_plant.plant_type, float(target_plant.installed_capacity_ac_kw), dt, cloud_cover, wind_speed)
                if i >= 0:
                    is_ml_used = True
            except Exception as e:
                # print(f"ML Model Fallback: {e}")
                if target_plant.plant_type == 'SOLAR':
                    s = max(0, math.sin(math.pi * (local_hour - 6) / 12) * float(target_plant.installed_capacity_ac_kw) * (1 - cloud_cover/100))
                    w = 0
                else:
                    s = 0
                    w = min(float(target_plant.installed_capacity_ac_kw), max(0, (wind_speed ** 3) * 0.5))
                gen = s + w
        else:
            try:
                solar_gen = get_ml_prediction('SOLAR', 400.0, dt, cloud_cover, wind_speed) # based on DB seed
                wind_gen = get_ml_prediction('WIND', 150.0, dt, cloud_cover, wind_speed)   # based on DB seed
                gen = solar_gen + wind_gen
                if i >= 0:
                    is_ml_used = True
            except Exception as e:
                s = max(0, math.sin(math.pi * (local_hour - 6) / 12) * 320 * (1 - cloud_cover/100))
                w = min(150, max(0, (wind_speed ** 3) * 0.5))
                gen = s + w
            
        actual_gen = gen * (1 + random.uniform(-0.1, 0.1)) if i < 0 else None
        
        forecast_data.append({
            "timestamp": dt.replace(minute=0, second=0, microsecond=0).isoformat() + "Z",
            "forecast": gen,
            "actual": actual_gen,
            "p90": gen * 1.15 if not is_ml_used else gen + (gen * 0.1 * (cloud_cover/100)),
            "p10": gen * 0.85 if not is_ml_used else gen - (gen * 0.1 * (cloud_cover/100)),
            "hourOffset": i
        })
        
    return forecast_data
@app.get("/api/telemetry/history")
def get_history(db: Session = Depends(get_db)):
    days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    data = []
    for i, d in enumerate(days):
        data.append({
            "day": d,
            "solar": 120 + random.randint(-20, 40),
            "wind": 80 + random.randint(-15, 30),
            "demand": 180 + random.randint(-10, 20),
            "curtailed": random.randint(0, 30)
        })
    return data
