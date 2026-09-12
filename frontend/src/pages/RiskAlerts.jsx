import { useState } from 'react';
import {
  AlertTriangle, AlertCircle, Info, CheckCircle,
  BatteryCharging, Battery, ArrowRight, Activity, TrendingUp, TrendingDown
} from 'lucide-react';

const risks = [
  {
    id: 1,
    type: 'OVER-GENERATION RISK',
    level: 'Critical',
    time: 'Tomorrow 12:00–14:00',
    forecast: 126,
    demand: 82,
    difference: 44, // surplus
    diffLabel: 'Potential Surplus',
    suggestions: ['Charge storage', 'Shift flexible load', 'Export surplus'],
    details: {
      problem: 'Expected renewable generation may exceed demand.',
      why: ['High solar forecast', 'Low midday demand', 'Storage partially available'],
      probability: '78%',
      actions: [
        { label: 'Charge Battery', value: '25 MW' },
        { label: 'Shift Load', value: '10 MW' },
        { label: 'Export', value: '9 MW' }
      ],
      effects: [
        { label: 'Curtailment', trend: 'down' },
        { label: 'Renewable Utilization', trend: 'up' },
        { label: 'Grid Stress', trend: 'down' }
      ]
    }
  },
  {
    id: 2,
    type: 'UNDER-GENERATION RISK',
    level: 'High',
    time: 'Tomorrow 18:00–20:00',
    forecast: 21,
    demand: 78,
    difference: 57, // deficit
    diffLabel: 'Potential Deficit',
    suggestions: ['Discharge storage', 'Schedule backup', 'Increase grid support'],
    details: {
      problem: 'Expected renewable generation will fall significantly below demand.',
      why: ['Solar drop-off at dusk', 'Evening demand peak expected', 'Wind forecast dropping'],
      probability: '65%',
      actions: [
        { label: 'Discharge Battery', value: '40 MW' },
        { label: 'Increase Grid Import', value: '17 MW' }
      ],
      effects: [
        { label: 'Grid Dependency', trend: 'up' },
        { label: 'Backup Required', trend: 'down' },
        { label: 'Grid Stress', trend: 'up' }
      ]
    }
  }
];

function AlertCard({ risk, onExpand, expanded }) {
  const isCritical = risk.level === 'Critical';
  const color = isCritical ? 'var(--error)' : 'var(--tertiary)';
  const Icon = isCritical ? AlertTriangle : AlertCircle;

  return (
    <div 
      className="glass" 
      style={{ 
        padding: 24, borderRadius: 8, 
        border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
        background: `linear-gradient(to right, color-mix(in srgb, ${color} 3%, transparent), transparent)`,
        cursor: 'pointer', transition: 'all 0.2s'
      }}
      onClick={() => onExpand(risk.id)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ padding: 8, borderRadius: 8, background: `color-mix(in srgb, ${color} 13%, transparent)` }}>
            <Icon size={24} color={color} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color, letterSpacing: '0.05em' }}>{risk.type}</span>
              <span className={`badge-${isCritical ? 'red' : 'amber'} telem-sm`}>{risk.level}</span>
            </div>
            <div className="telem-sm" style={{ color: 'var(--on-surface-var)', marginTop: 4 }}>{risk.time}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <div className="telem-sm" style={{ color: 'var(--on-surface-var)' }}>Forecast Renewable</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 18, color: 'var(--on-surface)' }}>{risk.forecast} MW</div>
        </div>
        <div>
          <div className="telem-sm" style={{ color: 'var(--on-surface-var)' }}>Expected Demand</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 18, color: 'var(--on-surface)' }}>{risk.demand} MW</div>
        </div>
        <div>
          <div className="telem-sm" style={{ color: color }}>{risk.diffLabel}</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 18, fontWeight: 700, color }}>{risk.difference} MW</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {risk.suggestions.map((s, i) => (
          <span key={i} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 4, background: 'var(--surface-2)', color: 'var(--on-surface-var)' }}>
            {s}
          </span>
        ))}
      </div>

      {expanded && (
        <div style={{ marginTop: 24, paddingTop: 24, borderTop: `1px solid color-mix(in srgb, ${color} 13%, transparent)`, animation: 'float-up 0.3s ease-out' }}>
          <div style={{ marginBottom: 20 }}>
            <div className="text-headline-sm" style={{ color: 'var(--on-surface)', marginBottom: 8 }}>Problem</div>
            <p style={{ color: 'var(--on-surface-var)', fontSize: 14 }}>{risk.details.problem}</p>
          </div>
          
          <div style={{ marginBottom: 20 }}>
            <div className="text-headline-sm" style={{ color: 'var(--on-surface)', marginBottom: 8 }}>Why?</div>
            <ul style={{ color: 'var(--on-surface-var)', fontSize: 14, margin: 0, paddingLeft: 20 }}>
              {risk.details.why.map((w, i) => <li key={i} style={{ marginBottom: 4 }}>{w}</li>)}
            </ul>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div className="glass" style={{ padding: 16, borderRadius: 8, background: 'var(--surface-2)' }}>
              <div className="telem-sm" style={{ color: 'var(--primary-action)', marginBottom: 12 }}>RECOMMENDED ACTIONS</div>
              {risk.details.actions.map((act, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--on-surface)' }}>{i+1}. {act.label}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--primary-action)' }}>{act.value}</span>
                </div>
              ))}
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--on-surface-var)' }}>Risk Probability</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, color: color, fontWeight: 700 }}>{risk.details.probability}</span>
              </div>
            </div>

            <div className="glass" style={{ padding: 16, borderRadius: 8, background: 'var(--surface-2)' }}>
              <div className="telem-sm" style={{ color: 'var(--secondary)', marginBottom: 12 }}>EXPECTED EFFECT</div>
              {risk.details.effects.map((eff, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, color: 'var(--on-surface)' }}>{eff.label}</span>
                  {eff.trend === 'up' ? 
                    <TrendingUp size={16} color="var(--primary-action)" /> : 
                    <TrendingDown size={16} color="var(--secondary)" />
                  }
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RiskAlerts() {
  const [expandedId, setExpandedId] = useState(1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, animation: 'float-up 0.4s ease-out' }}>
      
      {/* ── Page Header ─────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="text-headline-lg" style={{ color: 'var(--on-surface)', marginBottom: 4 }}>Risk & Alerts</h1>
          <p className="text-body-md" style={{ color: 'var(--on-surface-var)' }}>
            Where could the renewable forecast create an operational problem?
          </p>
        </div>
      </div>

      {/* ── Risk Summary ────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <div className="glass" style={{ padding: 16, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--error)' }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--on-surface)' }}>Critical (1)</div>
            <div className="telem-sm" style={{ color: 'var(--on-surface-var)' }}>Immediate concern</div>
          </div>
        </div>
        <div className="glass" style={{ padding: 16, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--tertiary)' }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--on-surface)' }}>High (1)</div>
            <div className="telem-sm" style={{ color: 'var(--on-surface-var)' }}>Significant imbalance</div>
          </div>
        </div>
        <div className="glass" style={{ padding: 16, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--tertiary-container)' }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--on-surface)' }}>Medium (0)</div>
            <div className="telem-sm" style={{ color: 'var(--on-surface-var)' }}>Requires monitoring</div>
          </div>
        </div>
        <div className="glass" style={{ padding: 16, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--primary-action)' }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--on-surface)' }}>Normal</div>
            <div className="telem-sm" style={{ color: 'var(--on-surface-var)' }}>No concerns</div>
          </div>
        </div>
      </div>

      {/* ── Alert List ──────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {risks.map(risk => (
          <AlertCard 
            key={risk.id} 
            risk={risk} 
            expanded={expandedId === risk.id}
            onExpand={id => setExpandedId(id === expandedId ? null : id)} 
          />
        ))}
      </div>
    </div>
  );
}
