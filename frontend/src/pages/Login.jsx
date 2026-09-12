import { Zap, Server, Activity, ArrowRight, ShieldCheck } from 'lucide-react';

export default function Login({ onLogin }) {
  const roles = [
    {
      id: 'operator',
      title: 'Grid Operator',
      desc: 'Full system oversight, dispatch control, and grid balancing.',
      icon: Activity,
      color: 'var(--primary-action)'
    },
    {
      id: 'plant_owner',
      title: 'Plant Owner',
      desc: 'Asset-level forecasting, curtailment risk, and maintenance.',
      icon: Zap,
      color: 'var(--secondary)'
    },
    {
      id: 'utility',
      title: 'Utility Manager',
      desc: 'Demand response, macro portfolio view, and backup planning.',
      icon: Server,
      color: '#a78bfa'
    }
  ];

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at 50% 0%, rgba(0, 245, 160, 0.08) 0%, rgba(13, 19, 32, 1) 50%)',
      padding: 24,
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{ maxWidth: 800, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        
        {/* Logo Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 48, animation: 'float-up 0.5s ease-out' }}>
          <div style={{
            width: 56, height: 56,
            background: 'rgba(0, 245, 160, 0.12)',
            border: '1px solid rgba(0, 245, 160, 0.3)',
            borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 24px rgba(0, 245, 160, 0.2)',
          }}>
            <Zap size={28} color="var(--primary-action)" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 32, letterSpacing: '-0.02em', color: 'var(--primary)' }}>
              RenewIQ
            </div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, letterSpacing: '0.15em', color: 'var(--primary-action)', textTransform: 'uppercase', marginTop: 2 }}>
              Intelligence Platform
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 40, animation: 'float-up 0.6s ease-out' }}>
          <h1 className="text-headline-lg" style={{ color: 'var(--on-surface)', marginBottom: 12 }}>Select Demo Environment</h1>
          <p className="text-body-md" style={{ color: 'var(--on-surface-var)', maxWidth: 500, margin: '0 auto' }}>
            Choose an operational role to launch the personalized workspace. 
            Authentication is bypassed for the Hackout '26 prototype demo.
          </p>
        </div>

        {/* Roles Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24, width: '100%', animation: 'float-up 0.7s ease-out' }}>
          {roles.map((role) => (
            <div 
              key={role.id}
              onClick={() => onLogin(role)}
              style={{
                background: 'rgba(17, 24, 60, 0.4)',
                border: `1px solid color-mix(in srgb, ${role.color} 27%, transparent)`,
                borderRadius: 12,
                padding: 24,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(17, 24, 60, 0.8)';
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = `0 8px 24px color-mix(in srgb, ${role.color} 13%, transparent)`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(17, 24, 60, 0.4)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ 
                width: 48, height: 48, borderRadius: 10, 
                background: `color-mix(in srgb, ${role.color} 8%, transparent)`, border: `1px solid color-mix(in srgb, ${role.color} 27%, transparent)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center' 
              }}>
                <role.icon size={24} color={role.color} />
              </div>
              
              <div>
                <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--on-surface)', marginBottom: 8 }}>{role.title}</div>
                <div style={{ fontSize: 14, color: 'var(--on-surface-var)', lineHeight: 1.5 }}>{role.desc}</div>
              </div>

              <div style={{ marginTop: 'auto', paddingTop: 16, display: 'flex', alignItems: 'center', color: role.color, fontSize: 13, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.05em' }}>
                LAUNCH WORKSPACE <ArrowRight size={14} style={{ marginLeft: 6 }} />
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 48, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--on-surface-var)', fontSize: 12, opacity: 0.6, animation: 'float-up 0.8s ease-out' }}>
          <ShieldCheck size={14} /> Secured via Mock Auth Module for Demo Purposes
        </div>

      </div>
    </div>
  );
}
