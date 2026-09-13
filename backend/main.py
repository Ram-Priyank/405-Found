from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import datetime
import math
import random
import os
import time
import requests
import csv
from dotenv import load_dotenv
from database import SessionLocal, engine, Plant, SolarPlantDetail, WindPlantDetail, BatteryBank, BatteryTelemetry, HistoricalGeneration, GridConnection, GridTelemetry, CarbonCaptureTelemetry
from ml.inference import get_ml_prediction
from ml.xgboost_forecaster import generate_24h_portfolio_forecast
from pydantic import BaseModel
from optimization_engine import optimize_schedule

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

def load_demand_forecast():
    forecast = []
    try:
        csv_path = os.path.join(os.path.dirname(__file__), "next_24_hours_demand_forecast.csv")
        with open(csv_path, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                forecast.append(float(row['predicted_demand_mw']))
    except Exception as e:
        print(f"Failed to load demand forecast: {e}")
        forecast = [20000 + 3000 * math.sin(i / 24 * 2 * math.pi) for i in range(24)]
    return forecast

DEMAND_FORECAST_24H = load_demand_forecast()

# Internal State (for Digital Twin simulation)
state = {
    "battery_soc": 72.4,
    "cces_soc": 58.1,
    "co2_captured": 12.4,
    "anomalies": {
        "storm": 0,
        "grid_spike": 0
    }
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

PORTFOLIO_FORECAST_24H = []
TRUE_SOLAR_CAP_MW = 0.0
TRUE_WIND_CAP_MW = 0.0

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

    global TRUE_SOLAR_CAP_MW, TRUE_WIND_CAP_MW
    TRUE_SOLAR_CAP_MW = sum([float(p.installed_capacity_ac_kw) for p in db.query(Plant).filter(Plant.plant_type == 'SOLAR').all()]) / 1000.0
    TRUE_WIND_CAP_MW = sum([float(p.installed_capacity_ac_kw) for p in db.query(Plant).filter(Plant.plant_type == 'WIND').all()]) / 1000.0
    print(f"Database seeded! Actual Solar: {TRUE_SOLAR_CAP_MW}MW, Wind: {TRUE_WIND_CAP_MW}MW")
    db.close()

    global PORTFOLIO_FORECAST_24H
    try:
        print("Generating 24-hour portfolio forecast using XGBoost (this might take a moment)...")
        PORTFOLIO_FORECAST_24H = generate_24h_portfolio_forecast(TRUE_SOLAR_CAP_MW * 1000, TRUE_WIND_CAP_MW * 1000)
        print("Portfolio forecast generated and cached!")
    except Exception as e:
        print(f"Failed to generate XGBoost portfolio forecast: {e}")

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
    
    # Get all plants and calculate true total capacity
    plants = db.query(Plant).all()
    solar_plants = [p for p in plants if p.plant_type == "SOLAR"]
    wind_plants = [p for p in plants if p.plant_type == "WIND"]
    
    true_solar_cap_mw = sum(float(p.installed_capacity_ac_kw) for p in solar_plants) / 1000.0 if solar_plants else 320.0
    true_wind_cap_mw = sum(float(p.installed_capacity_ac_kw) for p in wind_plants) / 1000.0 if wind_plants else 150.0

    # 2. ML Generation from cached XGBoost predictions
    try:
        # Use the first hour (current hour) of the cached prediction
        # The cache is in kW, so divide by 1000 to get MW
        if PORTFOLIO_FORECAST_24H and len(PORTFOLIO_FORECAST_24H) > 0:
            p = PORTFOLIO_FORECAST_24H[0]
            solar_gen = p["solar_expected"] / 1000.0
            wind_gen = p["wind_expected"] / 1000.0
        else:
            raise Exception("No cached prediction available")
    except Exception as e:
        print(f"Live Telemetry ML Fallback Error: {e}")
        solar_gen = max(0, math.sin(math.pi * (hour - 6) / 12) * true_solar_cap_mw * (1 - cloud_cover/100)) if 6 <= hour <= 18 else 0
        wind_gen = min(true_wind_cap_mw, max(0, (wind_speed ** 3) * 0.5))
    
    # Add high-frequency sensor noise to make the dashboard live
    if solar_gen > 0:
        solar_gen = max(0, solar_gen + random.uniform(-0.02, 0.02) * true_solar_cap_mw)
    wind_gen = max(0, wind_gen + random.uniform(-0.05, 0.05) * true_wind_cap_mw)
        
    # 2.5 Apply Anomalies (God Mode)
    now_ts = time.time()
    storm_active = (now_ts - state["anomalies"]["storm"]) < 15
    grid_spike_active = (now_ts - state["anomalies"]["grid_spike"]) < 15
    
    if storm_active:
        solar_gen *= 0.05
        wind_gen *= 0.2
        
    # 3. Simulate demand (scale state ML demand to local microgrid level ~2%)
    baseDemand = (DEMAND_FORECAST_24H[hour] * 0.02) if hour < len(DEMAND_FORECAST_24H) else 400
    demand = max(100, baseDemand + random.gauss(0, 5))
    if grid_spike_active:
        demand *= 3
    
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

    # 5. Store in Relational Database for ALL 100 Plants Proportinally
    battery = db.query(BatteryBank).first()
    grid = db.query(GridConnection).first()
    
    if battery and grid:
        for p in solar_plants:
            p_cap = float(p.installed_capacity_ac_kw) / 1000.0
            p_gen = (p_cap / true_solar_cap_mw) * solar_gen if true_solar_cap_mw > 0 else 0
            p_curt = (p_cap / true_solar_cap_mw) * curtailed if true_solar_cap_mw > 0 else 0
            db.add(HistoricalGeneration(plant_id=p.plant_id, timestamp=now, actual_generation_kwh=p_gen, curtailed_energy_kwh=p_curt))
            
        for p in wind_plants:
            p_cap = float(p.installed_capacity_ac_kw) / 1000.0
            p_gen = (p_cap / true_wind_cap_mw) * wind_gen if true_wind_cap_mw > 0 else 0
            db.add(HistoricalGeneration(plant_id=p.plant_id, timestamp=now, actual_generation_kwh=p_gen, curtailed_energy_kwh=0))

        db.add(BatteryTelemetry(battery_bank_id=battery.battery_bank_id, timestamp=now, soc_pct=state["battery_soc"]))
        db.add(GridTelemetry(grid_connection_id=grid.grid_connection_id, timestamp=now, grid_frequency_hz=grid_freq, real_time_import_kw=demand))
        
        if solar_plants:
            db.add(CarbonCaptureTelemetry(plant_id=solar_plants[0].plant_id, timestamp=now, cces_soc_pct=state["cces_soc"], co2_captured_tons=state["co2_captured"]))
            
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
        },
        "anomalies": {
            "storm": storm_active,
            "grid_spike": grid_spike_active
        }
    }
    
@app.post("/api/telemetry/trigger-anomaly")
def trigger_anomaly(type: str):
    if type in state["anomalies"]:
        state["anomalies"][type] = time.time()
        return {"status": "success", "anomaly": type}
    return {"status": "error", "message": "Unknown anomaly type"}

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
        
        solar_l = solar_e = solar_u = 0
        wind_l = wind_e = wind_u = 0
        
        if i >= 0 and i < 24 and len(PORTFOLIO_FORECAST_24H) > i:
            # We have XGBoost predictions for this hour!
            is_ml_used = True
            p = PORTFOLIO_FORECAST_24H[i]
            
            # If target plant, scale down the portfolio prediction by ratio
            if target_plant:
                # Add deterministic noise so individual plants have a unique generation curve shape
                variance = 1.0 + math.sin(i * 0.4 + target_plant.plant_id * 2.7) * 0.12
                
                if target_plant.plant_type == 'SOLAR':
                    ratio = float(target_plant.installed_capacity_ac_kw) / max(1, TRUE_SOLAR_CAP_MW * 1000)
                    ratio *= variance
                    gen = max(0, p["solar_expected"] * ratio)
                    solar_l = max(0, p["solar_lower"] * ratio)
                    solar_e = max(0, p["solar_expected"] * ratio)
                    solar_u = max(0, p["solar_upper"] * ratio)
                else:
                    ratio = float(target_plant.installed_capacity_ac_kw) / max(1, TRUE_WIND_CAP_MW * 1000)
                    ratio *= variance
                    gen = max(0, p["wind_expected"] * ratio)
                    wind_l = max(0, p["wind_lower"] * ratio)
                    wind_e = max(0, p["wind_expected"] * ratio)
                    wind_u = max(0, p["wind_upper"] * ratio)
            else:
                solar_l = p["solar_lower"]
                solar_e = p["solar_expected"]
                solar_u = p["solar_upper"]
                wind_l = p["wind_lower"]
                wind_e = p["wind_expected"]
                wind_u = p["wind_upper"]
                gen = solar_e + wind_e
        else:
            # Fallback to sine waves for history or far future
            if target_plant:
                if target_plant.plant_type == 'SOLAR':
                    gen = max(0, math.sin(math.pi * (local_hour - 6) / 12) * float(target_plant.installed_capacity_ac_kw) * (1 - cloud_cover/100)) if 6 <= local_hour <= 18 else 0
                    solar_e = gen
                else:
                    gen = min(float(target_plant.installed_capacity_ac_kw), max(0, (wind_speed ** 3) * 0.5))
                    wind_e = gen
            else:
                solar_gen = max(0, math.sin(math.pi * (local_hour - 6) / 12) * (TRUE_SOLAR_CAP_MW*1000) * (1 - cloud_cover/100)) if 6 <= local_hour <= 18 else 0
                wind_gen = min((TRUE_WIND_CAP_MW*1000), max(0, (wind_speed ** 3) * 0.5))
                gen = solar_gen + wind_gen
                solar_e = solar_gen
                wind_e = wind_gen
            
        actual_gen = gen * (1 + random.uniform(-0.1, 0.1)) if i < 0 else None
        actual_solar = solar_e * (1 + random.uniform(-0.1, 0.1)) if i < 0 else None
        actual_wind = wind_e * (1 + random.uniform(-0.1, 0.1)) if i < 0 else None
        
        # Get ML demand forecast for this hour, scaled to 2% for local microgrid
        demand_val = (DEMAND_FORECAST_24H[dt.hour % 24] * 0.02) if DEMAND_FORECAST_24H else 400
        # For historical hours, simulate some variance
        if i < 0:
            demand_val = demand_val * (1 + random.uniform(-0.05, 0.05))
            
        forecast_data.append({
            "timestamp": dt.replace(minute=0, second=0, microsecond=0).isoformat() + "Z",
            "forecast": gen / 1000,
            "actual": actual_gen / 1000 if actual_gen is not None else None,
            "actual_solar": actual_solar / 1000 if actual_solar is not None else None,
            "actual_wind": actual_wind / 1000 if actual_wind is not None else None,
            "demand": demand_val,
            "p90": (gen * 1.15) / 1000 if not is_ml_used else (solar_u + wind_u) / 1000,
            "p10": (gen * 0.85) / 1000 if not is_ml_used else (solar_l + wind_l) / 1000,
            "solar_lower": solar_l / 1000,
            "solar_expected": solar_e / 1000,
            "solar_upper": solar_u / 1000,
            "wind_lower": wind_l / 1000,
            "wind_expected": wind_e / 1000,
            "wind_upper": wind_u / 1000,
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

class OptimizeRequest(BaseModel):
    solar_modifier: float = 1.0
    demand_modifier: float = 1.0
    battery_enabled: bool = True
    grid_capacity_modifier: float = 1.0
    scenario: str = "profit"

@app.post("/api/optimize_schedule")
def api_optimize_schedule(req: OptimizeRequest, db: Session = Depends(get_db)):
    raw_forecast = get_forecast(lat=None, lon=None, plant_id=None, db=db)
    next_24 = [f for f in raw_forecast if 0 <= f.get("hourOffset", -1) < 24]
    if not next_24:
        # Fallback if hourOffset isn't there
        next_24 = raw_forecast[24:48] if len(raw_forecast) > 48 else raw_forecast[:24]
    
    overrides = req.dict()
    return optimize_schedule(next_24, overrides)
