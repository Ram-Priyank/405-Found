import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Activity, CircleDollarSign,
  Zap, ChevronRight, Settings, Bell, TrendingUp, AlertTriangle, LineChart, FileText, Menu, X, Sun, Moon
} from 'lucide-react';
import Dashboard   from './pages/Dashboard';
import Forecast    from './pages/Forecast';
import RiskAlerts  from './pages/RiskAlerts';
import DigitalTwin from './pages/DigitalTwin';
import Optimization from './pages/Optimization';
import Analytics    from './pages/Analytics';
import Login        from './pages/Login';

const navItems = [
  { path: '/',             label: 'Overview',      sub: 'Live telemetry',    icon: LayoutDashboard },
  { path: '/forecast',     label: 'Forecast',      sub: '24-72h prediction', icon: TrendingUp      },
  { path: '/risk',         label: 'Risk & Alerts', sub: 'Anomaly detection', icon: AlertTriangle   },
  { path: '/digital-twin', label: 'Digital Twin',  sub: 'System simulation', icon: Activity        },
  { path: '/optimization', label: 'Optimization',  sub: 'Scenario planning', icon: Zap             },
  { path: '/analytics',    label: 'Analytics',     sub: 'Historical data',   icon: LineChart       },
];

function FloatingDock({ userRole }) {
  const visibleNavItems = navItems.filter(item => {
    if (userRole.id === 'plant_owner') return !['/digital-twin', '/optimization'].includes(item.path);
    if (userRole.id === 'utility') return !['/digital-twin'].includes(item.path);
    return true;
  });

  return (
    <nav className="floating-dock">
      {visibleNavItems.map(({ path, label, icon: Icon }) => (
        <NavLink
          key={path}
          to={path}
          end={path === '/'}
          className={({ isActive }) => `dock-item ${isActive ? 'active' : ''}`}
        >
          <Icon size={20} strokeWidth={2.5} />
          <div className="dock-label">{label}</div>
        </NavLink>
      ))}
    </nav>
  );
}

function TopHeader({ userRole, onLogout, theme, setTheme }) {
  const location = useLocation();
  const current = navItems.find(n =>
    n.path === '/' ? location.pathname === '/' : location.pathname.startsWith(n.path)
  );

  return (
    <header className="top-pill">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 32, height: 32,
          background: `color-mix(in srgb, ${userRole.color} 9%, transparent)`,
          border: `1px solid color-mix(in srgb, ${userRole.color} 27%, transparent)`,
          borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 12px color-mix(in srgb, ${userRole.color} 20%, transparent)`,
        }}>
          <Zap size={16} color={userRole.color} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginRight: 12 }}>
          <span style={{ fontWeight: 600, fontSize: 13, letterSpacing: '-0.02em', color: 'var(--primary)' }}>
            RenewIQ
          </span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.1em', color: 'var(--on-surface-var)', textTransform: 'uppercase', marginTop: 1 }}>
            {current?.label || 'Platform'}
          </span>
        </div>
      </div>
      
      <div style={{ width: 1, height: 24, background: 'rgba(59, 74, 64, 0.4)' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="badge-green telem-sm">
          <span className="live-dot" style={{ marginRight: 6 }} />
          STABLE
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--on-surface-var)', padding: '4px 8px', borderRadius: 6, transition: 'all 0.2s' }}>
          <Bell size={16} />
          <div style={{
            background: 'rgba(239, 68, 68, 0.2)', color: '#ffb4ab',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 99, fontSize: 10, padding: '0 6px', fontFamily: 'JetBrains Mono, monospace',
          }}>2</div>
        </div>
        <div 
          onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--on-surface-var)', padding: '4px 8px', borderRadius: 6, transition: 'color 0.2s' }}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--on-surface-var)', padding: '4px 8px', borderRadius: 6 }}>
          <Settings size={16} />
        </div>
        
        <div style={{ width: 1, height: 24, background: 'rgba(59, 74, 64, 0.4)' }} />

        <div style={{ 
          display: 'flex', alignItems: 'center', gap: 6, 
          background: `color-mix(in srgb, ${userRole.color} 8%, transparent)`, 
          border: `1px solid color-mix(in srgb, ${userRole.color} 19%, transparent)`, 
          padding: '4px 10px', borderRadius: 6, 
          color: userRole.color, fontSize: 11, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace'
        }}>
          {userRole.title.toUpperCase()}
        </div>
        <button 
          onClick={onLogout}
          style={{ background: 'none', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 6, color: '#ffb4ab', padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', transition: 'background 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          LOGOUT
        </button>
      </div>
    </header>
  );
}

export default function App() {
  const [userRole, setUserRole] = useState(null);
  const [theme, setTheme] = useState('dark');
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    if (userRole && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        (err) => console.warn('Geolocation error:', err)
      );
    }
  }, [userRole]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  if (!userRole) {
    return <Login onLogin={setUserRole} />;
  }

  return (
    <Router>
      <div className="canvas-bg" />
      <div style={{ 
        display: 'flex', 
        minHeight: '100vh', 
        flexDirection: 'column',
        position: 'relative'
      }}>
        <TopHeader userRole={userRole} onLogout={() => setUserRole(null)} theme={theme} setTheme={setTheme} />
        
        <main style={{ 
          flex: 1, 
          padding: '100px 32px 120px 32px',
          maxWidth: '1600px',
          width: '100%',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <Routes>
            <Route path="/"              element={<Dashboard userRole={userRole} coords={coords} />}   />
            <Route path="/forecast"      element={<Forecast coords={coords} />}    />
            <Route path="/risk"          element={<RiskAlerts />}  />
            <Route path="/digital-twin"  element={<DigitalTwin coords={coords} />} />
            <Route path="/optimization"  element={<Optimization />} />
            <Route path="/analytics"     element={<Analytics />}   />
          </Routes>
        </main>

        <FloatingDock userRole={userRole} />
      </div>
    </Router>
  );
}
