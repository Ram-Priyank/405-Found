import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
import joblib
import os

print("Generating synthetic energy data for training...")

# Generate 1 year of hourly data
np.random.seed(42)
hours = 365 * 24
time = np.arange(hours)

# Synthetic features
hour_of_day = time % 24
month_of_year = (time // (24 * 30)) % 12 + 1

# Weather features
cloud_cover = np.clip(np.random.normal(50, 20, hours), 0, 100) # 0 to 100%
wind_speed = np.clip(np.random.normal(6, 3, hours), 0, 25) # 0 to 25 m/s

# Target: Solar Generation (peaks at noon, zero at night, reduced by clouds)
solar_base = np.clip(np.sin(np.pi * (hour_of_day - 6) / 12), 0, 1)
solar_gen = solar_base * 5000 * (1 - cloud_cover / 150) + np.random.normal(0, 100, hours)
solar_gen = np.clip(solar_gen, 0, None)

# Target: Wind Generation (depends on wind speed cubically, capped at max capacity)
wind_gen = np.clip(0.5 * 1.225 * (wind_speed ** 3) * 0.4 * 50, 0, 4000) + np.random.normal(0, 200, hours)
wind_gen = np.clip(wind_gen, 0, None)

df = pd.DataFrame({
    'hour': hour_of_day,
    'month': month_of_year,
    'cloud_cover': cloud_cover,
    'wind_speed': wind_speed,
    'solar_gen': solar_gen,
    'wind_gen': wind_gen
})

print("Training Solar Model...")
features = ['hour', 'month', 'cloud_cover']
X_solar = df[features]
y_solar = df['solar_gen']
solar_model = RandomForestRegressor(n_estimators=50, max_depth=10, random_state=42)
solar_model.fit(X_solar, y_solar)

print("Training Wind Model...")
features_wind = ['hour', 'month', 'wind_speed']
X_wind = df[features_wind]
y_wind = df['wind_gen']
wind_model = RandomForestRegressor(n_estimators=50, max_depth=10, random_state=42)
wind_model.fit(X_wind, y_wind)

# Ensure models directory exists
os.makedirs('models', exist_ok=True)

# Save models
joblib.dump(solar_model, 'models/solar_model.pkl')
joblib.dump(wind_model, 'models/wind_model.pkl')

print("Models trained and saved successfully to models/ directory.")
