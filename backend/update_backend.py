import os
import re

filepath = r"c:\Users\priya\Desktop\Hackout'26\backend\main.py"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Replace cache and get_tomorrow_io_forecast
old_cache_func = """forecast_cache = {
    "data": None,
    "timestamp": 0
}

def get_tomorrow_io_forecast():
    # Cache for 1 hour
    if time.time() - forecast_cache["timestamp"] < 3600 and forecast_cache["data"] is not None:
        return forecast_cache["data"]
        
    if not TOMORROW_IO_API_KEY or TOMORROW_IO_API_KEY == "PASTE_YOUR_API_KEY_HERE":
        return None
        
    url = f"https://api.tomorrow.io/v4/weather/forecast?location={WEATHER_LAT},{WEATHER_LON}&apikey={TOMORROW_IO_API_KEY}"
    try:
        print(f"Fetching real weather data from Tomorrow.io for {WEATHER_LAT}, {WEATHER_LON}...")
        res = requests.get(url, timeout=10)
        res.raise_for_status()
        data = res.json()
        forecast_cache["data"] = data
        forecast_cache["timestamp"] = time.time()
        return data
    except Exception as e:
        print(f"Error fetching from tomorrow.io: {e}")
        return None"""

new_cache_func = """forecast_cache = {}

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
        return None"""
content = content.replace(old_cache_func, new_cache_func)

# 2. Update get_live_telemetry signature and real_weather call
old_live_sig = "def get_live_telemetry(solarCap: float = 320, windCap: float = 150, baseDemand: float = 260, db: Session = Depends(get_db)):"
new_live_sig = "def get_live_telemetry(solarCap: float = 320, windCap: float = 150, baseDemand: float = 260, lat: float = None, lon: float = None, db: Session = Depends(get_db)):"
content = content.replace(old_live_sig, new_live_sig)

old_real_weather_live = """    # Override with real weather if available
    real_weather = get_tomorrow_io_forecast()"""
new_real_weather_live = """    use_lat = str(lat) if lat is not None else WEATHER_LAT
    use_lon = str(lon) if lon is not None else WEATHER_LON

    # Override with real weather if available
    real_weather = get_tomorrow_io_forecast(use_lat, use_lon)"""
content = content.replace(old_real_weather_live, new_real_weather_live)

# 3. Update get_forecast signature and real_weather call
old_forecast_sig = "def get_forecast():"
new_forecast_sig = "def get_forecast(lat: float = None, lon: float = None):"
content = content.replace(old_forecast_sig, new_forecast_sig)

old_real_weather_forecast = """    # Try fetching real data
    real_weather = get_tomorrow_io_forecast()"""
new_real_weather_forecast = """    use_lat = str(lat) if lat is not None else WEATHER_LAT
    use_lon = str(lon) if lon is not None else WEATHER_LON

    # Try fetching real data
    real_weather = get_tomorrow_io_forecast(use_lat, use_lon)"""
content = content.replace(old_real_weather_forecast, new_real_weather_forecast)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated backend/main.py")
