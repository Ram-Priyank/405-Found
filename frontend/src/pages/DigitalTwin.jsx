import { useState, useEffect } from 'react';
import {
  Sun, Wind, Factory, Zap, Battery,
  Database, Cloud, Cpu, Globe,
  Thermometer,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────
   ANIMATED FLOW PULSE  — tiny glowing dot that travels a SVG path
   ───────────────────────────────────────────────────────────────── */
function FlowPulse({ pathId, color, duration = 3, delay = 0, size = 6 }) {
  return (
    <circle r={size / 2} fill={color} opacity={0.9}
      style={{ filter: `drop-shadow(0 0 ${size}px ${color})` }}>
      <animateMotion
        dur={`${duration}s`}
        begin={`${delay}s`}
        repeatCount="indefinite"
        rotate="auto">
        <mpath href={`#${pathId}`} />
      </animateMotion>
      <animate attributeName="opacity"
        values="0;0.9;0.9;0"
        keyTimes="0;0.1;0.85;1"
        dur={`${duration}s`}
        begin={`${delay}s`}
        repeatCount="indefinite" />
    </circle>
  );
}

/* ─────────────────────────────────────────────────────────────────
   NODE CARD  — positioned absolutely inside the SVG overlay div
   ───────────────────────────────────────────────────────────────── */
function NodeCard({ icon: Icon, label, sublabel, value, unit, color, bg, border, pulse, small }) {
  const w = small ? 100 : 124;
  const h = small ? 64  : 80;
  return (
    <div className="glass" style={{
      width: w, minHeight: h,
      borderRadius: 10,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 4, padding: '10px 10px',
      transition: 'box-shadow 0.3s, transform 0.2s',
      cursor: 'default',
      position: 'relative',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.borderColor = color; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)';    e.currentTarget.style.borderColor = ''; }}
    >
      <div style={{
        width: small ? 28 : 34, height: small ? 28 : 34,
        borderRadius: 8,
        background: `color-mix(in srgb, ${color} 9%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 27%, transparent)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={small ? 14 : 17} color={color} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: small ? 10 : 11, fontWeight: 700, color: 'var(--on-surface)', letterSpacing: '-0.01em', lineHeight: 1.3 }}>{label}</div>
        {sublabel && <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--on-surface-var)', letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: 1 }}>{sublabel}</div>}
        {value !== undefined && (
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: small ? 12 : 14, fontWeight: 700, color, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
            {value}<span style={{ fontSize: 9, color: 'var(--on-surface-var)', marginLeft: 2 }}>{unit}</span>
          </div>
        )}
      </div>
      {pulse && (
        <div style={{ position: 'absolute', top: 7, right: 9, width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }}
          className="animate-pulse-slow" />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   STAT STRIP  — small kpi row
   ───────────────────────────────────────────────────────────────── */
function StatStrip({ items }) {
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {items.map(({ label, value, unit, color }) => (
        <div key={label} className="glass" style={{
          borderRadius: 8, padding: '10px 16px', flex: '1 1 140px', minWidth: 120,
        }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--on-surface-var)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
            {value}<span style={{ fontSize: 11, color: 'var(--on-surface-var)', marginLeft: 4 }}>{unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */
export default function DigitalTwin({ coords }) {
  const [tick, setTick] = useState(0);
  const [solar,  setSolar]  = useState(284);
  const [wind,   setWind]   = useState(112);
  const [batt,   setBatt]   = useState(72.4);
  const [cces,   setCces]   = useState(58.1);
  const [demand, setDemand] = useState(261);
  const [co2,    setCo2]    = useState(12.4);
  const [nationalDemand, setNationalDemand] = useState(218450);
  const [gridFrequency, setGridFrequency] = useState(50.0);

  // Configurable capacities (Inputs)
  const [solarCap, setSolarCap] = useState(320);
  const [windCap,  setWindCap]  = useState(150);
  const [baseDemand, setBaseDemand] = useState(260);

  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/telemetry/live?solarCap=${solarCap}&windCap=${windCap}&baseDemand=${baseDemand}${coords ? `&lat=${coords.lat}&lon=${coords.lon}` : ''}`);
        const data = await res.json();
        setTick(t => t + 1);
        setSolar(data.solar);
        setWind(data.wind);
        setBatt(data.batt);
        setCces(data.cces);
        setDemand(data.demand);
        setCo2(data.co2);
        setNationalDemand(data.national_demand_mw);
        setGridFrequency(data.grid_frequency_hz);
      } catch (e) {
        console.error("Telemetry fetch failed", e);
      }
    };
    
    // Initial fetch
    fetchTelemetry();
    
    const id = setInterval(fetchTelemetry, 2000);
    return () => clearInterval(id);
  }, [solarCap, windCap, baseDemand]);

  const renewable = solar + wind;
  const surplus   = Math.max(0, renewable - demand);
  const gridExport= +Math.min(surplus * 0.28, 80).toFixed(0);
  const battCharge= +Math.min(surplus * 0.42, 100).toFixed(0);
  const ccesCharge= +Math.min(surplus * 0.3, 90).toFixed(0);
  const curtailed = +Math.max(0, surplus - battCharge - ccesCharge - gridExport).toFixed(0);

  /* ── SVG canvas dimensions ── */
  const W = 1100, H = 750;

  /* ── Node centre coordinates ── */
  const POS = {
    solar:     { x: 150,  y: 90  },
    wind:      { x: 950,  y: 90  },
    factory:   { x: 550,  y: 90  },
    energyBus: { x: 550,  y: 280 },
    aiHub:     { x: 550,  y: 450 }, // moved down
    bess:      { x: 220,  y: 450 },
    cces:      { x: 880,  y: 450 },
    grid:      { x: 150,  y: 640 },
    co2Cap:    { x: 550,  y: 640 }, // moved down to bottom row
    recovered: { x: 950,  y: 640 },
  };

  /* ── SVG paths ── */
  const paths = {
    solarToBus:   `M ${POS.solar.x} ${POS.solar.y + 40}   L ${POS.energyBus.x - 90} ${POS.energyBus.y - 30}`,
    windToBus:    `M ${POS.wind.x}  ${POS.wind.y  + 40}   L ${POS.energyBus.x + 90} ${POS.energyBus.y - 30}`,
    // Curve factory-to-CO2 around the right side of the AI hub
    factoryToCo2: `M ${POS.factory.x + 50} ${POS.factory.y + 30} Q 720 350 ${POS.co2Cap.x + 50} ${POS.co2Cap.y - 40}`,
    busToBess:    `M ${POS.energyBus.x - 90} ${POS.energyBus.y + 30} Q 380 380 ${POS.bess.x + 55} ${POS.bess.y}`,
    busToCces:    `M ${POS.energyBus.x + 90} ${POS.energyBus.y + 30} Q 720 380 ${POS.cces.x - 55} ${POS.cces.y}`,
    busToGrid:    `M ${POS.energyBus.x - 110} ${POS.energyBus.y + 20} Q 220 350 ${POS.grid.x + 45} ${POS.grid.y - 20}`,
    bessToGrid:   `M ${POS.bess.x} ${POS.bess.y + 36} L ${POS.grid.x} ${POS.grid.y - 20}`,
    ccesToRec:    `M ${POS.cces.x} ${POS.cces.y + 36} L ${POS.recovered.x} ${POS.recovered.y - 20}`,
    co2ToCces:    `M ${POS.co2Cap.x + 60} ${POS.co2Cap.y - 20} L ${POS.cces.x - 30} ${POS.cces.y + 36}`,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Page header ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="text-headline-lg" style={{ color: 'var(--on-surface)', marginBottom: 4 }}>Digital Twin</h1>
          <p className="text-body-md" style={{ color: 'var(--on-surface-var)' }}>
            Virtual representation of the energy system · Modify inputs to simulate responses
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="live-dot" />
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--primary-action)', letterSpacing: '0.08em' }}>LIVE SIMULATION</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        
        {/* ── Left Column: Main Canvas & KPIs ────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* ── Top KPI strip ────────────────────────────────────────── */}
          <StatStrip items={[
            { label: 'Total Renewable',  value: renewable.toFixed(0), unit: 'kW',  color: 'var(--primary-action)' },
            { label: 'Industrial Demand',value: demand,               unit: 'kW',  color: 'var(--error)' },
            { label: 'Grid Export',      value: gridExport,           unit: 'kW',  color: 'var(--tertiary)' },
            { label: 'National Grid',    value: (nationalDemand / 1000).toFixed(1), unit: 'GW',  color: '#8b5cf6' },
            { label: 'Grid Freq',        value: gridFrequency.toFixed(2), unit: 'Hz',  color: '#f59e0b' },
          ]} />

          {/* ── Main canvas ──────────────────────────────────────────── */}
          <div style={{
            position: 'relative',
            width: '100%',
            background: 'var(--surface-1)',
            border: '1px solid var(--outline-var)',
            borderRadius: 12,
            overflow: 'hidden',
          }}>
            {/* Radial glow behind AI hub */}
            <div style={{
              position: 'absolute',
              left: '50%', top: '52%',
              transform: 'translate(-50%, -50%)',
              width: 360, height: 360,
              background: 'radial-gradient(circle, rgba(0,245,160,0.06) 0%, transparent 65%)',
              pointerEvents: 'none',
              zIndex: 0,
            }} />

            {/* ── SVG flow lines ───────────────────────────────────── */}
            <svg
              viewBox={`0 0 ${W} ${H}`}
              style={{ width: '100%', height: 'auto', display: 'block', position: 'relative', zIndex: 1 }}
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                {/* Arrow markers */}
                {[
                  { id: 'arr-solar',  color: 'var(--tertiary)' },
                  { id: 'arr-wind',   color: 'var(--secondary)' },
                  { id: 'arr-co2',    color: 'var(--primary-action)' },
                  { id: 'arr-batt',   color: 'var(--purple, #a78bfa)' },
                  { id: 'arr-orange', color: 'var(--orange, #fb923c)' },
                  { id: 'arr-green',  color: 'var(--primary-action)' },
                ].map(({ id, color }) => (
                  <marker key={id} id={id} markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
                    <polygon points="0 0, 7 3.5, 0 7" fill={color} opacity="0.8" />
                  </marker>
                ))}
                {/* Path defs for animateMotion */}
                {Object.entries(paths).map(([id, d]) => (
                  <path key={id} id={id} d={d} fill="none" />
                ))}
              </defs>

              {/* ── Drawn lines ─────────────────────────────────── */}

              {/* Solar → Energy Bus */}
              <path d={paths.solarToBus} fill="none" stroke="var(--tertiary)" strokeWidth="1.8"
                strokeOpacity="0.5" markerEnd="url(#arr-solar)" />
              {/* Wind → Energy Bus */}
              <path d={paths.windToBus} fill="none" stroke="var(--secondary)" strokeWidth="1.8"
                strokeOpacity="0.5" markerEnd="url(#arr-wind)" />
              {/* Factory → CO2 Capture */}
              <path d={paths.factoryToCo2} fill="none" stroke="var(--primary-action)" strokeWidth="1.6"
                strokeOpacity="0.45" strokeDasharray="5 4" markerEnd="url(#arr-co2)" />
              {/* Bus → BESS */}
              <path d={paths.busToBess} fill="none" stroke="#a78bfa" strokeWidth="1.8"
                strokeOpacity="0.5" markerEnd="url(#arr-batt)" />
              {/* Bus → CCES (power for compression) */}
              <path d={paths.busToCces} fill="none" stroke="var(--secondary)" strokeWidth="1.6"
                strokeOpacity="0.4" markerEnd="url(#arr-wind)" />
              {/* Bus → Grid */}
              <path d={paths.busToGrid} fill="none" stroke="#fb923c" strokeWidth="1.6"
                strokeOpacity="0.45" strokeDasharray="6 4" markerEnd="url(#arr-orange)" />
              {/* BESS → Grid (discharge) */}
              <path d={paths.bessToGrid} fill="none" stroke="#a78bfa" strokeWidth="1.5"
                strokeOpacity="0.35" markerEnd="url(#arr-batt)" />
              {/* CO2 Capture → CCES */}
              <path d={paths.co2ToCces} fill="none" stroke="var(--primary-action)" strokeWidth="1.8"
                strokeOpacity="0.5" markerEnd="url(#arr-co2)" />
              {/* CCES → Power Recovered */}
              <path d={paths.ccesToRec} fill="none" stroke="var(--primary-action)" strokeWidth="1.6"
                strokeOpacity="0.4" markerEnd="url(#arr-green)" />

              {/* ── Animated pulses ──────────────────────────────── */}
              {solar > 10  && <FlowPulse pathId="solarToBus"   color="var(--tertiary)" duration={2.2} delay={0}   size={7} />}
              {solar > 10  && <FlowPulse pathId="solarToBus"   color="var(--tertiary)" duration={2.2} delay={1.1} size={5} />}
              {wind > 10   && <FlowPulse pathId="windToBus"    color="var(--secondary)" duration={2.4} delay={0.3} size={7} />}
              {wind > 10   && <FlowPulse pathId="windToBus"    color="var(--secondary)" duration={2.4} delay={1.5} size={5} />}
              <FlowPulse pathId="factoryToCo2" color="var(--primary-action)" duration={3.0} delay={0}   size={6} />
              <FlowPulse pathId="factoryToCo2" color="var(--primary-action)" duration={3.0} delay={1.5} size={5} />
              {battCharge > 0 && <FlowPulse pathId="busToBess" color="#a78bfa" duration={2.8} delay={0}   size={6} />}
              {battCharge > 0 && <FlowPulse pathId="busToBess" color="#a78bfa" duration={2.8} delay={1.4} size={4} />}
              {ccesCharge > 0 && <FlowPulse pathId="busToCces" color="var(--secondary)" duration={3.2} delay={0.6} size={6} />}
              {gridExport > 0 && <FlowPulse pathId="busToGrid" color="#fb923c" duration={3.5} delay={0.5} size={5} />}
              <FlowPulse pathId="co2ToCces"  color="var(--primary-action)" duration={3.0} delay={0.8} size={6} />
              <FlowPulse pathId="co2ToCces"  color="var(--primary-action)" duration={3.0} delay={2.1} size={4} />
              <FlowPulse pathId="ccesToRec"  color="var(--primary-action)" duration={3.8} delay={1.0} size={5} />
            </svg>

            {/* ── Node Cards overlaid on canvas ─────────────────── */}
            <div style={{
              position: 'absolute', inset: 0,
              pointerEvents: 'none',   /* let SVG clicks pass through */
            }}>
              {[
                {
                  ...POS.solar,
                  icon: Sun, label: 'Solar Array', sublabel: 'PV-01',
                  value: solar.toFixed(0), unit: 'kW',
                  color: 'var(--tertiary)', bg: 'rgba(245,158,11,0.10)', border: '#f59e0b88',
                  pulse: true,
                },
                {
                  ...POS.wind,
                  icon: Wind, label: 'Wind Farm', sublabel: 'WT-03',
                  value: wind.toFixed(0), unit: 'kW',
                  color: 'var(--secondary)', bg: 'rgba(76,215,246,0.10)', border: '#4cd7f688',
                  pulse: true,
                },
                {
                  ...POS.factory,
                  icon: Factory, label: 'Industrial Plant', sublabel: 'IND-1',
                  value: demand, unit: 'kW',
                  color: 'var(--on-surface-var)', bg: 'rgba(30,41,59,0.85)', border: '#3b4a4088',
                  pulse: false,
                },
                {
                  ...POS.energyBus,
                  icon: Zap, label: 'AC Energy Bus', sublabel: 'BUSBAR',
                  value: renewable.toFixed(0), unit: 'kW',
                  color: 'var(--secondary)', bg: 'rgba(76,215,246,0.08)', border: '#4cd7f666',
                  pulse: true,
                },
                {
                  ...POS.co2Cap,
                  icon: Cloud, label: 'CO₂ Capture', sublabel: 'DAC UNIT',
                  value: co2, unit: 't/hr',
                  color: 'var(--primary-action)', bg: 'rgba(0,245,160,0.08)', border: '#00f5a066',
                  pulse: true,
                },
                {
                  ...POS.bess,
                  icon: Battery, label: 'BESS', sublabel: 'Li-Ion',
                  value: batt.toFixed(1), unit: '%',
                  color: 'var(--purple, #a78bfa)', bg: 'rgba(167,139,250,0.10)', border: '#a78bfa77',
                  pulse: battCharge > 0,
                },
                {
                  ...POS.cces,
                  icon: Database, label: 'CCES Storage', sublabel: 'CO₂ TANK',
                  value: cces.toFixed(1), unit: '%',
                  color: 'var(--primary-action)', bg: 'rgba(0,245,160,0.08)', border: '#00f5a066',
                  pulse: true,
                },
                {
                  ...POS.grid,
                  icon: Globe, label: 'Utility Grid', sublabel: 'GTI-1',
                  value: gridExport, unit: 'kW',
                  color: 'var(--orange, #fb923c)', bg: 'rgba(251,146,60,0.09)', border: '#fb923c66',
                  pulse: gridExport > 0,
                  small: true,
                },
                {
                  ...POS.recovered,
                  icon: Zap, label: 'Power Recovered', sublabel: 'CCES→BUS',
                  value: ccesCharge, unit: 'kW',
                  color: 'var(--primary-action)', bg: 'rgba(0,245,160,0.07)', border: '#00f5a055',
                  pulse: ccesCharge > 0,
                  small: true,
                },
              ].map(({ x, y, small, ...props }, i) => {
                const xPct = (x / W) * 100;
                const yPct = (y / H) * 100;
                return (
                  <div key={i} style={{
                    position: 'absolute',
                    left: `${xPct}%`,
                    top: `${yPct}%`,
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'all',
                    zIndex: 10,
                  }}>
                    <NodeCard small={small} {...props} />
                  </div>
                );
              })}
              
              {/* AI Hub */}
              <div style={{
                position: 'absolute',
                left: `${(POS.aiHub.x / W) * 100}%`,
                top: `${(POS.aiHub.y / H) * 100}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: 15,
                pointerEvents: 'all',
              }}>
                <div className="animate-pulse-slow" style={{
                  width: 130, height: 130, borderRadius: '50%',
                  background: 'var(--surface-0)',
                  border: '2px solid var(--tertiary)',
                  boxShadow: '0 0 40px rgba(245,158,11,0.25), inset 0 0 30px rgba(245,158,11,0.06)',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 4,
                  backdropFilter: 'blur(16px)',
                }}>
                  <Cpu size={24} color="var(--tertiary)" />
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>AI + EMS</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, color: 'var(--tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.5 }}>
                    Intelligent<br />Orchestrator
                  </div>
                  <span className="live-dot" />
                </div>
              </div>
            </div>
          </div>

          {/* ── Flow breakdown row ───────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: 'Battery Charging',  value: battCharge,  color: 'var(--purple, #a78bfa)', max: 120, icon: Battery   },
              { label: 'CCES Compression',  value: ccesCharge,  color: 'var(--primary-action)', max: 100, icon: Database  },
              { label: 'Grid Export',       value: gridExport,  color: 'var(--orange, #fb923c)', max: 80,  icon: Globe     },
              { label: 'Curtailed',         value: curtailed,   color: 'var(--error)', max: 50,  icon: Thermometer},
            ].map(({ label, value, color, max, icon: Icon }) => (
              <div key={label} className="glass" style={{ padding: 16, borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: `color-mix(in srgb, ${color} 9%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 27%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={14} color={color} />
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--on-surface-var)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</div>
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 22, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', marginBottom: 8 }}>
                  {value} <span style={{ fontSize: 11, color: 'var(--on-surface-var)' }}>kW</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${Math.min((value / max) * 100, 100)}%`, background: color }} />
                </div>
              </div>
            ))}
          </div>

          {/* ── Node Status Registry ─────────────────────────────────── */}
          <div className="glass" style={{ padding: 24, borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div className="text-headline-sm" style={{ color: 'var(--on-surface)' }}>Node Status Registry</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="live-dot" />
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--on-surface-var)', letterSpacing: '0.06em' }}>UPDATING EVERY 2s</span>
              </div>
            </div>
            <table className="telem-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Node ID</th>
                  <th>Type</th>
                  <th>Output</th>
                  <th>Efficiency</th>
                  <th>Flow Direction</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { id: 'PV-01',   type: 'Solar Generator',   output: `${solar.toFixed(0)} kW`,    eff: '91%', dir: '→ AC BUS',     status: 'green',  label: solar > 50 ? 'OPTIMAL' : 'PARTIAL' },
                  { id: 'WT-03',   type: 'Wind Generator',    output: `${wind.toFixed(0)} kW`,     eff: '88%', dir: '→ AC BUS',     status: 'green',  label: 'OPTIMAL' },
                  { id: 'IND-1',   type: 'Industrial Load',   output: `${demand} kW`,              eff: '—',   dir: '← GRID',       status: 'amber',  label: 'DEMAND' },
                  { id: 'BESS-A',  type: 'Battery Storage',   output: `${batt.toFixed(1)}% SOC`,   eff: '96%', dir: battCharge > 0 ? '← CHARGING' : '→ DISCHARGE', status: 'cyan',   label: battCharge > 0 ? 'CHARGING' : 'IDLE' },
                  { id: 'CCES-1',  type: 'CO₂ Storage',       output: `${cces.toFixed(1)}% CAP`,   eff: '82%', dir: '← CO₂ IN',     status: 'green',  label: 'ACTIVE' },
                  { id: 'DAC-01',  type: 'CO₂ Capture',       output: `${co2} t/hr`,               eff: '79%', dir: '→ CCES',       status: 'green',  label: 'RUNNING' },
                  { id: 'GTI-1',   type: 'Grid Tie Inverter', output: `${gridExport} kW`,          eff: '99%', dir: '→ UTILITY',    status: gridExport > 0 ? 'amber' : 'cyan', label: gridExport > 0 ? 'EXPORT' : 'STANDBY' },
                ].map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--on-surface)', fontWeight: 600 }}>{r.id}</td>
                    <td style={{ fontSize: 12, color: 'var(--on-surface-var)' }}>{r.type}</td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--on-surface)', fontVariantNumeric: 'tabular-nums' }}>{r.output}</td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--on-surface-var)' }}>{r.eff}</td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--on-surface-var)', letterSpacing: '0.04em' }}>{r.dir}</td>
                    <td><span className={`badge-${r.status} telem-sm`}>{r.label}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Right Column: Digital Twin Inputs ───────────────────── */}
        <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          <div className="glass" style={{ padding: 24, borderRadius: 8 }}>
            <div className="text-headline-sm" style={{ color: 'var(--on-surface)', marginBottom: 20 }}>Digital Twin Inputs</div>
            
            {/* Renewable Inputs */}
            <div style={{ marginBottom: 24 }}>
              <div className="telem-sm" style={{ color: 'var(--primary-action)', marginBottom: 12 }}>RENEWABLE CAPACITY</div>
              
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label style={{ fontSize: 13, color: 'var(--on-surface-var)' }}>Solar Capacity</label>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--on-surface)' }}>{solarCap} kW</span>
                </div>
                <input type="range" min="100" max="1000" step="10" value={solarCap} onChange={e => setSolarCap(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--tertiary)' }} />
              </div>
              
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label style={{ fontSize: 13, color: 'var(--on-surface-var)' }}>Wind Capacity</label>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--on-surface)' }}>{windCap} kW</span>
                </div>
                <input type="range" min="50" max="500" step="10" value={windCap} onChange={e => setWindCap(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--secondary)' }} />
              </div>
            </div>
            
            {/* Demand Inputs */}
            <div style={{ marginBottom: 24 }}>
              <div className="telem-sm" style={{ color: 'var(--error)', marginBottom: 12 }}>DEMAND</div>
              
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label style={{ fontSize: 13, color: 'var(--on-surface-var)' }}>Expected Demand</label>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--on-surface)' }}>{baseDemand} kW</span>
                </div>
                <input type="range" min="100" max="600" step="10" value={baseDemand} onChange={e => setBaseDemand(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--error)' }} />
              </div>
            </div>

            {/* Storage Inputs */}
            <div>
              <div className="telem-sm" style={{ color: 'var(--purple, #a78bfa)', marginBottom: 12 }}>STORAGE (BESS)</div>
              
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label style={{ fontSize: 13, color: 'var(--on-surface-var)' }}>Max Charge Rate</label>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--on-surface)' }}>120 kW</span>
                </div>
                <input type="range" min="50" max="250" step="10" defaultValue="120" style={{ width: '100%', accentColor: '#a78bfa' }} />
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
