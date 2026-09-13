import { useState, useEffect } from 'react';
import {
  AlertTriangle, AlertCircle, Info, CheckCircle,
  BatteryCharging, Battery, ArrowRight, Activity, TrendingUp, TrendingDown
} from 'lucide-react';

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
  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:8000/api/forecast')
      .then(r => r.json())
      .then(data => {
        const currentIndex = data.findIndex(d => d.actual === null);
        const futureData = currentIndex >= 0 ? data.slice(currentIndex, currentIndex + 24) : data.slice(-24);
        const dynamicRisks = [];
        let currentRisk = null;
        let riskIdCounter = 1;

        futureData.forEach((d) => {
          const surplus = d.forecast - d.demand;
          let type = null;
          let isCritical = false;

          // Define Risk Thresholds based on Macro Megawatts
          if (surplus > 150) {
            type = 'OVER-GENERATION RISK';
            isCritical = surplus > 250;
          } else if (surplus < -100) {
            type = 'UNDER-GENERATION RISK';
            isCritical = surplus < -200;
          }

          if (type) {
            // If the risk type changes or we haven't started a block, finalize the old one and start a new one
            if (!currentRisk || currentRisk.type !== type) {
              if (currentRisk) dynamicRisks.push(finalizeRisk(currentRisk, riskIdCounter++));
              currentRisk = {
                type,
                level: isCritical ? 'Critical' : 'High',
                startTimestamp: d.timestamp,
                endTimestamp: d.timestamp,
                forecasts: [d.forecast],
                demands: [d.demand],
                differences: [Math.abs(surplus)]
              };
            } else {
              // Extend the current risk block
              currentRisk.endTimestamp = d.timestamp;
              currentRisk.forecasts.push(d.forecast);
              currentRisk.demands.push(d.demand);
              currentRisk.differences.push(Math.abs(surplus));
              if (isCritical) currentRisk.level = 'Critical';
            }
          } else {
            // Gap in risk, finalize if there is one
            if (currentRisk) {
              dynamicRisks.push(finalizeRisk(currentRisk, riskIdCounter++));
              currentRisk = null;
            }
          }
        });
        
        // Finalize the last risk block if the day ended while in a risk state
        if (currentRisk) {
          dynamicRisks.push(finalizeRisk(currentRisk, riskIdCounter++));
        }
        
        setRisks(dynamicRisks);
        if (dynamicRisks.length > 0) setExpandedId(dynamicRisks[0].id);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  function finalizeRisk(riskObj, id) {
    const maxDiff = Math.max(...riskObj.differences);
    const avgForecast = Math.round(riskObj.forecasts.reduce((a,b)=>a+b,0)/riskObj.forecasts.length);
    const avgDemand = Math.round(riskObj.demands.reduce((a,b)=>a+b,0)/riskObj.demands.length);
    
    const startTimeStr = new Date(riskObj.startTimestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    // Add 1 hour to end time to show the full block duration
    const endDate = new Date(riskObj.endTimestamp);
    endDate.setHours(endDate.getHours() + 1);
    const endTimeStr = endDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    const dayStr = new Date(riskObj.startTimestamp).toLocaleDateString([], {weekday: 'short'});
    const isOver = riskObj.type === 'OVER-GENERATION RISK';

    return {
      id,
      type: riskObj.type,
      level: riskObj.level,
      time: `${dayStr} ${startTimeStr}–${endTimeStr}`,
      forecast: avgForecast,
      demand: avgDemand,
      difference: Math.round(maxDiff),
      diffLabel: isOver ? 'Potential Surplus' : 'Potential Deficit',
      suggestions: isOver ? ['Charge storage', 'Shift flexible load', 'Export surplus'] : ['Discharge storage', 'Schedule backup', 'Increase grid support'],
      details: {
        problem: isOver ? 'Expected renewable generation will significantly exceed demand.' : 'Expected renewable generation will fall significantly below demand.',
        why: isOver ? ['High solar forecast expected', 'Midday demand drop'] : ['Solar drop-off at dusk', 'Low wind generation', 'Evening demand peak'],
        probability: riskObj.level === 'Critical' ? '85%' : '65%',
        actions: isOver ? [
          { label: 'Charge Battery', value: `${Math.round(maxDiff * 0.6)} MW` },
          { label: 'Export to Grid', value: `${Math.round(maxDiff * 0.4)} MW` }
        ] : [
          { label: 'Discharge Battery', value: `${Math.round(maxDiff * 0.5)} MW` },
          { label: 'Start Backup Gen', value: `${Math.round(maxDiff * 0.5)} MW` }
        ],
        effects: isOver ? [
          { label: 'Curtailment', trend: 'down' },
          { label: 'Grid Export Revenue', trend: 'up' }
        ] : [
          { label: 'Grid Dependency', trend: 'up' },
          { label: 'Operating Cost', trend: 'up' }
        ]
      }
    };
  }

  const criticalCount = risks.filter(r => r.level === 'Critical').length;
  const highCount = risks.filter(r => r.level === 'High').length;
  const isNormal = criticalCount === 0 && highCount === 0;

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
        <div className="glass" style={{ padding: 16, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12, opacity: criticalCount > 0 ? 1 : 0.5 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--error)' }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--on-surface)' }}>Critical ({criticalCount})</div>
            <div className="telem-sm" style={{ color: 'var(--on-surface-var)' }}>Immediate concern</div>
          </div>
        </div>
        <div className="glass" style={{ padding: 16, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12, opacity: highCount > 0 ? 1 : 0.5 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--tertiary)' }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--on-surface)' }}>High ({highCount})</div>
            <div className="telem-sm" style={{ color: 'var(--on-surface-var)' }}>Significant imbalance</div>
          </div>
        </div>
        <div className="glass" style={{ padding: 16, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12, opacity: 0.5 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--tertiary-container)' }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--on-surface)' }}>Medium (0)</div>
            <div className="telem-sm" style={{ color: 'var(--on-surface-var)' }}>Requires monitoring</div>
          </div>
        </div>
        <div className="glass" style={{ padding: 16, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12, opacity: isNormal ? 1 : 0.5 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--primary-action)' }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--on-surface)' }}>Normal</div>
            <div className="telem-sm" style={{ color: 'var(--on-surface-var)' }}>{isNormal ? 'No major risks' : 'System stressed'}</div>
          </div>
        </div>
      </div>

      {/* ── Alert List ──────────────────────────────────────── */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--on-surface-var)' }}>
          Analyzing forecast data for risks...
        </div>
      ) : risks.length === 0 ? (
        <div className="glass" style={{ padding: 40, textAlign: 'center', borderRadius: 8 }}>
          <CheckCircle size={48} color="var(--primary-action)" style={{ marginBottom: 16, opacity: 0.8 }} />
          <h2 className="text-headline-sm" style={{ color: 'var(--on-surface)' }}>All Clear</h2>
          <p style={{ color: 'var(--on-surface-var)', marginTop: 8 }}>No significant over-generation or under-generation risks detected for the next 24 hours.</p>
        </div>
      ) : (
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
      )}
    </div>
  );
}
