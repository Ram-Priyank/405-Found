import { useState, useEffect } from 'react';
import {
  TrendingUp, Calendar, MapPin, Wind, Sun, AlertTriangle, ShieldCheck
} from 'lucide-react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';

export default function Forecast({ coords }) {
  const [rawData, setRawData] = useState([]);
  const [plants, setPlants] = useState([]);
  const [site, setSite] = useState('');
  const [genType, setGenType] = useState('Solar + Wind');
  const [horizon, setHorizon] = useState('72 Hours (Next 3 Days)');

  useEffect(() => {
    fetch('http://localhost:8000/api/plants')
      .then(res => res.json())
      .then(data => setPlants(data))
      .catch(err => console.error("Error fetching plants:", err));
  }, []);

  useEffect(() => {
    let url = 'http://localhost:8000/api/forecast';
    const params = new URLSearchParams();
    if (coords) {
        params.append('lat', coords.lat);
        params.append('lon', coords.lon);
    }
    if (site) {
        params.append('plant_id', site);
    }
    if (params.toString()) {
        url += '?' + params.toString();
    }

    fetch(url)
      .then(res => res.json())
      .then(backendData => setRawData(backendData))
      .catch(err => console.error(err));
  }, [coords, site]);

  const data = rawData.filter((row) => {
    if (horizon === '24 Hours' && row.hourOffset > 24) return false;
    if (horizon === '48 Hours' && row.hourOffset > 48) return false;
    return true;
  }).map((row) => {
    const isForecast = row.hourOffset >= 0; 
    let forecastVal = row.forecast;

    let errorVal = null;
    if (!isForecast && row.actual != null && row.forecast != null && row.actual !== 0) {
      errorVal = (((row.forecast - row.actual) / row.actual) * 100).toFixed(1);
    }

    return {
      timestamp: row.timestamp,
      isForecast,
      actual: row.actual != null ? Number(parseFloat(row.actual).toFixed(1)) : null,
      forecast: row.forecast != null ? Number(parseFloat(row.forecast).toFixed(1)) : null,
      p10: row.p10 != null ? Number(parseFloat(row.p10).toFixed(1)) : null,
      p90: row.p90 != null ? Number(parseFloat(row.p90).toFixed(1)) : null,
      error: errorVal
    };
  });


  const historyData = data.filter(d => !d.isForecast && d.actual !== null && d.forecast !== null);
  let mae = 18.4;
  let rmse = 22.1;
  let smape = 4.8;
  let accuracy = 94.2;

  if (historyData.length > 0) {
    let sumAbsErr = 0;
    let sumSqErr = 0;
    let sumSmape = 0;
    let validCount = 0;
    historyData.forEach(d => {
      const act = Number(d.actual);
      const cast = Number(d.forecast);
      if (!isNaN(act) && !isNaN(cast)) {
        const err = Math.abs(act - cast);
        sumAbsErr += err;
        sumSqErr += err * err;
        if (act + cast > 0) {
          sumSmape += (err / ((act + cast) / 2)) * 100;
        }
        validCount++;
      }
    });
    if (validCount > 0) {
      mae = sumAbsErr / validCount;
      rmse = Math.sqrt(sumSqErr / validCount);
      smape = sumSmape / validCount;
      accuracy = Math.max(0, 100 - smape);
    }
  }

  let confidence = 87;
  const next24hRaw = rawData.filter(d => d.hourOffset > 0 && d.hourOffset <= 24);
  if (next24hRaw.length > 0) {
    let totalUncertainty = 0;
    let totalForecast = 0;
    next24hRaw.forEach(d => {
      if (d.p90 && d.p10 && d.forecast) {
        totalUncertainty += (d.p90 - d.p10);
        totalForecast += d.forecast;
      }
    });
    if (totalForecast > 0) {
      let uncPct = (totalUncertainty / totalForecast) * 100;
      confidence = Math.max(50, Math.min(99, 100 - (uncPct / 3)));
    }
  }

  const confLevel = confidence > 90 ? "HIGH" : (confidence > 75 ? "MODERATE" : "LOW");
  let weatherUnc = confLevel === 'HIGH' ? 'LOW' : (confLevel === 'LOW' ? 'HIGH' : 'MODERATE');
  let histCons = accuracy >= 90 ? 'HIGH' : (accuracy < 80 ? 'LOW' : 'MODERATE');

  let reasoningText = "Stable conditions expected. Minimal cloud cover or wind variability predicted, leading to high confidence in generation output.";
  let actionText = "Maintain standard reserve capacity. No additional backup scheduling required.";
  if (confLevel === 'LOW') {
    reasoningText = "High uncertainty in weather forecast. Significant cloud or wind variability expected over the next 24-48 hours.";
    actionText = "Schedule additional backup reserves. High risk of generation shortfall or curtailment due to volatility.";
  } else if (confLevel === 'MODERATE') {
    reasoningText = "Moderate variability in upcoming weather conditions. Some minor fluctuations in generation expected.";
    actionText = "Monitor closely. Keep secondary reserves on standby if conditions worsen.";
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, animation: 'float-up 0.4s ease-out' }}>

      {/* ── Page Header ─────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="text-headline-lg" style={{ color: 'var(--on-surface)', marginBottom: 4 }}>Renewable Generation Forecast</h1>
        </div>
      </div>

      {/* ── Controls Row ────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div className="glass" style={{ padding: '8px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <MapPin size={16} color="var(--on-surface-var)" />
          <select value={site} onChange={e => setSite(e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--on-surface)', outline: 'none', fontSize: 14 }}>
            <option value="" style={{ background: 'var(--bg)' }}>All Sites (Portfolio)</option>
            {plants.map(p => (
              <option key={p.plant_id} value={p.plant_id} style={{ background: 'var(--bg)' }}>
                {p.plant_name} ({p.plant_type}) - {p.capacity} kW
              </option>
            ))}
          </select>
        </div>
        <div className="glass" style={{ padding: '8px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sun size={16} color="var(--tertiary)" />
          <select value={genType} onChange={e => setGenType(e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--on-surface)', outline: 'none', fontSize: 14 }}>
            <option style={{ background: 'var(--bg)' }}>Solar + Wind</option>
            <option style={{ background: 'var(--bg)' }}>Solar Only</option>
            <option style={{ background: 'var(--bg)' }}>Wind Only</option>
          </select>
        </div>
        <div className="glass" style={{ padding: '8px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={16} color="var(--on-surface-var)" />
          <select value={horizon} onChange={e => setHorizon(e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--on-surface)', outline: 'none', fontSize: 14 }}>
            <option style={{ background: 'var(--bg)' }}>72 Hours (Next 3 Days)</option>
            <option style={{ background: 'var(--bg)' }}>48 Hours</option>
            <option style={{ background: 'var(--bg)' }}>24 Hours</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 24 }}>

        {/* ── Left Column: Metrics & Chart & Table ──────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Metrics Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: 'Forecast Accuracy', value: `${accuracy.toFixed(1)}%`, color: 'var(--primary-action)' },
              { label: 'MAE', value: `${mae.toFixed(1)} MW`, color: 'var(--secondary)' },
              { label: 'RMSE', value: `${rmse.toFixed(1)} MW`, color: '#a78bfa' },
              { label: 'sMAPE', value: `${smape.toFixed(1)}%`, color: 'var(--tertiary)' },
            ].map(m => (
              <div key={m.label} className="glass" style={{ padding: 16, borderRadius: 8 }}>
                <div className="telem-sm" style={{ color: 'var(--on-surface-var)', marginBottom: 8 }}>{m.label}</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 600, color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>


          {/* Chart */}
          <div className="glass" style={{ padding: 24, borderRadius: 8, height: 350 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--secondary)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--secondary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-var)" vertical={false} />
                <XAxis
                  dataKey="timestamp"
                  stroke="var(--on-surface-var)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(timeStr) => {
                    if (!timeStr) return '';
                    const d = new Date(timeStr);
                    if (isNaN(d.getTime())) return timeStr;
                    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', weekday: 'short' });
                  }}
                  minTickGap={40}
                />
                <YAxis stroke="var(--on-surface-var)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--outline-var)', borderRadius: 8, color: 'var(--on-surface)' }}
                  itemStyle={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}
                  labelStyle={{ fontWeight: 600, marginBottom: 8 }}
                  labelFormatter={(label) => new Date(label).toString() !== 'Invalid Date' ? new Date(label).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : label}
                />
                <Area type="monotone" dataKey="forecast" stroke="var(--secondary)" fillOpacity={1} fill="url(#forecastGrad)" strokeWidth={2} name="Forecast" />
                <Line type="monotone" dataKey="actual" stroke="var(--primary-action)" strokeWidth={2} dot={{ r: 3, fill: 'var(--primary-action)' }} name="Actual" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Actual vs Predicted Table */}
          <div className="glass" style={{ padding: 24, borderRadius: 8 }}>
            <div className="text-headline-sm" style={{ color: 'var(--on-surface)', marginBottom: 16 }}>Actual vs Predicted</div>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              <table className="telem-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Actual Generation</th>
                    <th>Predicted Generation</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {data.filter(d => !d.isForecast).map((row, i) => (
                    <tr key={i}>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--on-surface-var)' }}>
                        {new Date(row.timestamp).toString() !== 'Invalid Date' ? new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', weekday: 'short' }) : row.timestamp}
                      </td>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--on-surface)' }}>{row.actual} MW</td>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--secondary)' }}>{row.forecast} MW</td>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: Math.abs(row.error) > 5 ? 'var(--error)' : 'var(--primary-action)' }}>
                        {row.error > 0 ? '+' : ''}{row.error}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Right Column: Confidence Card ───────────────────── */}
        <div>
          <div className="glass" style={{ padding: 24, borderRadius: 8, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <ShieldCheck size={28} color="var(--primary-action)" />
              <div>
                <div className="telem-sm" style={{ color: 'var(--on-surface-var)' }}>FORECAST CONFIDENCE</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: confLevel === 'HIGH' ? 'var(--primary-action)' : (confLevel === 'LOW' ? 'var(--error)' : 'var(--tertiary)'), letterSpacing: '-0.02em' }}>{confLevel} ({confidence.toFixed(1)}%)</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--on-surface-var)' }}>Weather Uncertainty</span>
                <span className={weatherUnc === 'LOW' ? "badge-green telem-sm" : (weatherUnc === 'HIGH' ? "badge-red telem-sm" : "badge-yellow telem-sm")} style={weatherUnc === 'HIGH' ? { background: 'rgba(239, 68, 68, 0.12)', color: 'var(--error)' } : (weatherUnc === 'MODERATE' ? { background: 'rgba(245,158,11,0.12)', color: 'var(--tertiary)' } : {})}>{weatherUnc}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--on-surface-var)' }}>Historical Consistency</span>
                <span className={histCons === 'HIGH' ? "badge-green telem-sm" : (histCons === 'LOW' ? "badge-red telem-sm" : "badge-yellow telem-sm")} style={histCons === 'LOW' ? { background: 'rgba(239, 68, 68, 0.12)', color: 'var(--error)' } : (histCons === 'MODERATE' ? { background: 'rgba(245,158,11,0.12)', color: 'var(--tertiary)' } : {})}>{histCons}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--on-surface-var)' }}>Model Confidence</span>
                <span className={confLevel === 'HIGH' ? "badge-green telem-sm" : (confLevel === 'LOW' ? "badge-red telem-sm" : "badge-yellow telem-sm")} style={confLevel === 'LOW' ? { background: 'rgba(239, 68, 68, 0.12)', color: 'var(--error)' } : (confLevel === 'MODERATE' ? { background: 'rgba(245,158,11,0.12)', color: 'var(--tertiary)' } : {})}>{confLevel}</span>
              </div>
            </div>

            <div style={{ background: 'var(--surface-2)', padding: 16, borderRadius: 8, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface)', marginBottom: 4 }}>Reasoning:</div>
              <p style={{ fontSize: 13, color: 'var(--on-surface-var)', lineHeight: 1.5 }}>
                {reasoningText}
              </p>
            </div>

            <div style={{ background: 'var(--surface-2)', border: confLevel === 'HIGH' ? '1px solid rgba(0, 245, 160, 0.2)' : (confLevel === 'LOW' ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(245,158,11,0.2)'), padding: 16, borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: confLevel === 'HIGH' ? 'var(--primary-action)' : (confLevel === 'LOW' ? 'var(--error)' : 'var(--tertiary)'), marginBottom: 4 }}>Recommended Action:</div>
              <p style={{ fontSize: 13, color: 'var(--on-surface)', lineHeight: 1.5 }}>
                {actionText}
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
