import { useState } from 'react';
import { Play, Activity, Leaf, Zap, Settings, ShieldCheck, ChevronRight, Cpu } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';

const scenarios = [
  { id: 'profit', label: 'Max Profit', icon: Activity, color: 'var(--tertiary)', desc: 'Optimizes for peak electricity pricing.' },
  { id: 'carbon', label: 'Min Carbon', icon: Leaf, color: 'var(--primary-action)', desc: 'Prioritizes internal renewable usage.' },
  { id: 'grid', label: 'Grid Stability', icon: Zap, color: 'var(--secondary)', desc: 'Supports grid voltage and frequency.' },
  { id: 'custom', label: 'Custom', icon: Settings, color: '#a78bfa', desc: 'User-defined parameters.' }
];

const scenarioData = {
  baseline: [
    { subject: 'Profit', A: 50 },
    { subject: 'Ren Util', A: 60 },
    { subject: 'Grid Support', A: 40 },
    { subject: 'Carbon Reduction', A: 65 },
    { subject: 'Battery Life', A: 80 }
  ],
  profit: [
    { subject: 'Profit', A: 50, B: 95 },
    { subject: 'Ren Util', A: 60, B: 65 },
    { subject: 'Grid Support', A: 40, B: 55 },
    { subject: 'Carbon Reduction', A: 65, B: 50 },
    { subject: 'Battery Life', A: 80, B: 60 }
  ],
  carbon: [
    { subject: 'Profit', A: 50, B: 60 },
    { subject: 'Ren Util', A: 60, B: 95 },
    { subject: 'Grid Support', A: 40, B: 40 },
    { subject: 'Carbon Reduction', A: 65, B: 100 },
    { subject: 'Battery Life', A: 80, B: 75 }
  ],
  grid: [
    { subject: 'Profit', A: 50, B: 45 },
    { subject: 'Ren Util', A: 60, B: 70 },
    { subject: 'Grid Support', A: 40, B: 95 },
    { subject: 'Carbon Reduction', A: 65, B: 60 },
    { subject: 'Battery Life', A: 80, B: 85 }
  ]
};

const aiExplanations = {
  profit: "By discharging the BESS during the evening peak (18:00 - 20:00) when prices are expected to surge to $120/MWh, we maximize revenue. Remaining solar is shifted instead of curtailed.",
  carbon: "Bypassing grid export entirely, we route all excess solar (12:00 - 15:00) into BESS and CCES storage. This ensures 100% of the industrial load tonight is powered by green energy.",
  grid: "The utility has signaled a potential voltage sag. Reserving 40% of BESS capacity for rapid frequency response rather than arbitrage will support the grid and avoid penalties."
};

const recommendedActions = {
  profit: [
    { action: "Schedule BESS Discharge", value: "80 MW @ 18:00" },
    { action: "Reduce Factory Load", value: "15 MW @ 19:00" }
  ],
  carbon: [
    { action: "Max CCES Compression", value: "50 MW (Now)" },
    { action: "BESS Fast Charge", value: "100 MW (12:00)" }
  ],
  grid: [
    { action: "Enable Freq Response", value: "±20 MW Band" },
    { action: "Curtail Wind", value: "10 MW (To reduce local congestion)" }
  ]
};

export default function Optimization() {
  const [activeScenario, setActiveScenario] = useState('profit');
  const activeColor = scenarios.find(s => s.id === activeScenario)?.color || 'var(--on-surface)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, animation: 'float-up 0.4s ease-out' }}>
      
      {/* ── Header ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="text-headline-lg" style={{ color: 'var(--on-surface)', marginBottom: 4 }}>Optimization & Scenarios</h1>
          <p className="text-body-md" style={{ color: 'var(--on-surface-var)' }}>
            AI-driven dispatch simulation and action recommendations
          </p>
        </div>
        <button style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: `color-mix(in srgb, ${activeColor} 13%, transparent)`, border: `1px solid color-mix(in srgb, ${activeColor} 33%, transparent)`,
          color: activeColor, padding: '10px 20px', borderRadius: 8,
          fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
        }}>
          <Play size={18} />
          EXECUTE SCENARIO
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24 }}>
        
        {/* ── Left Column: Controls & Actions ────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Scenarios */}
          <div className="glass" style={{ padding: 20, borderRadius: 8 }}>
            <div className="telem-sm" style={{ color: 'var(--on-surface-var)', marginBottom: 16 }}>SCENARIO OBJECTIVE</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {scenarios.map(scen => {
                const isActive = activeScenario === scen.id;
                const Icon = scen.icon;
                return (
                  <div key={scen.id} 
                    onClick={() => scen.id !== 'custom' && setActiveScenario(scen.id)}
                    style={{
                      padding: 16, borderRadius: 8, cursor: scen.id === 'custom' ? 'not-allowed' : 'pointer',
                      border: `1px solid ${isActive ? scen.color : 'var(--surface-2)'}`,
                      background: isActive ? `color-mix(in srgb, ${scen.color} 7%, transparent)` : 'rgba(0,0,0,0.2)',
                      opacity: scen.id === 'custom' ? 0.5 : 1,
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                      <Icon size={18} color={isActive ? scen.color : 'var(--on-surface-var)'} />
                      <span style={{ fontWeight: 600, color: isActive ? 'var(--on-surface)' : 'var(--on-surface-var)' }}>{scen.label}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--on-surface-var)', paddingLeft: 30 }}>
                      {scen.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Recommended Actions */}
          <div className="glass" style={{ padding: 20, borderRadius: 8, border: `1px solid color-mix(in srgb, ${activeColor} 20%, transparent)` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Cpu size={18} color={activeColor} />
              <div className="telem-sm" style={{ color: activeColor }}>RECOMMENDED ACTIONS</div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {recommendedActions[activeScenario]?.map((act, i) => (
                <div key={i} style={{ 
                  background: 'var(--surface-3)', padding: '12px 16px', borderRadius: 6,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <span style={{ fontSize: 14, color: 'var(--on-surface)' }}>{act.action}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: activeColor }}>{act.value}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ── Right Column: Impact & Explainability ──────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Radar Chart */}
          <div className="glass" style={{ padding: 24, borderRadius: 8, flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="text-headline-sm" style={{ color: 'var(--on-surface)', marginBottom: 24 }}>Impact Analysis</div>
            
            <div style={{ flex: 1, minHeight: 350 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={scenarioData[activeScenario]}>
                  <PolarGrid stroke="#3b4a40" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--on-surface-var)', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111d33', border: '1px solid #3b4a40', borderRadius: 8 }}
                    itemStyle={{ fontFamily: 'JetBrains Mono, monospace' }}
                  />
                  <Radar name="Baseline" dataKey="A" stroke="var(--on-surface-var)" fill="var(--on-surface-var)" fillOpacity={0.2} />
                  <Radar name="Scenario" dataKey="B" stroke={activeColor} fill={activeColor} fillOpacity={0.4} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: 2, background: 'var(--on-surface-var)', opacity: 0.5 }} />
                <span className="telem-sm" style={{ color: 'var(--on-surface-var)' }}>Baseline</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: 2, background: activeColor, opacity: 0.8 }} />
                <span className="telem-sm" style={{ color: 'var(--on-surface)' }}>Simulated Impact</span>
              </div>
            </div>
          </div>

          {/* Explainability (XAI) */}
          <div className="glass" style={{ padding: 24, borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <ShieldCheck size={24} color="var(--primary-action)" />
              <div className="text-headline-sm" style={{ color: 'var(--on-surface)' }}>Explainable AI (XAI)</div>
            </div>
            <p style={{ color: 'var(--on-surface-var)', fontSize: 15, lineHeight: 1.6, margin: 0 }}>
              {aiExplanations[activeScenario]}
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}
