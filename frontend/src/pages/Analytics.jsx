import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Calendar, Download, TrendingUp, TrendingDown, Clock, Cloud } from 'lucide-react';

const kpiTrends = [
  { label: 'Carbon Saved', value: '1,240 t', trend: '+12%', isUp: true, icon: Cloud, color: 'var(--primary-action)' },
  { label: 'Cost Averted', value: '$45,200', trend: '+8%', isUp: true, icon: TrendingUp, color: 'var(--tertiary)' },
  { label: 'Uptime', value: '99.9%', trend: '+0.1%', isUp: true, icon: Clock, color: 'var(--secondary)' },
  { label: 'Curtailment', value: '4.2%', trend: '-1.5%', isUp: false, icon: TrendingDown, color: 'var(--error)' }
];

export default function Analytics() {
  const [timeframe, setTimeframe] = useState('7D');
  const [historicalData, setHistoricalData] = useState([]);

  useEffect(() => {
    fetch('http://localhost:8000/api/telemetry/history')
      .then(res => res.json())
      .then(data => setHistoricalData(data))
      .catch(e => console.error(e));
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, animation: 'float-up 0.4s ease-out' }}>
      
      {/* ── Header ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="text-headline-lg" style={{ color: 'var(--on-surface)', marginBottom: 4 }}>Analytics & Reports</h1>
          <p className="text-body-md" style={{ color: 'var(--on-surface-var)' }}>
            Historical performance review and data export
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ display: 'flex', background: 'var(--surface-2)', padding: 4, borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
            {['24H', '7D', '30D', 'YTD'].map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  color: timeframe === tf ? 'var(--on-surface)' : 'var(--on-surface-var)',
                  background: timeframe === tf ? 'rgba(255,255,255,0.1)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                {tf}
              </button>
            ))}
          </div>
          <button style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--bg)', border: `1px solid rgba(255,255,255,0.1)`,
            color: 'var(--on-surface)', padding: '8px 16px', borderRadius: 8,
            fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
          }}>
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {/* ── KPI Trends ────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {kpiTrends.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <div key={i} className="glass" style={{ padding: 20, borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ padding: 6, borderRadius: 6, background: `color-mix(in srgb, ${kpi.color} 13%, transparent)` }}>
                  <Icon size={16} color={kpi.color} />
                </div>
                <div className="telem-sm" style={{ color: 'var(--on-surface-var)' }}>{kpi.label}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 24, fontWeight: 700, color: 'var(--on-surface)' }}>{kpi.value}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: kpi.isUp ? 'var(--primary-action)' : 'var(--secondary)' }}>{kpi.trend}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Historical Charts ─────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        
        {/* Generation vs Demand (Bar Chart) */}
        <div className="glass" style={{ padding: 24, borderRadius: 8 }}>
          <div className="text-headline-sm" style={{ color: 'var(--on-surface)', marginBottom: 20 }}>Generation vs Demand</div>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={historicalData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a352d" vertical={false} />
                <XAxis dataKey="day" stroke="var(--on-surface-var)" tick={{ fill: 'var(--on-surface-var)', fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--on-surface-var)" tick={{ fill: 'var(--on-surface-var)', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }} tickLine={false} axisLine={false} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#111d33', border: '1px solid #3b4a40', borderRadius: 8 }}
                  itemStyle={{ fontFamily: 'JetBrains Mono, monospace' }}
                  cursor={{ fill: 'var(--surface-2)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: 'var(--on-surface-var)' }} />
                <Bar dataKey="solar" name="Solar" stackId="a" fill="var(--tertiary)" radius={[0, 0, 4, 4]} />
                <Bar dataKey="wind" name="Wind" stackId="a" fill="var(--secondary)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="demand" name="Demand" fill="var(--error)" radius={4} barSize={10} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Curtailment Trend (Line Chart) */}
        <div className="glass" style={{ padding: 24, borderRadius: 8 }}>
          <div className="text-headline-sm" style={{ color: 'var(--on-surface)', marginBottom: 20 }}>Curtailment Volume</div>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={historicalData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a352d" vertical={false} />
                <XAxis dataKey="day" stroke="var(--on-surface-var)" tick={{ fill: 'var(--on-surface-var)', fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--on-surface-var)" tick={{ fill: 'var(--on-surface-var)', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }} tickLine={false} axisLine={false} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#111d33', border: '1px solid #3b4a40', borderRadius: 8 }}
                  itemStyle={{ fontFamily: 'JetBrains Mono, monospace' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: 'var(--on-surface-var)' }} />
                <Line type="monotone" dataKey="curtailed" name="Curtailed Energy (MWh)" stroke="var(--error)" strokeWidth={3} dot={{ r: 4, fill: 'var(--error)', strokeWidth: 2, stroke: '#111d33' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
}
