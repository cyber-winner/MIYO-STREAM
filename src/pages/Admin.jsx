import React, { useState, useEffect, useCallback, useRef } from 'react';

// ── Auth Helper ──
const ADMIN_TOKEN_KEY = 'miyo_admin_token';
function getToken() { return localStorage.getItem(ADMIN_TOKEN_KEY) || ''; }
function setToken(t) { localStorage.setItem(ADMIN_TOKEN_KEY, t); }
function clearToken() { localStorage.removeItem(ADMIN_TOKEN_KEY); }

async function adminFetch(url, opts = {}) {
  const token = getToken();
  const res = await fetch(url, {
    ...opts,
    headers: { ...opts.headers, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (res.status === 401) { clearToken(); window.location.reload(); }
  return res;
}

// ── Formatting ──
function timeAgo(date) {
  if (!date) return '—';
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
function formatUptime(s) {
  const d = Math.floor(s / 86400); const h = Math.floor((s % 86400) / 3600); const m = Math.floor((s % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}
function formatBytes(b) {
  if (b < 1024) return `${b}B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)}KB`;
  return `${(b / 1048576).toFixed(1)}MB`;
}
function truncate(s, n = 16) { return s && s.length > n ? s.slice(0, n) + '…' : s || '—'; }

// ═══════════════════════════════════════════════════════════════
// LOGIN SCREEN
// ═══════════════════════════════════════════════════════════════
function LoginScreen({ onLogin }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const btnRef = useRef(null);

  useEffect(() => {
    if (!window.google?.accounts?.id) {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          initGoogleSignIn();
        }
      }, 200);
      return () => clearInterval(interval);
    } else {
      initGoogleSignIn();
    }

    function initGoogleSignIn() {
      window.google.accounts.id.initialize({
        client_id: '1007905034000-tfe4qlg32ovgvoi3v422r0cls58gt58r.apps.googleusercontent.com',
        callback: handleCredentialResponse,
      });
      if (btnRef.current) {
        window.google.accounts.id.renderButton(btnRef.current, {
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text: 'signin_with',
          width: 300,
        });
      }
    }

    async function handleCredentialResponse(response) {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/admin/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential: response.credential }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || 'Authentication failed'); setLoading(false); return; }
        setToken(data.token);
        onLogin(data.user);
      } catch (e) {
        setError('Network error. Please try again.');
        setLoading(false);
      }
    }
  }, [onLogin]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050505' }}>
      <div style={{
        background: '#0a0a0b', border: '1px solid #1c1c1f', borderRadius: 24, padding: 48,
        maxWidth: 420, width: '90%', textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🛡️</div>
        <h1 style={{ color: '#f0f2f5', fontSize: 28, fontWeight: 800, fontFamily: 'Outfit, Inter, sans-serif', margin: '0 0 8px', letterSpacing: -1 }}>
          MIYO <span style={{ color: '#00f2ff' }}>Admin</span>
        </h1>
        <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 32px' }}>Restricted access. Sign in with your authorized Google account.</p>
        {error && <div style={{ background: 'rgba(255,60,60,0.1)', border: '1px solid rgba(255,60,60,0.3)', borderRadius: 12, padding: '10px 16px', color: '#ff6b6b', fontSize: 13, marginBottom: 20, fontWeight: 600 }}>{error}</div>}
        <div ref={btnRef} style={{ display: 'flex', justifyContent: 'center', opacity: loading ? 0.5 : 1, pointerEvents: loading ? 'none' : 'auto' }} />
        {loading && <p style={{ color: '#00f2ff', fontSize: 13, marginTop: 16 }}>Verifying identity...</p>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STAT CARD
// ═══════════════════════════════════════════════════════════════
const StatCard = ({ label, value, icon, accent }) => (
  <div style={{
    background: '#0a0a0b', border: '1px solid #1c1c1f', borderRadius: 16, padding: '20px 24px',
    flex: '1 1 180px', minWidth: 160, transition: 'border-color 0.2s',
  }}
    onMouseEnter={e => e.currentTarget.style.borderColor = accent || '#00f2ff'}
    onMouseLeave={e => e.currentTarget.style.borderColor = '#1c1c1f'}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{ color: '#6b7280', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>
    </div>
    <div style={{ color: '#f0f2f5', fontSize: 28, fontWeight: 800, fontFamily: 'Outfit, monospace' }}>{value ?? '—'}</div>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// MINI BAR CHART (CSS only)
// ═══════════════════════════════════════════════════════════════
const MiniBarChart = ({ data, label = 'count', maxBars = 24 }) => {
  if (!data?.length) return <div style={{ color: '#6b7280', fontSize: 13, padding: 16 }}>No data</div>;
  const sliced = data.slice(-maxBars);
  const max = Math.max(...sliced.map(d => d[label] || d.count || 0), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80, padding: '8px 0' }}>
      {sliced.map((d, i) => {
        const val = d[label] || d.count || 0;
        const h = Math.max((val / max) * 70, 2);
        return (
          <div key={i} title={`${d._id || ''}: ${val}`} style={{
            flex: 1, height: h, background: 'linear-gradient(to top, #00f2ff, #0066ff)',
            borderRadius: '3px 3px 0 0', minWidth: 4, transition: 'height 0.3s',
          }} />
        );
      })}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TABLE COMPONENT
// ═══════════════════════════════════════════════════════════════
const Table = ({ columns, data, onRowClick, emptyMsg = 'No data' }) => (
  <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr>{columns.map((c, i) => (
          <th key={i} style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid #1c1c1f', whiteSpace: 'nowrap' }}>{c.label}</th>
        ))}</tr>
      </thead>
      <tbody>
        {(!data || data.length === 0) ? (
          <tr><td colSpan={columns.length} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>{emptyMsg}</td></tr>
        ) : data.map((row, ri) => (
          <tr key={ri} style={{ cursor: onRowClick ? 'pointer' : 'default', transition: 'background 0.15s' }}
            onClick={() => onRowClick?.(row)}
            onMouseEnter={e => e.currentTarget.style.background = '#141416'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {columns.map((c, ci) => (
              <td key={ci} style={{ padding: '10px 12px', color: '#f0f2f5', borderBottom: '1px solid #0d0d0e', whiteSpace: 'nowrap', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.render ? c.render(row) : (row[c.key] ?? '—')}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// BAN MODAL
// ═══════════════════════════════════════════════════════════════
function BanModal({ type = 'ip', value = '', onClose, onBan }) {
  const [reason, setReason] = useState('');
  const [expiry, setExpiry] = useState('');
  const [loading, setLoading] = useState(false);

  const handleBan = async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/ban', {
        method: 'POST',
        body: JSON.stringify({ type, value, reason, expiresAt: expiry || null }),
      });
      const data = await res.json();
      if (res.ok) { onBan(data.ban); onClose(); }
    } catch (e) {} finally { setLoading(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={onClose}>
      <div style={{ background: '#0a0a0b', border: '1px solid #1c1c1f', borderRadius: 20, padding: 32, maxWidth: 440, width: '90%' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ color: '#f0f2f5', fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>🚫 Ban {type === 'ip' ? 'IP' : 'Device'}</h3>
        <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 20px' }}>{value}</p>
        <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (optional)"
          style={{ width: '100%', padding: '10px 14px', background: '#141416', border: '1px solid #1c1c1f', borderRadius: 10, color: '#f0f2f5', fontSize: 14, marginBottom: 12, outline: 'none', boxSizing: 'border-box' }} />
        <input type="datetime-local" value={expiry} onChange={e => setExpiry(e.target.value)}
          style={{ width: '100%', padding: '10px 14px', background: '#141416', border: '1px solid #1c1c1f', borderRadius: 10, color: '#f0f2f5', fontSize: 14, marginBottom: 20, outline: 'none', boxSizing: 'border-box' }} />
        <p style={{ color: '#6b7280', fontSize: 11, marginTop: -12, marginBottom: 16 }}>Leave empty for permanent ban</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px 0', background: '#141416', border: '1px solid #1c1c1f', borderRadius: 10, color: '#9ca3af', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleBan} disabled={loading} style={{ flex: 1, padding: '10px 0', background: '#ff4444', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.5 : 1 }}>{loading ? 'Banning...' : 'Ban'}</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DEVICE DETAIL MODAL
// ═══════════════════════════════════════════════════════════════
function DeviceDetailModal({ device, onClose, onBan }) {
  if (!device) return null;
  const { components = {}, summary = {} } = device;

  const Section = ({ title, children }) => (
    <div style={{ marginBottom: 16 }}>
      <h4 style={{ color: '#00f2ff', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px', borderBottom: '1px solid #1c1c1f', paddingBottom: 6 }}>{title}</h4>
      {children}
    </div>
  );
  const Field = ({ label, value }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span style={{ color: '#f0f2f5', fontFamily: 'monospace', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right', whiteSpace: 'nowrap' }}>{String(value ?? '—')}</span>
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 9998, overflowY: 'auto', padding: '40px 16px' }} onClick={onClose}>
      <div style={{ background: '#0a0a0b', border: '1px solid #1c1c1f', borderRadius: 20, padding: 32, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h3 style={{ color: '#f0f2f5', fontSize: 20, fontWeight: 800, margin: 0 }}>🔍 Device Details</h3>
            <p style={{ color: '#6b7280', fontSize: 12, fontFamily: 'monospace', margin: '4px 0 0' }}>{device.fingerprintId}</p>
          </div>
          <button onClick={() => onBan(device.fingerprintId)} style={{ padding: '8px 16px', background: '#ff4444', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>🚫 Ban</button>
        </div>

        <Section title="Overview">
          <Field label="First Seen" value={new Date(device.firstSeen).toLocaleString()} />
          <Field label="Last Seen" value={timeAgo(device.lastSeen)} />
          <Field label="Visit Count" value={device.visitCount} />
          <Field label="Known IPs" value={device.ips?.join(', ')} />
        </Section>

        <Section title="Layer 1: Graphics">
          <Field label="GPU Vendor" value={components.webgl?.vendor} />
          <Field label="GPU Renderer" value={components.webgl?.renderer} />
          <Field label="Max Texture Size" value={components.webgl?.maxTextureSize} />
          <Field label="WebGL Version" value={components.webgl?.glVersion} />
          <Field label="Extensions" value={components.webgl?.extensions?.length + ' extensions'} />
          <Field label="Render Hash" value={components.webgl?.renderHash} />
          <Field label="Canvas Hash" value={components.canvas ? truncate(components.canvas, 40) : '—'} />
        </Section>

        <Section title="Layer 2: Audio">
          <Field label="Audio Hash" value={components.audio?.hash} />
          <Field label="Sample Rate" value={components.audio?.sampleRate} />
          <Field label="Channel Count" value={components.audio?.channelCount} />
          <Field label="Max Channels" value={components.audio?.maxChannelCount} />
        </Section>

        <Section title="Layer 3: Hardware">
          <Field label="CPU Cores" value={summary.cpuCores} />
          <Field label="Device Memory" value={summary.deviceMemory ? summary.deviceMemory + ' GB' : '—'} />
          <Field label="Screen" value={summary.screen} />
          <Field label="Color Depth" value={components.hardware?.screen?.colorDepth} />
          <Field label="Pixel Ratio" value={components.hardware?.screen?.devicePixelRatio} />
          <Field label="Color Gamut" value={components.hardware?.colorGamut} />
          <Field label="HDR Support" value={String(components.hardware?.hdrSupport)} />
          <Field label="Max Touch Points" value={components.hardware?.maxTouchPoints} />
        </Section>

        <Section title="Layer 4: Fonts & Speech">
          <Field label="Detected Fonts" value={summary.fontCount} />
          <Field label="TTS Voices" value={summary.voiceCount} />
          {components.fonts?.length > 0 && (
            <div style={{ marginTop: 8, padding: 8, background: '#141416', borderRadius: 8, maxHeight: 80, overflowY: 'auto', fontSize: 11, color: '#9ca3af', fontFamily: 'monospace', lineHeight: 1.6 }}>
              {components.fonts.join(' · ')}
            </div>
          )}
        </Section>

        <Section title="Layer 5: Browser">
          <Field label="Browser" value={summary.browser} />
          <Field label="OS" value={summary.os} />
          <Field label="JS Engine" value={components.browser?.jsEngine} />
          <Field label="Platform" value={components.browser?.platform} />
          <Field label="PDF Viewer" value={String(components.browser?.pdfViewerEnabled)} />
          <Field label="Cookies" value={String(components.browser?.cookiesEnabled)} />
          <Field label="DNT" value={components.browser?.doNotTrack} />
        </Section>

        <Section title="Layer 6: Locale & Time">
          <Field label="Timezone" value={summary.timezone} />
          <Field label="UTC Offset" value={components.locale?.timezoneOffset + ' min'} />
          <Field label="DST" value={String(components.locale?.hasDST)} />
          <Field label="Language" value={summary.language} />
          <Field label="Languages" value={components.locale?.languages?.join(', ')} />
        </Section>

        <Section title="Layer 7: Accessibility">
          <Field label="Color Scheme" value={components.accessibility?.prefersColorScheme} />
          <Field label="Reduced Motion" value={String(components.accessibility?.prefersReducedMotion)} />
          <Field label="High Contrast" value={String(components.accessibility?.prefersContrast)} />
          <Field label="Forced Colors" value={String(components.accessibility?.forcedColors)} />
        </Section>

        <Section title="Layer 8: Network">
          <Field label="Connection Type" value={components.network?.effectiveType} />
          <Field label="Downlink" value={components.network?.downlink ? components.network.downlink + ' Mbps' : '—'} />
          <Field label="RTT" value={components.network?.rtt ? components.network.rtt + ' ms' : '—'} />
          <Field label="Save Data" value={String(components.network?.saveData)} />
        </Section>

        <button onClick={onClose} style={{ width: '100%', padding: '12px 0', background: '#141416', border: '1px solid #1c1c1f', borderRadius: 12, color: '#9ca3af', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 8 }}>Close</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN ADMIN DASHBOARD
// ═══════════════════════════════════════════════════════════════
function Dashboard({ user, onLogout }) {
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [devices, setDevices] = useState({ devices: [], total: 0, pages: 0 });
  const [analytics, setAnalytics] = useState(null);
  const [abuse, setAbuse] = useState(null);
  const [bans, setBans] = useState([]);
  const [requests, setRequests] = useState({ requests: [], total: 0 });
  const [deviceSearch, setDeviceSearch] = useState('');
  const [devicePage, setDevicePage] = useState(1);
  const [requestFilter, setRequestFilter] = useState({ ip: '', endpoint: '' });
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [banModal, setBanModal] = useState(null);
  const [loading, setLoading] = useState(false);
  const refreshRef = useRef(null);

  const load = useCallback(async (activeTab) => {
    const t = activeTab || tab;
    setLoading(true);
    try {
      if (t === 'overview') {
        const res = await adminFetch('/api/admin/stats');
        setStats(await res.json());
      } else if (t === 'devices') {
        const res = await adminFetch(`/api/admin/devices?page=${devicePage}&search=${encodeURIComponent(deviceSearch)}`);
        setDevices(await res.json());
      } else if (t === 'analytics') {
        const res = await adminFetch('/api/admin/analytics?hours=24');
        setAnalytics(await res.json());
      } else if (t === 'abuse') {
        const res = await adminFetch('/api/admin/analytics/abuse');
        setAbuse(await res.json());
      } else if (t === 'bans') {
        const res = await adminFetch('/api/admin/bans');
        const data = await res.json();
        setBans(data.bans || []);
      } else if (t === 'requests') {
        const params = new URLSearchParams({ page: 1, limit: 100 });
        if (requestFilter.ip) params.set('ip', requestFilter.ip);
        if (requestFilter.endpoint) params.set('endpoint', requestFilter.endpoint);
        const res = await adminFetch(`/api/admin/requests?${params}`);
        setRequests(await res.json());
      }
    } catch (e) { console.error('Load error:', e); }
    setLoading(false);
  }, [tab, devicePage, deviceSearch, requestFilter]);

  useEffect(() => { load(); }, [tab, devicePage]);
  useEffect(() => {
    // Auto-refresh every 30s
    refreshRef.current = setInterval(() => load(), 30000);
    return () => clearInterval(refreshRef.current);
  }, [load]);

  const switchTab = (t) => { setTab(t); };

  const handleBanFromModal = async (ban) => {
    setBanModal(null);
    load();
    if (tab === 'bans') { const res = await adminFetch('/api/admin/bans'); setBans((await res.json()).bans || []); }
  };

  const handleUnban = async (id) => {
    await adminFetch(`/api/admin/ban/${id}`, { method: 'DELETE' });
    const res = await adminFetch('/api/admin/bans');
    setBans((await res.json()).bans || []);
  };

  const handleDeviceClick = async (device) => {
    try {
      const res = await adminFetch(`/api/admin/devices/${device.fingerprintId}`);
      const data = await res.json();
      setSelectedDevice(data.device);
    } catch (e) {}
  };

  const TABS = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'devices', label: 'Devices', icon: '📱' },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
    { id: 'abuse', label: 'Abuse', icon: '⚠️' },
    { id: 'bans', label: 'Bans', icon: '🚫' },
    { id: 'requests', label: 'Requests', icon: '📋' },
  ];

  const sidebarStyle = {
    width: 220, background: '#0a0a0b', borderRight: '1px solid #1c1c1f', padding: '20px 0',
    display: 'flex', flexDirection: 'column', height: '100vh', position: 'fixed', left: 0, top: 0, zIndex: 100,
  };

  const tabBtnStyle = (active) => ({
    display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', margin: '2px 8px',
    background: active ? 'rgba(0,242,255,0.08)' : 'transparent', border: 'none', borderRadius: 10,
    color: active ? '#00f2ff' : '#9ca3af', fontSize: 14, fontWeight: active ? 700 : 500,
    cursor: 'pointer', textAlign: 'left', fontFamily: 'Outfit, Inter, sans-serif', transition: 'all 0.15s',
    borderLeft: active ? '3px solid #00f2ff' : '3px solid transparent',
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#050505', fontFamily: 'Outfit, Inter, sans-serif' }}>
      {/* Sidebar */}
      <div style={sidebarStyle}>
        <div style={{ padding: '8px 20px 24px', borderBottom: '1px solid #1c1c1f', marginBottom: 8 }}>
          <h2 style={{ color: '#f0f2f5', fontSize: 20, fontWeight: 800, margin: 0 }}>🛡️ MIYO <span style={{ color: '#00f2ff' }}>Admin</span></h2>
        </div>
        {TABS.map(t => (
          <button key={t.id} onClick={() => switchTab(t.id)} style={tabBtnStyle(tab === t.id)}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
        <div style={{ marginTop: 'auto', padding: '16px 20px', borderTop: '1px solid #1c1c1f' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            {user?.picture && <img src={user.picture} alt="" style={{ width: 28, height: 28, borderRadius: 14 }} />}
            <span style={{ color: '#9ca3af', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</span>
          </div>
          <button onClick={onLogout} style={{ width: '100%', padding: '8px 0', background: '#141416', border: '1px solid #1c1c1f', borderRadius: 8, color: '#9ca3af', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Sign Out</button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ marginLeft: 220, flex: 1, padding: '24px 32px', minHeight: '100vh', overflowX: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ color: '#f0f2f5', fontSize: 24, fontWeight: 800, margin: 0 }}>
            {TABS.find(t => t.id === tab)?.icon} {TABS.find(t => t.id === tab)?.label}
          </h1>
          <button onClick={() => load()} style={{ padding: '8px 16px', background: '#141416', border: '1px solid #1c1c1f', borderRadius: 8, color: '#00f2ff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
            {loading ? '⏳' : '🔄'} Refresh
          </button>
        </div>

        {/* ── Overview Tab ── */}
        {tab === 'overview' && stats && (
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
              <StatCard label="Total Devices" value={stats.totalDevices} icon="📱" />
              <StatCard label="Unique IPs Today" value={stats.uniqueIpsToday} icon="🌐" />
              <StatCard label="Requests Today" value={stats.requestsToday?.toLocaleString()} icon="📊" />
              <StatCard label="Requests/Hour" value={stats.requestsPerHour?.toLocaleString()} icon="⚡" />
              <StatCard label="Rate Limits Hit" value={stats.rateLimitHitsToday} icon="🛑" accent="#ff4444" />
              <StatCard label="Active Bans" value={stats.totalBans} icon="🚫" accent="#ff6600" />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ flex: '1 1 300px', background: '#0a0a0b', border: '1px solid #1c1c1f', borderRadius: 16, padding: 20 }}>
                <h3 style={{ color: '#f0f2f5', fontSize: 14, fontWeight: 700, margin: '0 0 8px' }}>Server</h3>
                <div style={{ fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', color: '#9ca3af' }}><span>Uptime</span><span style={{ color: '#f0f2f5', fontFamily: 'monospace' }}>{formatUptime(stats.serverUptime)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', color: '#9ca3af' }}><span>Heap Used</span><span style={{ color: '#f0f2f5', fontFamily: 'monospace' }}>{formatBytes(stats.memoryUsage?.heapUsed)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', color: '#9ca3af' }}><span>RSS</span><span style={{ color: '#f0f2f5', fontFamily: 'monospace' }}>{formatBytes(stats.memoryUsage?.rss)}</span></div>
                </div>
              </div>
              <div style={{ flex: '2 1 400px', background: '#0a0a0b', border: '1px solid #1c1c1f', borderRadius: 16, padding: 20 }}>
                <h3 style={{ color: '#f0f2f5', fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>Quick Actions</h3>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                  <button onClick={() => switchTab('devices')} style={{ padding: '10px 18px', background: '#141416', border: '1px solid #1c1c1f', borderRadius: 10, color: '#00f2ff', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>📱 View Devices</button>
                  <button onClick={() => setBanModal({ type: 'ip', value: '' })} style={{ padding: '10px 18px', background: '#141416', border: '1px solid #1c1c1f', borderRadius: 10, color: '#ff4444', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>🚫 Ban IP</button>
                  <button onClick={() => switchTab('abuse')} style={{ padding: '10px 18px', background: '#141416', border: '1px solid #1c1c1f', borderRadius: 10, color: '#ffaa00', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>⚠️ Check Abuse</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Devices Tab ── */}
        {tab === 'devices' && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <input value={deviceSearch} onChange={e => setDeviceSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()}
                placeholder="Search by IP, browser, OS, GPU, timezone..."
                style={{ flex: 1, padding: '10px 16px', background: '#0a0a0b', border: '1px solid #1c1c1f', borderRadius: 10, color: '#f0f2f5', fontSize: 14, outline: 'none' }} />
              <button onClick={() => { setDevicePage(1); load(); }} style={{ padding: '10px 20px', background: '#00f2ff', border: 'none', borderRadius: 10, color: '#050505', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Search</button>
            </div>
            <div style={{ background: '#0a0a0b', border: '1px solid #1c1c1f', borderRadius: 16, overflow: 'hidden' }}>
              <Table
                columns={[
                  { label: 'Fingerprint', key: 'fingerprintId', render: r => <span style={{ fontFamily: 'monospace', color: '#00f2ff' }}>{truncate(r.fingerprintId, 12)}</span> },
                  { label: 'IPs', render: r => truncate(r.ips?.join(', '), 24) },
                  { label: 'Browser', render: r => r.summary?.browser || '—' },
                  { label: 'OS', render: r => r.summary?.os || '—' },
                  { label: 'GPU', render: r => truncate(r.summary?.gpu, 30) },
                  { label: 'Screen', render: r => r.summary?.screen || '—' },
                  { label: 'Visits', key: 'visitCount' },
                  { label: 'Last Seen', render: r => timeAgo(r.lastSeen) },
                  { label: 'Actions', render: r => (
                    <button onClick={e => { e.stopPropagation(); setBanModal({ type: 'fingerprint', value: r.fingerprintId }); }}
                      style={{ padding: '4px 10px', background: '#ff4444', border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>Ban</button>
                  )},
                ]}
                data={devices.devices}
                onRowClick={handleDeviceClick}
              />
            </div>
            {devices.pages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                <button onClick={() => setDevicePage(p => Math.max(1, p - 1))} disabled={devicePage === 1} style={{ padding: '8px 14px', background: '#141416', border: '1px solid #1c1c1f', borderRadius: 8, color: '#9ca3af', cursor: 'pointer' }}>← Prev</button>
                <span style={{ color: '#6b7280', padding: '8px 12px', fontSize: 13 }}>Page {devicePage} of {devices.pages} ({devices.total} total)</span>
                <button onClick={() => setDevicePage(p => Math.min(devices.pages, p + 1))} disabled={devicePage >= devices.pages} style={{ padding: '8px 14px', background: '#141416', border: '1px solid #1c1c1f', borderRadius: 8, color: '#9ca3af', cursor: 'pointer' }}>Next →</button>
              </div>
            )}
          </div>
        )}

        {/* ── Analytics Tab ── */}
        {tab === 'analytics' && analytics && (
          <div>
            <div style={{ background: '#0a0a0b', border: '1px solid #1c1c1f', borderRadius: 16, padding: 20, marginBottom: 16 }}>
              <h3 style={{ color: '#f0f2f5', fontSize: 14, fontWeight: 700, margin: '0 0 8px' }}>Requests (Last 24h)</h3>
              <MiniBarChart data={analytics.requestsPerHour} label="count" />
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 400px', background: '#0a0a0b', border: '1px solid #1c1c1f', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #1c1c1f' }}><h3 style={{ color: '#f0f2f5', fontSize: 14, fontWeight: 700, margin: 0 }}>Top Endpoints</h3></div>
                <Table columns={[
                  { label: 'Endpoint', key: '_id' },
                  { label: 'Requests', key: 'count' },
                  { label: 'Avg Response', render: r => `${Math.round(r.avgResponseTime || 0)}ms` },
                ]} data={analytics.topEndpoints} />
              </div>
              <div style={{ flex: '1 1 400px', background: '#0a0a0b', border: '1px solid #1c1c1f', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #1c1c1f' }}><h3 style={{ color: '#f0f2f5', fontSize: 14, fontWeight: 700, margin: 0 }}>Top IPs</h3></div>
                <Table columns={[
                  { label: 'IP Address', key: '_id' },
                  { label: 'Requests', key: 'count' },
                  { label: 'Rate Limited', key: 'rateLimitHits', render: r => <span style={{ color: r.rateLimitHits > 0 ? '#ff4444' : '#6b7280' }}>{r.rateLimitHits}</span> },
                  { label: '', render: r => <button onClick={() => setBanModal({ type: 'ip', value: r._id })} style={{ padding: '3px 8px', background: '#ff4444', border: 'none', borderRadius: 4, color: '#fff', fontSize: 10, cursor: 'pointer', fontWeight: 700 }}>Ban</button> },
                ]} data={analytics.topIPs} />
              </div>
            </div>
          </div>
        )}

        {/* ── Abuse Tab ── */}
        {tab === 'abuse' && abuse && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: '#0a0a0b', border: '1px solid #1c1c1f', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #1c1c1f', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#ff4444', fontSize: 16 }}>🛑</span>
                <h3 style={{ color: '#f0f2f5', fontSize: 14, fontWeight: 700, margin: 0 }}>Rate Limit Abusers (Last Hour)</h3>
              </div>
              <Table columns={[
                { label: 'IP', key: '_id' },
                { label: 'Hits', key: 'hits', render: r => <span style={{ color: '#ff4444', fontWeight: 700 }}>{r.hits}</span> },
                { label: '', render: r => <button onClick={() => setBanModal({ type: 'ip', value: r._id })} style={{ padding: '3px 8px', background: '#ff4444', border: 'none', borderRadius: 4, color: '#fff', fontSize: 10, cursor: 'pointer', fontWeight: 700 }}>Ban</button> },
              ]} data={abuse.rateLimitAbusers} emptyMsg="No rate limit abusers detected" />
            </div>
            <div style={{ background: '#0a0a0b', border: '1px solid #1c1c1f', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #1c1c1f', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#ffaa00', fontSize: 16 }}>⚡</span>
                <h3 style={{ color: '#f0f2f5', fontSize: 14, fontWeight: 700, margin: 0 }}>Burst Requests (100+ in 5min)</h3>
              </div>
              <Table columns={[
                { label: 'IP', key: '_id' },
                { label: 'Requests', key: 'count', render: r => <span style={{ color: '#ffaa00', fontWeight: 700 }}>{r.count}</span> },
                { label: 'Endpoints', render: r => r.endpoints?.length || 0 },
                { label: '', render: r => <button onClick={() => setBanModal({ type: 'ip', value: r._id })} style={{ padding: '3px 8px', background: '#ff4444', border: 'none', borderRadius: 4, color: '#fff', fontSize: 10, cursor: 'pointer', fontWeight: 700 }}>Ban</button> },
              ]} data={abuse.burstAbusers} emptyMsg="No burst activity detected" />
            </div>
            <div style={{ background: '#0a0a0b', border: '1px solid #1c1c1f', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #1c1c1f', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#ff00ff', fontSize: 16 }}>🕷️</span>
                <h3 style={{ color: '#f0f2f5', fontSize: 14, fontWeight: 700, margin: 0 }}>Suspected Scrapers (30+ endpoints/hour)</h3>
              </div>
              <Table columns={[
                { label: 'IP', key: '_id' },
                { label: 'Unique Endpoints', key: 'endpointCount', render: r => <span style={{ color: '#ff00ff', fontWeight: 700 }}>{r.endpointCount}</span> },
                { label: 'Total Requests', key: 'totalRequests' },
                { label: '', render: r => <button onClick={() => setBanModal({ type: 'ip', value: r._id })} style={{ padding: '3px 8px', background: '#ff4444', border: 'none', borderRadius: 4, color: '#fff', fontSize: 10, cursor: 'pointer', fontWeight: 700 }}>Ban</button> },
              ]} data={abuse.scrapers} emptyMsg="No scraping patterns detected" />
            </div>
          </div>
        )}

        {/* ── Bans Tab ── */}
        {tab === 'bans' && (
          <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <button onClick={() => setBanModal({ type: 'ip', value: '' })} style={{ padding: '10px 20px', background: '#ff4444', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>🚫 Ban IP</button>
              <button onClick={() => setBanModal({ type: 'fingerprint', value: '' })} style={{ padding: '10px 20px', background: '#ff6600', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>📱 Ban Device</button>
            </div>
            <div style={{ background: '#0a0a0b', border: '1px solid #1c1c1f', borderRadius: 16, overflow: 'hidden' }}>
              <Table columns={[
                { label: 'Type', render: r => <span style={{ color: r.type === 'ip' ? '#00f2ff' : '#ff6600', fontWeight: 700, textTransform: 'uppercase' }}>{r.type}</span> },
                { label: 'Value', key: 'value', render: r => <span style={{ fontFamily: 'monospace' }}>{truncate(r.value, 24)}</span> },
                { label: 'Reason', key: 'reason', render: r => r.reason || '—' },
                { label: 'Status', render: r => <span style={{ color: r.active ? '#ff4444' : '#4ade80', fontWeight: 700 }}>{r.active ? 'ACTIVE' : 'LIFTED'}</span> },
                { label: 'Expires', render: r => r.expiresAt ? new Date(r.expiresAt).toLocaleString() : 'Permanent' },
                { label: 'Banned', render: r => timeAgo(r.bannedAt) },
                { label: 'Actions', render: r => r.active ? (
                  <button onClick={() => handleUnban(r._id)} style={{ padding: '4px 10px', background: '#4ade80', border: 'none', borderRadius: 6, color: '#050505', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>Unban</button>
                ) : '—' },
              ]} data={bans} emptyMsg="No bans configured" />
            </div>
          </div>
        )}

        {/* ── Requests Tab ── */}
        {tab === 'requests' && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <input value={requestFilter.ip} onChange={e => setRequestFilter(f => ({ ...f, ip: e.target.value }))} placeholder="Filter by IP..."
                style={{ flex: 1, padding: '10px 16px', background: '#0a0a0b', border: '1px solid #1c1c1f', borderRadius: 10, color: '#f0f2f5', fontSize: 14, outline: 'none' }} />
              <input value={requestFilter.endpoint} onChange={e => setRequestFilter(f => ({ ...f, endpoint: e.target.value }))} placeholder="Filter by endpoint..."
                style={{ flex: 1, padding: '10px 16px', background: '#0a0a0b', border: '1px solid #1c1c1f', borderRadius: 10, color: '#f0f2f5', fontSize: 14, outline: 'none' }} />
              <button onClick={() => load()} style={{ padding: '10px 20px', background: '#00f2ff', border: 'none', borderRadius: 10, color: '#050505', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Filter</button>
            </div>
            <div style={{ background: '#0a0a0b', border: '1px solid #1c1c1f', borderRadius: 16, overflow: 'hidden' }}>
              <Table columns={[
                { label: 'Time', render: r => new Date(r.timestamp).toLocaleTimeString() },
                { label: 'Method', key: 'method', render: r => <span style={{ color: r.method === 'POST' ? '#ffaa00' : '#00f2ff', fontWeight: 700 }}>{r.method}</span> },
                { label: 'Endpoint', key: 'endpoint' },
                { label: 'IP', key: 'ip' },
                { label: 'Status', key: 'statusCode', render: r => <span style={{ color: r.statusCode >= 400 ? '#ff4444' : r.statusCode === 429 ? '#ffaa00' : '#4ade80' }}>{r.statusCode}</span> },
                { label: 'Time', render: r => `${r.responseTime || 0}ms` },
                { label: 'FP', render: r => r.fingerprintId ? <span style={{ fontFamily: 'monospace', color: '#6b7280' }}>{truncate(r.fingerprintId, 8)}</span> : '—' },
                { label: 'Rate Limited', render: r => r.rateLimited ? <span style={{ color: '#ff4444' }}>⛔</span> : '—' },
              ]} data={requests.requests} emptyMsg="No requests logged" />
            </div>
            <div style={{ color: '#6b7280', fontSize: 12, marginTop: 8, textAlign: 'center' }}>Showing {requests.requests?.length || 0} of {requests.total || 0} requests</div>
          </div>
        )}
      </div>

      {/* Modals */}
      {banModal && (
        <BanModal
          type={banModal.type}
          value={banModal.value}
          onClose={() => setBanModal(null)}
          onBan={handleBanFromModal}
        />
      )}
      {selectedDevice && (
        <DeviceDetailModal
          device={selectedDevice}
          onClose={() => setSelectedDevice(null)}
          onBan={(fpId) => { setSelectedDevice(null); setBanModal({ type: 'fingerprint', value: fpId }); }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════
export function Admin() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) { setChecking(false); return; }
    fetch('/api/admin/auth/verify', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { setUser(data.user); setChecking(false); })
      .catch(() => { clearToken(); setChecking(false); });
  }, []);

  const handleLogout = async () => {
    await fetch('/api/admin/auth/logout', { method: 'POST', headers: { 'Authorization': `Bearer ${getToken()}` } }).catch(() => {});
    clearToken(); setUser(null);
  };

  if (checking) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050505' }}>
      <div style={{ width: 40, height: 40, border: '4px solid #00f2ff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!user) return <LoginScreen onLogin={setUser} />;
  return <Dashboard user={user} onLogout={handleLogout} />;
}
