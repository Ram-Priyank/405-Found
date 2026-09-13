import math
import random

def calculate_risk(forecast_uncertainty, plant_availability, battery_soc, grid_capacity, demand_peak, renewable_coverage):
    # Rule-based explainable risk score (0-100)
    score = 0
    reasons = []
    
    # Example weights as per PDF
    if forecast_uncertainty > 0.2:
        score += 25
        reasons.append("High forecast uncertainty")
        
    if plant_availability < 0.9:
        score += 10
        reasons.append("Plant availability below 90%")
        
    if renewable_coverage < 0.6:
        score += 20
        reasons.append("Renewable coverage below 60%")
        
    if demand_peak > grid_capacity * 0.8:
        score += 25
        reasons.append("Evening demand peak threatens grid capacity")
        
    if battery_soc < 0.2:
        score += 20
        reasons.append("Battery SOC projected below reserve")
        
    risk_level = "LOW"
    if score > 30: risk_level = "MEDIUM"
    if score > 60: risk_level = "HIGH"
    if score > 80: risk_level = "CRITICAL"
    
    return min(score, 100), risk_level, reasons

def optimize_schedule(forecast_data, overrides=None):
    if overrides is None:
        overrides = {}
        
    solar_mod = overrides.get("solar_modifier", 1.0)
    demand_mod = overrides.get("demand_modifier", 1.0)
    batt_enabled = overrides.get("battery_enabled", True)
    grid_cap_mod = overrides.get("grid_capacity_modifier", 1.0)
    scenario_type = overrides.get("scenario", "profit") # profit, carbon, grid, normal

    # Configuration limits
    BATTERY_CAPACITY_KWH = 2000
    MAX_CHARGE_POWER_KW = 500
    MAX_DISCHARGE_POWER_KW = 500
    GRID_CAPACITY_KW = 2500 * grid_cap_mod
    
    current_soc = BATTERY_CAPACITY_KWH * 0.5 # start at 50%
    
    # 1. Flexible Loads (Mock data for Load Shifting)
    # We assume a 150 kW load is originally scheduled at hour 18 (index 18)
    flexible_loads = [
        {"power_kw": 150, "original_hour": 18, "allowed_window": (10, 18), "shifted_to": 18}
    ]
    
    # 2. Extract and modify forecast data
    hours = []
    total_renewable_available = 0
    total_demand_original = 0
    
    for i, f in enumerate(forecast_data[:24]):
        solar = f.get("solar_expected", 0) * 2 * solar_mod
        wind = f.get("wind_expected", 0) * 2
        demand = f.get("demand", 400) * demand_mod
        
        hours.append({
            "hour": i,
            "timestamp": f.get("timestamp"),
            "solar": solar,
            "wind": wind,
            "renewable": solar + wind,
            "original_demand": demand,
            "demand": demand,
            "price": 50 + math.sin(math.pi * (i - 12) / 12) * 20 + (50 if 17 <= i <= 21 else 0) # price spike in evening
        })
        total_renewable_available += (solar + wind)
        total_demand_original += demand

    # 3. Load Shifting Engine
    # Find the hour with highest surplus or lowest price in the allowed window
    shifted_load_kwh = 0
    for load in flexible_loads:
        orig = load["original_hour"]
        start, end = load["allowed_window"]
        
        # Determine best hour
        best_hour = orig
        best_score = float('-inf')
        
        for h in range(start, end + 1):
            if h < len(hours):
                surplus = hours[h]["renewable"] - hours[h]["demand"]
                # In 'carbon' scenario, prioritize max surplus. In 'profit', prioritize min price.
                score = surplus if scenario_type == "carbon" else -hours[h]["price"]
                if score > best_score:
                    best_score = score
                    best_hour = h
                    
        if best_hour != orig:
            hours[orig]["demand"] -= load["power_kw"]
            hours[best_hour]["demand"] += load["power_kw"]
            load["shifted_to"] = best_hour
            shifted_load_kwh += load["power_kw"]

    # 4. Energy Balance & Battery/Grid Optimization Engine
    results = []
    total_renewable_used = 0
    total_battery_charge = 0
    total_battery_discharge = 0
    total_grid_import = 0
    peak_grid_demand = 0
    total_curtailment = 0

    for h in hours:
        demand = h["demand"]
        renewable = h["renewable"]
        
        renewable_used = min(renewable, demand)
        surplus = max(0, renewable - demand)
        deficit = max(0, demand - renewable)
        
        batt_charge = 0
        batt_discharge = 0
        grid_import = 0
        grid_export = 0
        curtailed = 0
        
        if not batt_enabled:
            # Battery off
            grid_import = deficit
            grid_export = surplus
        else:
            # Battery logic based on scenario
            if surplus > 0:
                # Charge battery
                space_available = BATTERY_CAPACITY_KWH - current_soc
                batt_charge = min(surplus, MAX_CHARGE_POWER_KW, space_available)
                current_soc += batt_charge
                grid_export = surplus - batt_charge
            elif deficit > 0:
                # Discharge battery
                energy_available = current_soc - (BATTERY_CAPACITY_KWH * 0.1) # 10% min reserve
                
                # In grid scenario, reserve more battery
                if scenario_type == "grid":
                    energy_available = current_soc - (BATTERY_CAPACITY_KWH * 0.3)
                    
                # In profit scenario, don't discharge if price is low, wait for peak
                if scenario_type == "profit" and h["price"] < 60 and h["hour"] < 17:
                    batt_discharge = 0
                else:
                    batt_discharge = min(deficit, MAX_DISCHARGE_POWER_KW, max(0, energy_available))
                
                current_soc -= batt_discharge
                grid_import = deficit - batt_discharge

        # Apply grid capacity constraints (curtailment)
        if grid_export > GRID_CAPACITY_KW:
            curtailed = grid_export - GRID_CAPACITY_KW
            grid_export = GRID_CAPACITY_KW
            
        total_renewable_used += renewable_used
        total_battery_charge += batt_charge
        total_battery_discharge += batt_discharge
        total_grid_import += grid_import
        total_curtailment += curtailed
        peak_grid_demand = max(peak_grid_demand, grid_import)
        
        results.append({
            "time": f"{h['hour']:02d}:00",
            "timestamp": h["timestamp"],
            "solar": h["solar"],
            "wind": h["wind"],
            "renewable": h["renewable"],
            "demand": demand,
            "original_demand": h["original_demand"],
            "energy_balance": surplus - deficit,
            "surplus": surplus,
            "deficit": deficit,
            "battery_soc": current_soc / BATTERY_CAPACITY_KWH * 100,
            "battery_charge": batt_charge,
            "battery_discharge": batt_discharge,
            "grid_import": grid_import,
            "grid_export": grid_export,
            "curtailed": curtailed,
            "price": h["price"],
            "action": "Discharge" if batt_discharge > 0 else "Charge" if batt_charge > 0 else "Idle"
        })

    # Calculate baseline grid import for summary
    baseline_grid_import = sum(max(0, h["original_demand"] - h["renewable"]) for h in hours)
    grid_reduction_pct = ((baseline_grid_import - total_grid_import) / max(1, baseline_grid_import)) * 100

    # 5. Risk Engine
    forecast_uncertainty = 0.15 # Mocked base uncertainty
    if solar_mod != 1.0 or demand_mod != 1.0: forecast_uncertainty = 0.25
    
    plant_availability = 0.95
    avg_soc = (sum(r["battery_soc"] for r in results) / 24) / 100
    if not batt_enabled: avg_soc = 0
    
    renewable_coverage = total_renewable_used / max(1, sum(h["demand"] for h in hours))
    
    risk_score, risk_level, risk_reasons = calculate_risk(
        forecast_uncertainty, plant_availability, avg_soc, GRID_CAPACITY_KW, peak_grid_demand, renewable_coverage
    )

    # 6. Recommendation Engine
    recommendations = []
    
    if len(flexible_loads) > 0 and flexible_loads[0]["shifted_to"] != flexible_loads[0]["original_hour"]:
        load = flexible_loads[0]
        recommendations.append({
            "action": "Load Shifting",
            "time": f"{load['shifted_to']:02d}:00",
            "quantity": f"{load['power_kw']} kW",
            "reason": f"Moved from {load['original_hour']:02d}:00 to align with high renewable/low price.",
            "priority": "High",
            "expected_impact": "Reduces peak grid demand."
        })
        
    if batt_enabled and scenario_type == "profit":
        recommendations.append({
            "action": "Schedule BESS Discharge",
            "time": "18:00 - 20:00",
            "quantity": f"{MAX_DISCHARGE_POWER_KW} kW",
            "reason": "Maximize revenue during evening price surge.",
            "priority": "High",
            "expected_impact": "Increases arbitrage revenue."
        })
    elif batt_enabled and scenario_type == "grid":
        recommendations.append({
            "action": "Reserve Battery Capacity",
            "time": "All Day",
            "quantity": "30% SOC",
            "reason": "Support grid voltage/frequency due to utility signals.",
            "priority": "Critical",
            "expected_impact": "Avoids stability penalties."
        })
        
    if risk_level in ["HIGH", "CRITICAL"]:
        recommendations.append({
            "action": "Alert Operations",
            "time": "Evening Peak",
            "quantity": "-",
            "reason": "High risk of grid dependency. Prepare emergency generators.",
            "priority": "Critical",
            "expected_impact": "Mitigates blackout risk."
        })

    summary = {
        "total_renewable_available": round(total_renewable_available / 1000, 2), # MWh
        "renewable_directly_used": round(total_renewable_used / 1000, 2),
        "renewable_utilization_pct": round((total_renewable_used / max(1, total_renewable_available)) * 100, 1),
        "total_demand": round(sum(h["demand"] for h in hours) / 1000, 2),
        "battery_discharge": round(total_battery_discharge / 1000, 2),
        "battery_charge": round(total_battery_charge / 1000, 2),
        "grid_import_before_optimization": round(baseline_grid_import / 1000, 2),
        "grid_import_after_optimization": round(total_grid_import / 1000, 2),
        "grid_reduction_pct": round(grid_reduction_pct, 1),
        "peak_grid_demand": round(peak_grid_demand, 2),
        "risk_score": risk_score,
        "risk_level": risk_level,
        "risk_contributors": risk_reasons
    }

    return {
        "schedule": results,
        "summary": summary,
        "recommendations": recommendations,
        "radar_data": generate_radar_data(scenario_type, summary),
        "explanation": get_explanation(scenario_type)
    }

def generate_radar_data(scenario, summary):
    # Generates data for the Radar chart based on the optimization result and scenario
    base = [
        {"subject": "Profit", "A": 50},
        {"subject": "Ren Util", "A": 60},
        {"subject": "Grid Support", "A": 40},
        {"subject": "Carbon Reduction", "A": 65},
        {"subject": "Battery Life", "A": 80}
    ]
    
    # Modify "B" (optimized) values depending on scenario
    if scenario == "profit":
        b_vals = [95, 65, 55, 50, 60]
    elif scenario == "carbon":
        b_vals = [60, 95, 40, 100, 75]
    elif scenario == "grid":
        b_vals = [45, 70, 95, 60, 85]
    else: # normal
        b_vals = [70, 75, 60, 70, 70]
        
    for i, item in enumerate(base):
        item["B"] = b_vals[i]
        
    return base

def get_explanation(scenario):
    if scenario == "profit":
        return "By discharging the BESS during the evening peak (18:00 - 20:00) when prices are expected to surge, we maximize revenue. Remaining solar is shifted instead of curtailed."
    elif scenario == "carbon":
        return "Bypassing grid export entirely, we route all excess solar into storage. Load shifting is aggressively used to ensure industrial processes run entirely on green energy."
    elif scenario == "grid":
        return "The utility has signaled a potential voltage sag. Reserving extra BESS capacity for frequency response rather than arbitrage supports the grid and avoids penalties."
    return "Baseline optimization ensuring stable energy supply with standard battery and load management."
