import os
import numpy as np
import pandas as pd
import joblib
from datetime import datetime

MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
SOLAR_MODEL_FILE = os.path.join(MODEL_DIR, "solar_model.pkl")
WIND_MODEL_FILE = os.path.join(MODEL_DIR, "wind_model.pkl")

solar_model = None
wind_model = None

try:
    if os.path.exists(SOLAR_MODEL_FILE):
        solar_model = joblib.load(SOLAR_MODEL_FILE)
    if os.path.exists(WIND_MODEL_FILE):
        wind_model = joblib.load(WIND_MODEL_FILE)
except Exception as e:
    print(f"Error loading models: {e}")

def get_ml_prediction(plant_type: str, capacity: float, dt: datetime, cloud_cover: float, wind_speed: float):
    model = solar_model if plant_type == 'SOLAR' else wind_model
    if model is None:
        raise ValueError(f"ML model for {plant_type} is not loaded.")
        
    hour_of_day = dt.hour
    month_of_year = dt.month
    
    if plant_type == 'SOLAR':
        X = pd.DataFrame([[hour_of_day, month_of_year, cloud_cover]], columns=['hour', 'month', 'cloud_cover'])
        pred = model.predict(X)[0]
        # scale based on max trained which is 5000
        scaled_pred = (pred / 5000.0) * capacity
        return scaled_pred
    else:
        X = pd.DataFrame([[hour_of_day, month_of_year, wind_speed]], columns=['hour', 'month', 'wind_speed'])
        pred = model.predict(X)[0]
        # scale based on max trained which is 4000
        scaled_pred = (pred / 4000.0) * capacity
        return scaled_pred
