import os
import re

app_path = r"c:\Users\priya\Desktop\Hackout'26\frontend\src\App.jsx"
dashboard_path = r"c:\Users\priya\Desktop\Hackout'26\frontend\src\pages\Dashboard.jsx"
dt_path = r"c:\Users\priya\Desktop\Hackout'26\frontend\src\pages\DigitalTwin.jsx"

# 1. Update App.jsx
with open(app_path, 'r', encoding='utf-8') as f:
    app_content = f.read()

if "const [coords, setCoords]" not in app_content:
    old_state = """  const [userRole, setUserRole] = useState(null);
  const [theme, setTheme] = useState('dark');"""
    new_state = """  const [userRole, setUserRole] = useState(null);
  const [theme, setTheme] = useState('dark');
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    if (userRole && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        (err) => console.warn('Geolocation error:', err)
      );
    }
  }, [userRole]);"""
    app_content = app_content.replace(old_state, new_state)

    old_routes = """            <Route path="/"              element={<Dashboard userRole={userRole} />}   />
            <Route path="/forecast"      element={<Forecast />}    />
            <Route path="/risk"          element={<RiskAlerts />}  />
            <Route path="/digital-twin"  element={<DigitalTwin />} />
            <Route path="/optimization"  element={<Optimization />} />
            <Route path="/analytics"     element={<Analytics />}   />"""
    new_routes = """            <Route path="/"              element={<Dashboard userRole={userRole} coords={coords} />}   />
            <Route path="/forecast"      element={<Forecast />}    />
            <Route path="/risk"          element={<RiskAlerts />}  />
            <Route path="/digital-twin"  element={<DigitalTwin coords={coords} />} />
            <Route path="/optimization"  element={<Optimization />} />
            <Route path="/analytics"     element={<Analytics />}   />"""
    app_content = app_content.replace(old_routes, new_routes)

    with open(app_path, 'w', encoding='utf-8') as f:
        f.write(app_content)
    print("Updated App.jsx")

# 2. Update Dashboard.jsx
with open(dashboard_path, 'r', encoding='utf-8') as f:
    dash_content = f.read()

if "coords" not in dash_content.split("function Dashboard(")[1].split(")")[0]:
    dash_content = dash_content.replace("export default function Dashboard({ userRole }) {", "export default function Dashboard({ userRole, coords }) {")
    
    # fetch forecast
    old_fetch_forecast = "fetch('http://localhost:8000/api/forecast')"
    new_fetch_forecast = "fetch(`http://localhost:8000/api/forecast${coords ? `?lat=${coords.lat}&lon=${coords.lon}` : ''}`)"
    dash_content = dash_content.replace(old_fetch_forecast, new_fetch_forecast)

    # fetch live
    old_fetch_live = "fetch('http://localhost:8000/api/telemetry/live?solarCap=320&windCap=150&baseDemand=260')"
    new_fetch_live = "fetch(`http://localhost:8000/api/telemetry/live?solarCap=320&windCap=150&baseDemand=260${coords ? `&lat=${coords.lat}&lon=${coords.lon}` : ''}`)"
    dash_content = dash_content.replace(old_fetch_live, new_fetch_live)

    with open(dashboard_path, 'w', encoding='utf-8') as f:
        f.write(dash_content)
    print("Updated Dashboard.jsx")

# 3. Update DigitalTwin.jsx
with open(dt_path, 'r', encoding='utf-8') as f:
    dt_content = f.read()

if "coords" not in dt_content.split("function DigitalTwin(")[1].split(")")[0]:
    dt_content = dt_content.replace("export default function DigitalTwin() {", "export default function DigitalTwin({ coords }) {")
    
    old_fetch_dt = "const res = await fetch(`http://localhost:8000/api/telemetry/live?solarCap=${solarCap}&windCap=${windCap}&baseDemand=${baseDemand}`);"
    new_fetch_dt = "const res = await fetch(`http://localhost:8000/api/telemetry/live?solarCap=${solarCap}&windCap=${windCap}&baseDemand=${baseDemand}${coords ? `&lat=${coords.lat}&lon=${coords.lon}` : ''}`);"
    dt_content = dt_content.replace(old_fetch_dt, new_fetch_dt)

    with open(dt_path, 'w', encoding='utf-8') as f:
        f.write(dt_content)
    print("Updated DigitalTwin.jsx")
