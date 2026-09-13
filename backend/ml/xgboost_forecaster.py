import os
import numpy as np
import pandas as pd
import datetime
import warnings

# Temporarily suppress warnings for cleaner output
warnings.filterwarnings("ignore")

from xgboost import XGBRegressor

MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")

# ================================================================
# FEATURE CONFIGURATION
# ================================================================
FEATURES = [
    "capacity_kw", "hour", "day_of_week", "day_of_year", "month",
    "is_weekend", "hour_sin", "hour_cos", "day_sin", "day_cos",
    "generation_lag_1", "generation_lag_2", "generation_lag_3",
    "generation_lag_6", "generation_lag_12", "generation_lag_24",
    "generation_lag_48", "generation_lag_72",
    "rolling_mean_3h", "rolling_mean_6h", "rolling_mean_12h",
    "rolling_mean_24h", "rolling_std_24h"
]

# ================================================================
# MODEL LOADING
# ================================================================
models_loaded = False
models = {"solar": {}, "wind": {}}

def load_models():
    global models_loaded
    if models_loaded: return
    
    files = {
        "solar": {
            "lower": "overall_solar_lower_model.json",
            "expected": "overall_solar_expected_model.json",
            "upper": "overall_solar_upper_model.json"
        },
        "wind": {
            "lower": "overall_wind_lower_model.json",
            "expected": "overall_wind_expected_model.json",
            "upper": "overall_wind_upper_model.json"
        }
    }
    
    try:
        for r_type in ["solar", "wind"]:
            for q_name in ["lower", "expected", "upper"]:
                path = os.path.join(MODEL_DIR, files[r_type][q_name])
                if os.path.exists(path):
                    model = XGBRegressor()
                    model.load_model(path)
                    models[r_type][q_name] = model
                else:
                    print(f"Warning: {path} not found.")
        models_loaded = True
        print("XGBoost JSON models loaded successfully.")
    except Exception as e:
        print(f"Failed to load XGBoost models: {e}")

# ================================================================
# FAKE HISTORY GENERATOR (Since we don't have the 72h CSV)
# ================================================================
def get_simulated_history(solar_capacity, wind_capacity):
    # Align to current hour
    now = pd.Timestamp(datetime.datetime.utcnow().replace(minute=0, second=0, microsecond=0))
    timestamps = pd.date_range(end=now, periods=72, freq='h')
    
    solar_history = []
    wind_history = []
    
    for dt in timestamps:
        local_hour = (dt.hour + dt.minute / 60.0 + 5.5) % 24
        # Diurnal solar curve
        if 6 <= local_hour <= 19:
            gen_solar = solar_capacity * np.sin(np.pi * (local_hour - 6) / 13) * 0.75
        else:
            gen_solar = 0.0
            
        # Semi-random wind curve
        gen_wind = wind_capacity * 0.4 + np.random.normal(0, wind_capacity * 0.1)
        gen_wind = max(0, min(gen_wind, wind_capacity))
        
        solar_history.append({"timestamp": dt, "generation_kwh": gen_solar, "capacity_kw": solar_capacity, "plant_type": "solar"})
        wind_history.append({"timestamp": dt, "generation_kwh": gen_wind, "capacity_kw": wind_capacity, "plant_type": "wind"})
        
    return pd.DataFrame(solar_history), pd.DataFrame(wind_history)


# ================================================================
# 24 HOUR ITERATIVE FORECAST
# ================================================================
def generate_24h_portfolio_forecast(solar_capacity, wind_capacity):
    load_models()
    if not models_loaded or "expected" not in models["solar"]:
        raise ValueError("XGBoost models are not available.")
        
    solar_working, wind_working = get_simulated_history(solar_capacity, wind_capacity)
    
    last_timestamp = max(solar_working["timestamp"].max(), wind_working["timestamp"].max())
    future_timestamps = pd.date_range(start=last_timestamp + pd.Timedelta(hours=1), periods=24, freq="h")
    
    predictions = []
    
    for future_time in future_timestamps:
        
        # --------------------------------------------------------
        # Process Solar
        # --------------------------------------------------------
        solar_temp = pd.concat([
            solar_working, 
            pd.DataFrame({"timestamp": [future_time], "generation_kwh": [np.nan], "capacity_kw": [solar_capacity], "plant_type": ["solar"]})
        ], ignore_index=True)
        
        # Shift UTC timestamp to IST (+5.5h) before extracting hour features for the model
        ist_timestamp = solar_temp["timestamp"] + pd.Timedelta(hours=5.5)
        solar_temp["hour"] = ist_timestamp.dt.hour
        solar_temp["day_of_week"] = ist_timestamp.dt.dayofweek
        solar_temp["day_of_year"] = ist_timestamp.dt.dayofyear
        solar_temp["month"] = ist_timestamp.dt.month
        solar_temp["is_weekend"] = (solar_temp["day_of_week"] >= 5).astype(int)
        
        solar_temp["hour_sin"] = np.sin(2 * np.pi * solar_temp["hour"] / 24)
        solar_temp["hour_cos"] = np.cos(2 * np.pi * solar_temp["hour"] / 24)
        solar_temp["day_sin"] = np.sin(2 * np.pi * solar_temp["day_of_year"] / 365)
        solar_temp["day_cos"] = np.cos(2 * np.pi * solar_temp["day_of_year"] / 365)
        
        target_index = len(solar_temp) - 1
        solar_values = solar_temp["generation_kwh"].to_numpy()
        
        for lag in [1, 2, 3, 6, 12, 24, 48, 72]:
            solar_temp.loc[target_index, f"generation_lag_{lag}"] = solar_values[target_index - lag]
            
        historical = solar_temp["generation_kwh"].iloc[:-1].dropna()
        solar_temp.loc[target_index, "rolling_mean_3h"] = historical.tail(3).mean()
        solar_temp.loc[target_index, "rolling_mean_6h"] = historical.tail(6).mean()
        solar_temp.loc[target_index, "rolling_mean_12h"] = historical.tail(12).mean()
        solar_temp.loc[target_index, "rolling_mean_24h"] = historical.tail(24).mean()
        solar_temp.loc[target_index, "rolling_std_24h"] = historical.tail(24).std()
        
        solar_X = solar_temp.iloc[[target_index]][FEATURES]
        
        # Predict Ratios
        solar_lower_ratio = float(models["solar"]["lower"].predict(solar_X)[0])
        solar_expected_ratio = float(models["solar"]["expected"].predict(solar_X)[0])
        solar_upper_ratio = float(models["solar"]["upper"].predict(solar_X)[0])
        
        solar_lower = max(0, solar_lower_ratio * solar_capacity)
        solar_expected = max(0, solar_expected_ratio * solar_capacity)
        solar_upper = max(0, solar_upper_ratio * solar_capacity)
        
        solar_lower, solar_expected, solar_upper = sorted([solar_lower, solar_expected, solar_upper])
        
        local_hour = (future_time.hour + future_time.minute / 60.0 + 5.5) % 24
        if local_hour < 6 or local_hour > 19:
            solar_lower = solar_expected = solar_upper = 0.0
            
        # --------------------------------------------------------
        # Process Wind
        # --------------------------------------------------------
        wind_temp = pd.concat([
            wind_working, 
            pd.DataFrame({"timestamp": [future_time], "generation_kwh": [np.nan], "capacity_kw": [wind_capacity], "plant_type": ["wind"]})
        ], ignore_index=True)
        
        # Shift UTC timestamp to IST (+5.5h) before extracting hour features for the model
        ist_timestamp = wind_temp["timestamp"] + pd.Timedelta(hours=5.5)
        wind_temp["hour"] = ist_timestamp.dt.hour
        wind_temp["day_of_week"] = ist_timestamp.dt.dayofweek
        wind_temp["day_of_year"] = ist_timestamp.dt.dayofyear
        wind_temp["month"] = ist_timestamp.dt.month
        wind_temp["is_weekend"] = (wind_temp["day_of_week"] >= 5).astype(int)
        
        wind_temp["hour_sin"] = np.sin(2 * np.pi * wind_temp["hour"] / 24)
        wind_temp["hour_cos"] = np.cos(2 * np.pi * wind_temp["hour"] / 24)
        wind_temp["day_sin"] = np.sin(2 * np.pi * wind_temp["day_of_year"] / 365)
        wind_temp["day_cos"] = np.cos(2 * np.pi * wind_temp["day_of_year"] / 365)
        
        target_index = len(wind_temp) - 1
        wind_values = wind_temp["generation_kwh"].to_numpy()
        
        for lag in [1, 2, 3, 6, 12, 24, 48, 72]:
            wind_temp.loc[target_index, f"generation_lag_{lag}"] = wind_values[target_index - lag]
            
        historical = wind_temp["generation_kwh"].iloc[:-1].dropna()
        wind_temp.loc[target_index, "rolling_mean_3h"] = historical.tail(3).mean()
        wind_temp.loc[target_index, "rolling_mean_6h"] = historical.tail(6).mean()
        wind_temp.loc[target_index, "rolling_mean_12h"] = historical.tail(12).mean()
        wind_temp.loc[target_index, "rolling_mean_24h"] = historical.tail(24).mean()
        wind_temp.loc[target_index, "rolling_std_24h"] = historical.tail(24).std()
        
        wind_X = wind_temp.iloc[[target_index]][FEATURES]
        
        wind_lower_ratio = float(models["wind"]["lower"].predict(wind_X)[0])
        wind_expected_ratio = float(models["wind"]["expected"].predict(wind_X)[0])
        wind_upper_ratio = float(models["wind"]["upper"].predict(wind_X)[0])
        
        wind_lower = max(0, wind_lower_ratio * wind_capacity)
        wind_expected = max(0, wind_expected_ratio * wind_capacity)
        wind_upper = max(0, wind_upper_ratio * wind_capacity)
        
        wind_lower, wind_expected, wind_upper = sorted([wind_lower, wind_expected, wind_upper])
        
        # --------------------------------------------------------
        # Record Prediction & Append Expected to History
        # --------------------------------------------------------
        predictions.append({
            "timestamp": future_time.isoformat(),
            "solar_lower": round(solar_lower, 2),
            "solar_expected": round(solar_expected, 2),
            "solar_upper": round(solar_upper, 2),
            "wind_lower": round(wind_lower, 2),
            "wind_expected": round(wind_expected, 2),
            "wind_upper": round(wind_upper, 2),
        })
        
        solar_working = pd.concat([solar_working, pd.DataFrame({"timestamp": [future_time], "generation_kwh": [solar_expected], "capacity_kw": [solar_capacity], "plant_type": ["solar"]})], ignore_index=True)
        wind_working = pd.concat([wind_working, pd.DataFrame({"timestamp": [future_time], "generation_kwh": [wind_expected], "capacity_kw": [wind_capacity], "plant_type": ["wind"]})], ignore_index=True)
        
    return predictions
