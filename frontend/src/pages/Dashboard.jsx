import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Zap, Cloud, Activity, ArrowRight,
  TrendingUp, TrendingDown, Minus, ShieldAlert,
  BatteryCharging, Link
} from 'lucide-react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from 'recharts';


// ──────────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  // Find if this is a forecast or actual point
  const isForecast = payload.some(p => p.dataKey === 'forecast' && p.value !== null);

  return (
    <div className="glass-modal" style={{ padding: '12px 16px', minWidth: 200 }}>
      <div className="telem-sm" style={{ color: 'var(--on-surface-var)', marginBottom: 12, borderBottom: '1px solid rgba(132,149,136,0.3)', paddingBottom: 6 }}>
        TIME: {label}
      </div>

      {payload.map((p, i) => {
        if (p.value === null) return null;
        if (Array.isArray(p.value) && p.value[0] == null) return null;

        let name = p.name;
        if (p.dataKey === 'p10') name = 'P10 (Low Bound)';
        if (p.dataKey === 'p90') name = 'P90 (High Bound)';

        let displayValue;
        if (Array.isArray(p.value)) {
          displayValue = `${p.value[0].toFixed(1)} – ${p.value[1].toFixed(1)}`;
          if (!name) name = 'Uncertainty Range';
        } else {
          displayValue = p.value?.toFixed(1);
        }

        return (
          <div key={p.dataKey || i} style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 6, alignItems: 'center' }}>
            <span style={{ color: p.color, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>{name}</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 600, color: 'var(--on-surface)', fontVariantNumeric: 'tabular-nums' }}>
              {displayValue} <span style={{ fontSize: 9, color: 'var(--on-surface-var)' }}>MW</span>
            </span>
          </div>
        );
      })}

      {payload[0]?.payload?.solar_expected !== undefined && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(132,149,136,0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: 'var(--primary)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>Solar Expected</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--on-surface)' }}>{payload[0].payload.solar_expected.toFixed(1)} MW</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--secondary)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>Wind Expected</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--on-surface)' }}>{payload[0].payload.wind_expected.toFixed(1)} MW</span>
          </div>
        </div>
      )}
      {isForecast && (() => {
        const f = payload.find(p => p.dataKey === 'forecast')?.value || 0;
        const d = payload.find(p => p.dataKey === 'demand')?.value || 1;
        const risk = f > d * 1.5 ? "HIGH" : (f > d * 1.2 ? "MODERATE" : "LOW");
        const riskColor = risk === "HIGH" ? "var(--error)" : (risk === "MODERATE" ? "var(--tertiary)" : "var(--primary-action)");
        
        return (
          <div style={{ marginTop: 12, paddingTop: 8, borderTop: `1px solid ${riskColor}`, display: 'flex', justifyContent: 'space-between', opacity: 0.8 }}>
            <span className="telem-sm" style={{ color: riskColor }}>OVER-GEN RISK:</span>
            <span className="telem-sm" style={{ color: riskColor, fontWeight: 700 }}>{risk}</span>
          </div>
        );
      })()}
    </div>
  );
};

function KpiCard({ title, value, subtext, icon: Icon, color, bg }) {
  return (
    <div className="glass metric-card" style={{ borderRadius: 8 }}>
      <div style={{
        position: 'absolute', right: -16, top: -16,
        width: 80, height: 80, borderRadius: '50%',
        background: bg, filter: 'blur(28px)',
        opacity: 0.5, pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="telem-sm" style={{ color: 'var(--on-surface-var)' }}>{title}</div>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: bg, border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={16} color={color} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 28, fontWeight: 600, color: 'var(--on-surface)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
          {value}
        </span>
      </div>

      {subtext && (
        <div className="telem-sm" style={{ color: color, marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
          {subtext}
        </div>
      )}
    </div>
  );
}

export default function Dashboard({ userRole, coords }) {
  const [data, setData] = useState([]);
  const [liveData, setLiveData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch forecast once
    fetch(`http://localhost:8000/api/forecast${coords ? `?lat=${coords.lat}&lon=${coords.lon}` : ''}`)
      .then(res => res.json())
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch forecast:", err);
        setLoading(false);
      });

    // Poll live telemetry for KPI cards
    const fetchLive = () => {
      fetch(`http://localhost:8000/api/telemetry/live?solarCap=320&windCap=150&baseDemand=260${coords ? `&lat=${coords.lat}&lon=${coords.lon}` : ''}`)
        .then(res => res.json())
        .then(json => setLiveData(json))
        .catch(err => console.error(err));
    };
    fetchLive();
    const id = setInterval(fetchLive, 2000);
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 48, height: 48, border: '2px solid rgba(0, 245, 160, 0.2)', borderTop: '2px solid #00f5a0', borderRadius: '50%' }} className="animate-spin-slow" />
        <span className="telem-sm" style={{ color: 'var(--on-surface-var)' }}>LOADING INTELLIGENCE…</span>
      </div>
    );
  }

  const foundIndex = data.findIndex(d => d.hourOffset === 0);
  const currentIndex = foundIndex >= 0 ? foundIndex : 0;
  const currentData = data[currentIndex] || {};

  // Calculate 24h expected generation (sum of next 24 forecast hours)
  const next24h = data.slice(currentIndex, currentIndex + 24);
  const expectedGenMWh = next24h.reduce((sum, d) => sum + (d.forecast || 0), 0);
  const expectedGenGWh = (expectedGenMWh / 1000).toFixed(2);

  // Live KPI Math
  const liveRenewable = liveData ? (liveData.solar + liveData.wind) : 0;
  const liveDemand = liveData ? liveData.demand : 1;
  // Calculate what percentage of the grid's demand is being met by renewables
  const utilPct = Math.min(100, (liveRenewable / (liveDemand || 1)) * 100);
  const gridDep = liveRenewable < liveDemand ? ((liveDemand - liveRenewable) / liveDemand) * 100 : 0;
  const risk = liveRenewable > liveDemand * 1.5 ? "HIGH" : (liveRenewable > liveDemand * 1.2 ? "MODERATE" : "LOW");

  let confidence = 87;
  if (next24h.length > 0) {
    let totalUncertainty = 0;
    let totalForecast = 0;
    next24h.forEach(d => {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, animation: 'float-up 0.4s ease-out' }}>

      {/* ── Page Header ─────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="text-headline-lg" style={{ color: 'var(--on-surface)', marginBottom: 4 }}>
            {userRole?.id === 'plant_owner' ? 'Asset Overview: Generation & Curtailment' :
              userRole?.id === 'utility' ? 'Portfolio Overview: Supply vs Demand' :
                'System Overview: Macro Grid Health'}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="badge-green telem-sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span className="live-dot" /> SYSTEM HEALTHY
          </div>
        </div>
      </div>

      {/* ── KPI Cards (PRD Requirements) ──────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <KpiCard
          title="CURRENT RENEWABLE"
          value={`${liveRenewable.toFixed(1)} MWh`}
          icon={Zap} color="var(--primary-action)" bg="rgba(0,245,160,0.12)"
          subtext={<><TrendingUp size={12} /> {liveData?.solar.toFixed(0)} Solar / {liveData?.wind.toFixed(0)} Wind</>}
        />
        <KpiCard
          title="NEXT 24H FORECAST"
          value={`${expectedGenGWh} GWh`}
          icon={Cloud} color="var(--secondary)" bg="rgba(76,215,246,0.12)"
          subtext={<><Activity size={12} /> EXPECTED GENERATION</>}
        />
        <KpiCard
          title="RENEWABLE UTILIZATION"
          value={`${utilPct.toFixed(1)}%`}
          icon={BatteryCharging} color="#a78bfa" bg="rgba(167,139,250,0.12)"
          subtext={<><TrendingUp size={12} /> BATTERY SOC: {liveData?.batt.toFixed(1)}%</>}
        />

        <KpiCard
          title="CURTAILMENT RISK"
          value={risk}
          icon={ShieldAlert} color={risk === 'LOW' ? 'var(--primary-action)' : (risk === 'HIGH' ? 'var(--error)' : 'var(--tertiary)')} bg={risk === 'LOW' ? 'rgba(0,245,160,0.12)' : 'rgba(239,68,68,0.12)'}
          subtext={risk === 'LOW' ? <>NO IMMEDIATE THREAT</> : <>SURPLUS POWER DETECTED</>}
        />

        <KpiCard
          title="FORECAST CONFIDENCE"
          value={`${confidence.toFixed(1)}%`}
          icon={Activity} color="var(--primary-action)" bg="rgba(0,245,160,0.12)"
          subtext={<>BASED ON CURRENT WEATHER</>}
        />
      </div>

      {/* ── Main Chart: 24-72 Hour Renewable Generation Forecast ─── */}
      <div className="glass" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div className="text-headline-sm" style={{ color: 'var(--on-surface)' }}>72-Hour Renewable Generation Forecast</div>
            <div className="telem-sm" style={{ color: 'var(--on-surface-var)', marginTop: 3 }}>ACTUAL VS PREDICTED WITH UNCERTAINTY BANDS</div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <span className="telem-sm" style={{ color: 'var(--primary-action)', display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, background: 'var(--primary-action)', borderRadius: '50%' }}></div> ACTUAL</span>
            <span className="telem-sm" style={{ color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, border: '1.5px dashed #4cd7f6', borderRadius: '50%' }}></div> FORECAST</span>
            <span className="telem-sm" style={{ color: 'var(--error)', display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 2, background: 'var(--error)' }}></div> DEMAND</span>
          </div>
        </div>

        <div style={{ height: 380 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ left: -10, top: 20, bottom: 10, right: 10 }}>
              <defs>
                <linearGradient id="pBand" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--secondary)" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="var(--secondary)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,74,64,0.4)" vertical={false} />

              <XAxis
                dataKey="timestamp"
                axisLine={true} stroke="rgba(59,74,64,0.8)"
                tickLine={false}
                tick={{ fill: 'var(--on-surface-var)', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
                tickFormatter={(timeStr) => {
                  if (!timeStr) return '';
                  const d = new Date(timeStr);
                  if (isNaN(d.getTime())) return timeStr;
                  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', weekday: 'short' });
                }}
                minTickGap={40}
              />

              <YAxis
                yAxisId="left"
                axisLine={false} tickLine={false}
                tick={{ fill: 'var(--on-surface-var)', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
                tickFormatter={v => `${v}`}
              />

              <Tooltip content={<CustomTooltip />} />

              {/* Uncertainty Band (P10 to P90) */}
              {/* We use an Area chart where the lower bound is transparent, but recharts doesn't easily support range areas. 
                  Instead we can stack or just fill an area with custom data. A common trick is to use an Area with dataKey="p90" 
                  but we really want to fill between p10 and p90. 
                  Since Recharts Area supports an array of [min, max] for dataKey in newer versions, we'll map the data. */}

              <Area
                yAxisId="left"
                type="monotone"
                dataKey={(d) => [d.p10, d.p90]}
                stroke="none"
                fill="url(#pBand)"
                name="Uncertainty (P10-P90)"
                isAnimationActive={false}
              />

              {/* Demand Line */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="demand"
                stroke="var(--error)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                name="Expected Demand"
              />

              {/* Forecast Line */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="forecast"
                stroke="var(--secondary)"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                name="Forecast (P50)"
                connectNulls={true}
              />

              {/* Actual Line */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="actual"
                stroke="var(--primary-action)"
                strokeWidth={2.5}
                dot={false}
                name="Actual Generation"
              />

              <ReferenceLine
                x={currentData.timestamp}
                stroke="rgba(255,255,255,0.4)"
                strokeDasharray="3 3"
                label={{ position: 'top', value: 'NOW', fill: 'var(--on-surface)', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              />

            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Hourly Forecast Table ─── */}
      <div className="glass" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div className="text-headline-sm" style={{ color: 'var(--on-surface)' }}>Hourly Forecast Breakdown</div>
            <div className="telem-sm" style={{ color: 'var(--on-surface-var)', marginTop: 3 }}>24-HOUR EXPECTED GENERATION TABLE</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="telem-sm" style={{ color: 'var(--on-surface-var)' }}>TOTAL 24H PREDICTION</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 600, color: 'var(--secondary)' }}>
              {data.reduce((acc, curr) => acc + (curr.forecast || 0), 0).toFixed(1)} MWh
            </div>
          </div>
        </div>

        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-1)', zIndex: 1 }}>
              <tr>
                <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--on-surface-var)', fontWeight: 500, fontSize: 12, borderBottom: '1px solid var(--outline-var)' }}>TIME</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', color: 'var(--on-surface-var)', fontWeight: 500, fontSize: 12, borderBottom: '1px solid var(--outline-var)' }}>PREDICTED TOTAL</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', color: 'var(--on-surface-var)', fontWeight: 500, fontSize: 12, borderBottom: '1px solid var(--outline-var)' }}>SOLAR</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', color: 'var(--on-surface-var)', fontWeight: 500, fontSize: 12, borderBottom: '1px solid var(--outline-var)' }}>WIND</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', color: 'var(--on-surface-var)', fontWeight: 500, fontSize: 12, borderBottom: '1px solid var(--outline-var)' }}>P10 BND</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', color: 'var(--on-surface-var)', fontWeight: 500, fontSize: 12, borderBottom: '1px solid var(--outline-var)' }}>P90 BND</th>
              </tr>
            </thead>
            <tbody>
              {next24h.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--on-surface)' }}>
                    {new Date(row.timestamp).toString() !== 'Invalid Date' ? new Date(row.timestamp).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : row.timestamp}
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--primary-action)' }}>
                    {row.forecast ? row.forecast.toFixed(1) : '-'}
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--primary)' }}>
                    {row.solar_expected !== undefined ? row.solar_expected.toFixed(1) : '-'}
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--secondary)' }}>
                    {row.wind_expected !== undefined ? row.wind_expected.toFixed(1) : '-'}
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--on-surface-var)' }}>
                    {row.p10 ? row.p10.toFixed(1) : '-'}
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--on-surface-var)' }}>
                    {row.p90 ? row.p90.toFixed(1) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
