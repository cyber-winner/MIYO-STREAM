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
  if (s == null || isNaN(s)) return '—';
  const d = Math.floor(s / 86400); const h = Math.floor((s % 86400) / 3600); const m = Math.floor((s % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}
function formatBytes(b) {
  if (b == null || isNaN(b)) return '—';
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
          theme: 'filled_black', size: 'large', width: 300, text: 'signin_with',
        });
      }
    }
  }, []);

  async function handleCredentialResponse(response) {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        setToken(data.token);
        onLogin(data);
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (e) {
      setError('Network error');
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
      <div style={{ textAlign: 'center', background: '#111', borderRadius: 24, padding: '60px 48px', border: '1px solid #222', maxWidth: 420 }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🔒</div>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#fff', margin: '0 0 8px' }}>MIYO <span style={{ color: '#00d4aa' }}>Admin</span></h1>
        <p style={{ color: '#888', fontSize: 14, margin: '0 0 32px' }}>Restricted access — authorized personnel only</p>
        {error && <div style={{ background: '#ff000020', border: '1px solid #ff000040', borderRadius: 12, padding: '12px', marginBottom: 20, color: '#ff6b6b', fontSize: 13 }}>{error}</div>}
        <div ref={btnRef} style={{ display: 'flex', justifyContent: 'center' }} />
        {loading && <p style={{ color: '#888', fontSize: 13, marginTop: 16 }}>Authenticating...</p>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════
const TABS = [
  { id: 'overview', icon: '📊', label: 'Overview' },
  { id: 'devices', icon: '📱', label: 'Devices' },
  { id: 'analytics', icon: '📈', label: 'Analytics' },
  { id: 'content', icon: '🎬', label: 'Content' },
  { id: 'abuse', icon: '⚠️', label: 'Abuse' },
  { id: 'bans', icon: '🚫', label: 'Bans' },
  { id: 'requests', icon: '📋', label: 'Requests' },
];

function Dashboard({ user, onLogout }) {
  // Inject spin animation for refresh button (inline styles can't do @keyframes)
  useEffect(() => {
    if (!document.getElementById('admin-spin-css')) {
      const style = document.createElement('style');
      style.id = 'admin-spin-css';
      style.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
      document.head.appendChild(style);
    }
  }, []);
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [extStats, setExtStats] = useState(null);
  const [devices, setDevices] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [abuse, setAbuse] = useState([]);
  const [bans, setBans] = useState([]);
  const [requests, setRequests] = useState(null);
  const [topRoutes, setTopRoutes] = useState([]);
  const [topContent, setTopContent] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [deviceGeo, setDeviceGeo] = useState({});
  const [linkedDevices, setLinkedDevices] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [banModal, setBanModal] = useState(null);
  const [reqFilters, setReqFilters] = useState({ ip: '', endpoint: '' });
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const [r1, r2] = await Promise.all([
        adminFetch('/api/admin/stats'),
        adminFetch('/api/admin/stats/extended'),
      ]);
      if (r1.ok) setStats(await r1.json());
      if (r2.ok) setExtStats(await r2.json());
    } catch (e) {}
  }, []);

  const fetchDevices = useCallback(async () => {
    try {
      const r = await adminFetch('/api/admin/devices');
      if (r.ok) setDevices((await r.json()).devices || []);
    } catch (e) {}
  }, []);

  const fetchAnalytics = useCallback(async () => {
    try {
      const r = await adminFetch('/api/admin/analytics');
      if (r.ok) setAnalytics(await r.json());
    } catch (e) {}
  }, []);

  const fetchAbuse = useCallback(async () => {
    try {
      const r = await adminFetch('/api/admin/analytics/abuse');
      if (r.ok) setAbuse((await r.json()).abusers || []);
    } catch (e) {}
  }, []);

  const fetchBans = useCallback(async () => {
    try {
      const r = await adminFetch('/api/admin/bans');
      if (r.ok) setBans((await r.json()).bans || []);
    } catch (e) {}
  }, []);

  const fetchRequests = useCallback(async () => {
    try {
      const q = new URLSearchParams();
      if (reqFilters.ip) q.set('ip', reqFilters.ip);
      if (reqFilters.endpoint) q.set('endpoint', reqFilters.endpoint);
      const r = await adminFetch(`/api/admin/requests?${q}`);
      if (r.ok) setRequests(await r.json());
    } catch (e) {}
  }, [reqFilters]);

  const fetchTopRoutes = useCallback(async () => {
    try {
      const r = await adminFetch('/api/admin/routes/top');
      if (r.ok) setTopRoutes((await r.json()).routes || []);
    } catch (e) {}
  }, []);

  const fetchTopContent = useCallback(async () => {
    try {
      const r = await adminFetch('/api/admin/content/top');
      if (r.ok) setTopContent((await r.json()).content || []);
    } catch (e) {}
  }, []);

  useEffect(() => {
    fetchStats();
    const iv = setInterval(fetchStats, 30000);
    return () => clearInterval(iv);
  }, [fetchStats]);

  useEffect(() => {
    if (tab === 'devices') fetchDevices();
    if (tab === 'analytics') { fetchAnalytics(); fetchTopRoutes(); }
    if (tab === 'content') fetchTopContent();
    if (tab === 'abuse') fetchAbuse();
    if (tab === 'bans') fetchBans();
    if (tab === 'requests') fetchRequests();
    if (tab === 'overview') { fetchStats(); fetchTopRoutes(); fetchTopContent(); }
  }, [tab]);

  const openDeviceDetail = async (device) => {
    setSelectedDevice(device);
    setLinkedDevices([]);
    setDeviceGeo({});
    // Load geo data for device IPs
    try {
      const r = await adminFetch(`/api/admin/devices/${device.fingerprintId}/geo`);
      if (r.ok) setDeviceGeo((await r.json()).geoResults || {});
    } catch (e) {}
    // Load linked devices
    try {
      const r = await adminFetch(`/api/admin/devices/${device.fingerprintId}/linked`);
      if (r.ok) setLinkedDevices((await r.json()).linkedDevices || []);
    } catch (e) {}
  };

  const doBan = async (type, value, reason = '') => {
    try {
      const r = await adminFetch('/api/admin/ban', {
        method: 'POST',
        body: JSON.stringify({ type, value, reason }),
      });
      if (r.ok) {
        const data = await r.json();
        const crossCount = data.crossBans?.length || 0;
        alert(`Banned! ${crossCount > 0 ? `+ ${crossCount} cross-ban(s) created` : ''}`);
        fetchBans();
      } else {
        const d = await r.json();
        alert(d.error || 'Ban failed');
      }
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  const doUnban = async (id) => {
    try {
      await adminFetch(`/api/admin/ban/${id}`, { method: 'DELETE' });
      fetchBans();
    } catch (e) {}
  };

  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      if (tab === 'overview') { await Promise.all([fetchStats(), fetchTopRoutes(), fetchTopContent()]); }
      if (tab === 'devices') await fetchDevices();
      if (tab === 'analytics') { await Promise.all([fetchAnalytics(), fetchTopRoutes()]); }
      if (tab === 'content') await fetchTopContent();
      if (tab === 'abuse') await fetchAbuse();
      if (tab === 'bans') await fetchBans();
      if (tab === 'requests') await fetchRequests();
    } catch (e) {}
    setRefreshing(false);
  };

  const filteredDevices = devices.filter(d => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      d.fingerprintId?.toLowerCase().includes(q) ||
      d.ips?.some(ip => ip.includes(q)) ||
      d.summary?.browser?.toLowerCase().includes(q) ||
      d.summary?.os?.toLowerCase().includes(q) ||
      d.summary?.gpu?.toLowerCase().includes(q) ||
      d.geo?.country?.toLowerCase().includes(q) ||
      d.geo?.city?.toLowerCase().includes(q) ||
      d.geo?.isp?.toLowerCase().includes(q)
    );
  });

  const S = styles;

  return (
    <div style={S.shell}>
      {/* Sidebar */}
      <aside style={S.sidebar}>
        <div style={S.logo}>🔮 <span style={{ color: '#00d4aa' }}>MIYO</span> <span style={{ color: '#fff' }}>Admin</span></div>
        <nav style={S.nav}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ ...S.navBtn, ...(tab === t.id ? S.navBtnActive : {}) }}>
              <span style={{ marginRight: 10, fontSize: 16 }}>{t.icon}</span> {t.label}
            </button>
          ))}
        </nav>
        <div style={S.userBox}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {user.picture && <img src={user.picture} style={{ width: 32, height: 32, borderRadius: '50%' }} alt="" />}
            <span style={{ color: '#aaa', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</span>
          </div>
          <button onClick={onLogout} style={S.logoutBtn}>Sign Out</button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={S.main}>
        <div style={S.header}>
          <h1 style={S.headerTitle}>{TABS.find(t => t.id === tab)?.icon} {TABS.find(t => t.id === tab)?.label}</h1>
          <button onClick={refresh} disabled={refreshing} style={{ ...S.refreshBtn, opacity: refreshing ? 0.6 : 1, pointerEvents: refreshing ? 'none' : 'auto' }}>
            <span style={{ display: 'inline-block', animation: refreshing ? 'spin 1s linear infinite' : 'none' }}>🔄</span> {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {tab === 'overview' && <OverviewTab stats={stats} extStats={extStats} topRoutes={topRoutes} topContent={topContent} setTab={setTab} setBanModal={setBanModal} />}
        {tab === 'devices' && <DevicesTab devices={filteredDevices} searchQuery={searchQuery} setSearchQuery={setSearchQuery} openDeviceDetail={openDeviceDetail} doBan={doBan} />}
        {tab === 'analytics' && <AnalyticsTab analytics={analytics} topRoutes={topRoutes} />}
        {tab === 'content' && <ContentTab content={topContent} fetchTopContent={fetchTopContent} />}
        {tab === 'abuse' && <AbuseTab abuse={abuse} doBan={doBan} />}
        {tab === 'bans' && <BansTab bans={bans} doUnban={doUnban} />}
        {tab === 'requests' && <RequestsTab data={requests} filters={reqFilters} setFilters={setReqFilters} fetch={fetchRequests} doBan={doBan} />}
      </main>

      {/* Device Detail Modal */}
      {selectedDevice && <DeviceModal device={selectedDevice} geo={deviceGeo} linked={linkedDevices} onClose={() => setSelectedDevice(null)} doBan={doBan} />}

      {/* Quick Ban Modal */}
      {banModal && <BanModal initial={banModal} onBan={doBan} onClose={() => setBanModal(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: OVERVIEW
// ═══════════════════════════════════════════════════════════════
function OverviewTab({ stats, extStats, topRoutes, topContent, setTab, setBanModal }) {
  if (!stats) return <div style={styles.loading}>Loading...</div>;
  const cards = [
    { icon: '📱', label: 'TOTAL DEVICES', value: stats.totalDevices, color: '#00d4aa' },
    { icon: '🌍', label: 'UNIQUE IPS TODAY', value: stats.uniqueIPsToday, color: '#4ecdc4' },
    { icon: '📋', label: 'REQUESTS TODAY', value: stats.requestsToday, color: '#45b7d1' },
    { icon: '⚡', label: 'REQUESTS/HOUR', value: stats.requestsPerHour, color: '#f9ca24' },
    { icon: '🔴', label: 'RATE LIMITS HIT', value: stats.rateLimitsHit, color: '#ff6b6b' },
    { icon: '🚫', label: 'ACTIVE BANS', value: stats.activeBans, color: '#e74c3c' },
  ];
  if (extStats?.countryCount) cards.push({ icon: '🌐', label: 'COUNTRIES', value: extStats.countryCount, color: '#a29bfe' });

  return (
    <div>
      <div style={styles.cardGrid}>{cards.map((c, i) => (
        <div key={i} style={styles.statCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 14 }}>{c.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: c.color, letterSpacing: 1, textTransform: 'uppercase' }}>{c.label}</span>
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#fff' }}>{c.value ?? 0}</div>
        </div>
      ))}</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        {/* Server Info */}
        <div style={styles.panel}>
          <h3 style={styles.panelTitle}>Server</h3>
          <div style={styles.infoRow}><span>Uptime</span><span>{formatUptime(stats.uptime)}</span></div>
          <div style={styles.infoRow}><span>Heap Used</span><span>{formatBytes(stats.memory?.heapUsed)}</span></div>
          <div style={styles.infoRow}><span>RSS</span><span>{formatBytes(stats.memory?.rss)}</span></div>
          {extStats?.deviceTypes?.length > 0 && (
            <>
              <h4 style={{ ...styles.panelTitle, fontSize: 12, marginTop: 16 }}>Device Types</h4>
              {extStats.deviceTypes.map((dt, i) => (
                <div key={i} style={styles.infoRow}>
                  <span>{dt._id || 'Unknown'}</span><span style={{ color: '#00d4aa', fontWeight: 700 }}>{dt.count}</span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Quick Actions */}
        <div style={styles.panel}>
          <h3 style={styles.panelTitle}>Quick Actions</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <button type="button" onClick={() => setTab('devices')} onMouseOver={e => { e.currentTarget.style.opacity = '0.8'; e.currentTarget.style.transform = 'scale(1.03)'; }} onMouseOut={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)'; }} style={{ ...styles.actionBtn, background: '#00d4aa20', color: '#00d4aa' }}>📱 View Devices</button>
            <button type="button" onClick={() => setBanModal({ type: 'ip', value: '' })} onMouseOver={e => { e.currentTarget.style.opacity = '0.8'; e.currentTarget.style.transform = 'scale(1.03)'; }} onMouseOut={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)'; }} style={{ ...styles.actionBtn, background: '#ff6b6b20', color: '#ff6b6b' }}>🚫 Ban IP</button>
            <button type="button" onClick={() => setTab('abuse')} onMouseOver={e => { e.currentTarget.style.opacity = '0.8'; e.currentTarget.style.transform = 'scale(1.03)'; }} onMouseOut={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)'; }} style={{ ...styles.actionBtn, background: '#f9ca2420', color: '#f9ca24' }}>⚠️ Check Abuse</button>
            <button type="button" onClick={() => setTab('content')} onMouseOver={e => { e.currentTarget.style.opacity = '0.8'; e.currentTarget.style.transform = 'scale(1.03)'; }} onMouseOut={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)'; }} style={{ ...styles.actionBtn, background: '#a29bfe20', color: '#a29bfe' }}>🎬 Top Content</button>
          </div>

          {/* Top Routes Preview */}
          {topRoutes?.length > 0 && (
            <>
              <h4 style={{ ...styles.panelTitle, fontSize: 12, marginTop: 12 }}>Top Routes Today</h4>
              {topRoutes.slice(0, 5).map((r, i) => (
                <div key={i} style={{ ...styles.infoRow, fontSize: 12 }}>
                  <span style={{ color: '#ccc', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r._id}</span>
                  <span style={{ color: '#00d4aa', fontWeight: 700 }}>{r.count}x</span>
                </div>
              ))}
            </>
          )}

          {/* Top Content Preview */}
          {topContent?.length > 0 && (
            <>
              <h4 style={{ ...styles.panelTitle, fontSize: 12, marginTop: 12 }}>Trending Content (7d)</h4>
              {topContent.slice(0, 5).map((c, i) => (
                <div key={i} style={{ ...styles.infoRow, fontSize: 12 }}>
                  <span style={{ color: '#ccc' }}>
                    <span style={{ ...styles.badge, background: c._id?.contentType === 'movie' ? '#e74c3c40' : c._id?.contentType === 'tv' ? '#3498db40' : '#2ecc7140', color: c._id?.contentType === 'movie' ? '#ff6b6b' : c._id?.contentType === 'tv' ? '#5dade2' : '#00d4aa', marginRight: 6 }}>
                      {c._id?.contentType?.toUpperCase()}
                    </span>
                    ID: {c._id?.contentId}
                  </span>
                  <span style={{ color: '#f9ca24', fontWeight: 700 }}>{c.count} views</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: DEVICES
// ═══════════════════════════════════════════════════════════════
function DevicesTab({ devices, searchQuery, setSearchQuery, openDeviceDetail, doBan }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by IP, browser, OS, GPU, country, ISP..." style={styles.input} />
      </div>
      <div style={styles.table}>
        <div style={styles.tableHeader}>
          <span style={{ flex: 2 }}>FINGERPRINT ID</span>
          <span style={{ flex: 1 }}>IP</span>
          <span style={{ flex: 1 }}>BROWSER</span>
          <span style={{ flex: 1 }}>OS</span>
          <span style={{ flex: 1 }}>LOCATION</span>
          <span style={{ flex: 1 }}>ISP</span>
          <span style={{ flex: 0.5 }}>TYPE</span>
          <span style={{ flex: 0.7 }}>SCREEN</span>
          <span style={{ flex: 0.5 }}>VISITS</span>
          <span style={{ flex: 0.7 }}>LAST SEEN</span>
          <span style={{ flex: 0.5 }}>ACTIONS</span>
        </div>
        {devices.map(d => (
          <div key={d.fingerprintId} style={styles.tableRow} onClick={() => openDeviceDetail(d)}>
            <span style={{ flex: 2, color: '#00d4aa', fontFamily: 'monospace', fontSize: 11, cursor: 'pointer' }}>{truncate(d.fingerprintId, 14)}</span>
            <span style={{ flex: 1, fontFamily: 'monospace', fontSize: 11 }}>{d.ips?.[0] || '—'}</span>
            <span style={{ flex: 1, fontSize: 12 }}>{d.summary?.browser || '—'}</span>
            <span style={{ flex: 1, fontSize: 12 }}>{truncate(d.summary?.os, 14)}</span>
            <span style={{ flex: 1, fontSize: 12 }}>
              {d.geo?.country ? `${d.geo.countryCode || ''} ${d.geo.city || ''}`.trim() : '—'}
            </span>
            <span style={{ flex: 1, fontSize: 11, color: '#888' }}>{truncate(d.geo?.isp, 16) || '—'}</span>
            <span style={{ flex: 0.5 }}>
              <span style={{ ...styles.badge, background: d.summary?.deviceType === 'Mobile' ? '#e74c3c30' : d.summary?.deviceType === 'Tablet' ? '#f39c1230' : '#00d4aa20', color: d.summary?.deviceType === 'Mobile' ? '#ff6b6b' : d.summary?.deviceType === 'Tablet' ? '#f39c12' : '#00d4aa' }}>
                {d.summary?.deviceType || '?'}
              </span>
            </span>
            <span style={{ flex: 0.7, fontSize: 12 }}>{d.summary?.screen || '—'}</span>
            <span style={{ flex: 0.5, fontSize: 12 }}>{d.visitCount || 1}</span>
            <span style={{ flex: 0.7, fontSize: 11, color: '#888' }}>{timeAgo(d.lastSeen)}</span>
            <span style={{ flex: 0.5 }}>
              <button onClick={e => { e.stopPropagation(); doBan('fingerprint', d.fingerprintId, 'Admin ban'); }} style={styles.banBtn}>Ban</button>
            </span>
          </div>
        ))}
        {devices.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#666' }}>No devices found</div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: ANALYTICS
// ═══════════════════════════════════════════════════════════════
function AnalyticsTab({ analytics, topRoutes }) {
  if (!analytics) return <div style={styles.loading}>Loading...</div>;
  const maxBar = Math.max(...(analytics.requestsPerHour || []).map(h => h.count), 1);

  return (
    <div>
      {/* Hourly Chart */}
      <div style={styles.panel}>
        <h3 style={styles.panelTitle}>Requests (Last 24h)</h3>
        <div style={{ display: 'flex', alignItems: 'end', gap: 2, height: 80 }}>
          {(analytics.requestsPerHour || []).map((h, i) => (
            <div key={i} style={{ flex: 1, background: `linear-gradient(to top, #00d4aa, #4ecdc4)`, borderRadius: '4px 4px 0 0', height: `${Math.max((h.count / maxBar) * 100, 2)}%`, transition: 'height 0.3s' }} title={`${h._id}:00 — ${h.count} requests`} />
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        {/* Top Endpoints */}
        <div style={styles.panel}>
          <h3 style={styles.panelTitle}>Top Endpoints</h3>
          <div style={styles.table}>
            <div style={styles.tableHeader}>
              <span style={{ flex: 3 }}>ENDPOINT</span>
              <span style={{ flex: 0.7 }}>REQUESTS</span>
              <span style={{ flex: 0.7 }}>UNIQUE IPs</span>
              <span style={{ flex: 0.7 }}>AVG RESPONSE</span>
            </div>
            {topRoutes.map((r, i) => (
              <div key={i} style={styles.tableRow}>
                <span style={{ flex: 3, fontFamily: 'monospace', fontSize: 11, color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r._id}</span>
                <span style={{ flex: 0.7, color: '#00d4aa', fontWeight: 700 }}>{r.count}</span>
                <span style={{ flex: 0.7, color: '#a29bfe' }}>{r.uniqueIPCount || '—'}</span>
                <span style={{ flex: 0.7, color: '#f9ca24' }}>{Math.round(r.avgResponseTime || 0)}ms</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top IPs */}
        <div style={styles.panel}>
          <h3 style={styles.panelTitle}>Top IPs</h3>
          <div style={styles.table}>
            <div style={styles.tableHeader}>
              <span style={{ flex: 2 }}>IP ADDRESS</span>
              <span style={{ flex: 1 }}>REQUESTS</span>
              <span style={{ flex: 1 }}>RATE LIMITED</span>
            </div>
            {(analytics.topIPs || []).map((ip, i) => (
              <div key={i} style={styles.tableRow}>
                <span style={{ flex: 2, fontFamily: 'monospace', fontSize: 12 }}>{ip._id}</span>
                <span style={{ flex: 1 }}>{ip.count}</span>
                <span style={{ flex: 1 }}>
                  {ip.rateLimited > 0 ? <span style={{ ...styles.badge, background: '#ff6b6b30', color: '#ff6b6b' }}>⚠ {ip.rateLimited}</span> : <span style={{ color: '#666' }}>0</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: CONTENT (NEW)
// ═══════════════════════════════════════════════════════════════
function ContentTab({ content, fetchTopContent }) {
  const [typeFilter, setTypeFilter] = useState('');
  const filtered = typeFilter ? content.filter(c => c._id?.contentType === typeFilter) : content;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['', 'movie', 'tv', 'anime'].map(t => (
          <button key={t} onClick={() => setTypeFilter(t)} style={{ ...styles.filterBtn, ...(typeFilter === t ? styles.filterBtnActive : {}) }}>
            {t ? t.toUpperCase() : 'ALL'}
          </button>
        ))}
      </div>

      <div style={styles.panel}>
        <h3 style={styles.panelTitle}>Most Accessed Content (Last 7 Days)</h3>
        <div style={styles.table}>
          <div style={styles.tableHeader}>
            <span style={{ flex: 0.5 }}>#</span>
            <span style={{ flex: 0.7 }}>TYPE</span>
            <span style={{ flex: 1.5 }}>CONTENT ID</span>
            <span style={{ flex: 2 }}>TITLE</span>
            <span style={{ flex: 0.7 }}>VIEWS</span>
            <span style={{ flex: 0.7 }}>VIEWERS</span>
            <span style={{ flex: 1 }}>LAST ACCESSED</span>
          </div>
          {filtered.map((c, i) => (
            <div key={i} style={styles.tableRow}>
              <span style={{ flex: 0.5, color: i < 3 ? '#f9ca24' : '#666', fontWeight: i < 3 ? 900 : 400 }}>#{i + 1}</span>
              <span style={{ flex: 0.7 }}>
                <span style={{ ...styles.badge, background: c._id?.contentType === 'movie' ? '#e74c3c40' : c._id?.contentType === 'tv' ? '#3498db40' : '#2ecc7140', color: c._id?.contentType === 'movie' ? '#ff6b6b' : c._id?.contentType === 'tv' ? '#5dade2' : '#00d4aa' }}>
                  {c._id?.contentType?.toUpperCase()}
                </span>
              </span>
              <span style={{ flex: 1.5, fontFamily: 'monospace', fontSize: 12, color: '#aaa' }}>{c._id?.contentId}</span>
              <span style={{ flex: 2, fontSize: 12, color: '#fff' }}>{c.title || '—'}</span>
              <span style={{ flex: 0.7, color: '#00d4aa', fontWeight: 700 }}>{c.count}</span>
              <span style={{ flex: 0.7, color: '#a29bfe' }}>{c.viewerCount}</span>
              <span style={{ flex: 1, fontSize: 11, color: '#888' }}>{timeAgo(c.lastAccessed)}</span>
            </div>
          ))}
          {filtered.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#666' }}>No content data yet — data populates as users browse movies/shows</div>}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: ABUSE
// ═══════════════════════════════════════════════════════════════
function AbuseTab({ abuse, doBan }) {
  return (
    <div style={styles.panel}>
      <h3 style={styles.panelTitle}>Suspected Abuse (High Request Volume)</h3>
      <div style={styles.table}>
        <div style={styles.tableHeader}>
          <span style={{ flex: 2 }}>IP ADDRESS</span>
          <span style={{ flex: 1 }}>REQUESTS (24H)</span>
          <span style={{ flex: 1 }}>RATE LIMITED</span>
          <span style={{ flex: 1 }}>UNIQUE ENDPOINTS</span>
          <span style={{ flex: 0.5 }}>ACTION</span>
        </div>
        {abuse.map((a, i) => (
          <div key={i} style={styles.tableRow}>
            <span style={{ flex: 2, fontFamily: 'monospace', fontSize: 12 }}>{a._id}</span>
            <span style={{ flex: 1, color: a.count > 500 ? '#ff6b6b' : a.count > 100 ? '#f9ca24' : '#ccc', fontWeight: 700 }}>{a.count}</span>
            <span style={{ flex: 1, color: a.rateLimited > 0 ? '#ff6b6b' : '#666' }}>{a.rateLimited}</span>
            <span style={{ flex: 1 }}>{a.endpoints}</span>
            <span style={{ flex: 0.5 }}>
              <button onClick={() => doBan('ip', a._id, `Abuse: ${a.count} requests`)} style={styles.banBtn}>Ban</button>
            </span>
          </div>
        ))}
        {abuse.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#666' }}>No suspicious activity detected 🎉</div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: BANS
// ═══════════════════════════════════════════════════════════════
function BansTab({ bans, doUnban }) {
  return (
    <div style={styles.panel}>
      <h3 style={styles.panelTitle}>Active Bans ({bans.filter(b => b.active).length})</h3>
      <div style={styles.table}>
        <div style={styles.tableHeader}>
          <span style={{ flex: 0.5 }}>TYPE</span>
          <span style={{ flex: 2 }}>VALUE</span>
          <span style={{ flex: 2 }}>REASON</span>
          <span style={{ flex: 1 }}>BANNED BY</span>
          <span style={{ flex: 1 }}>BANNED AT</span>
          <span style={{ flex: 0.7 }}>EXPIRES</span>
          <span style={{ flex: 0.5 }}>STATUS</span>
          <span style={{ flex: 0.5 }}>ACTION</span>
        </div>
        {bans.map(b => (
          <div key={b._id} style={styles.tableRow}>
            <span style={{ flex: 0.5 }}>
              <span style={{ ...styles.badge, background: b.type === 'ip' ? '#e74c3c30' : '#a29bfe30', color: b.type === 'ip' ? '#ff6b6b' : '#a29bfe' }}>{b.type.toUpperCase()}</span>
            </span>
            <span style={{ flex: 2, fontFamily: 'monospace', fontSize: 11, color: '#ccc' }}>{b.type === 'fingerprint' ? truncate(b.value, 20) : b.value}</span>
            <span style={{ flex: 2, fontSize: 12, color: '#aaa' }}>{b.reason || '—'}</span>
            <span style={{ flex: 1, fontSize: 11, color: '#888' }}>{b.bannedBy || 'admin'}</span>
            <span style={{ flex: 1, fontSize: 11, color: '#888' }}>{timeAgo(b.bannedAt)}</span>
            <span style={{ flex: 0.7, fontSize: 11, color: b.expiresAt ? '#f9ca24' : '#ff6b6b' }}>{b.expiresAt ? timeAgo(b.expiresAt) : 'Never'}</span>
            <span style={{ flex: 0.5 }}>
              <span style={{ ...styles.badge, background: b.active ? '#ff6b6b20' : '#66666620', color: b.active ? '#ff6b6b' : '#666' }}>{b.active ? 'ACTIVE' : 'LIFTED'}</span>
            </span>
            <span style={{ flex: 0.5 }}>
              {b.active && <button onClick={() => doUnban(b._id)} style={{ ...styles.banBtn, background: '#00d4aa20', color: '#00d4aa' }}>Unban</button>}
            </span>
          </div>
        ))}
        {bans.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#666' }}>No bans</div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: REQUESTS
// ═══════════════════════════════════════════════════════════════
function RequestsTab({ data, filters, setFilters, fetch: doFetch, doBan }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <input value={filters.ip} onChange={e => setFilters(f => ({ ...f, ip: e.target.value }))} placeholder="Filter by IP..." style={{ ...styles.input, flex: 1 }} />
        <input value={filters.endpoint} onChange={e => setFilters(f => ({ ...f, endpoint: e.target.value }))} placeholder="Filter by endpoint..." style={{ ...styles.input, flex: 1 }} />
        <button onClick={doFetch} style={styles.refreshBtn}>Filter</button>
      </div>
      <div style={styles.table}>
        <div style={styles.tableHeader}>
          <span style={{ flex: 0.8 }}>TIME</span>
          <span style={{ flex: 0.5 }}>METHOD</span>
          <span style={{ flex: 3 }}>ENDPOINT</span>
          <span style={{ flex: 1.2 }}>IP</span>
          <span style={{ flex: 0.5 }}>STATUS</span>
          <span style={{ flex: 0.5 }}>TIME</span>
          <span style={{ flex: 1.2 }}>FP</span>
          <span style={{ flex: 0.5 }}>RATE LIM</span>
        </div>
        {(data?.requests || []).map((r, i) => (
          <div key={i} style={styles.tableRow}>
            <span style={{ flex: 0.8, fontSize: 11, color: '#888' }}>{new Date(r.timestamp).toLocaleTimeString()}</span>
            <span style={{ flex: 0.5 }}><span style={{ ...styles.badge, background: r.method === 'GET' ? '#00d4aa20' : '#f9ca2420', color: r.method === 'GET' ? '#00d4aa' : '#f9ca24' }}>{r.method}</span></span>
            <span style={{ flex: 3, fontFamily: 'monospace', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#ccc' }}>{r.endpoint}</span>
            <span style={{ flex: 1.2, fontFamily: 'monospace', fontSize: 11 }}>{r.ip}</span>
            <span style={{ flex: 0.5, color: r.statusCode < 300 ? '#00d4aa' : r.statusCode < 400 ? '#f9ca24' : '#ff6b6b', fontWeight: 700 }}>{r.statusCode}</span>
            <span style={{ flex: 0.5, fontSize: 11, color: '#888' }}>{r.responseTime ? `${r.responseTime}ms` : '—'}</span>
            <span style={{ flex: 1.2, fontFamily: 'monospace', fontSize: 10, color: '#555' }}>{r.fingerprintId ? truncate(r.fingerprintId, 12) : '—'}</span>
            <span style={{ flex: 0.5 }}>{r.rateLimited ? <span style={{ color: '#ff6b6b' }}>⚠️</span> : <span style={{ color: '#444' }}>—</span>}</span>
          </div>
        ))}
      </div>
      {data && <div style={{ color: '#666', fontSize: 12, marginTop: 8, textAlign: 'right' }}>Page {data.page}/{data.pages} — {data.total} total</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DEVICE DETAIL MODAL
// ═══════════════════════════════════════════════════════════════
function DeviceModal({ device, geo, linked, onClose, doBan }) {
  const c = device.components || {};
  const s = device.summary || {};

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 900, margin: 0 }}>🔍 Device Details</h2>
            <p style={{ color: '#555', fontFamily: 'monospace', fontSize: 11, margin: '4px 0 0' }}>{device.fingerprintId}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => doBan('fingerprint', device.fingerprintId, 'Admin ban')} style={{ ...styles.banBtn, fontSize: 14, padding: '8px 20px' }}>Ban Device</button>
            <button onClick={onClose} style={{ ...styles.banBtn, background: '#33333350', color: '#888' }}>✕</button>
          </div>
        </div>

        <div style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: 8 }}>
          {/* Overview */}
          <Section title="📋 OVERVIEW">
            <InfoRow label="First Seen" value={new Date(device.firstSeen).toLocaleString()} />
            <InfoRow label="Last Seen" value={timeAgo(device.lastSeen)} />
            <InfoRow label="Visit Count" value={device.visitCount} />
            <InfoRow label="Device Type" value={s.deviceType || '—'} valueColor={s.deviceType === 'Mobile' ? '#ff6b6b' : '#00d4aa'} />
            <InfoRow label="Known IPs" value={(device.ips || []).join(', ')} />
          </Section>

          {/* Network & ISP */}
          <Section title="🌐 NETWORK & ISP">
            {Object.entries(geo).length > 0 ? Object.entries(geo).map(([ip, g]) => (
              <div key={ip} style={{ marginBottom: 12, padding: 12, background: '#0a0a0a', borderRadius: 12, border: '1px solid #1a1a1a' }}>
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#00d4aa', marginBottom: 8 }}>{ip}</div>
                {g ? (
                  <>
                    <InfoRow label="Country" value={`${g.country} (${g.countryCode})`} />
                    <InfoRow label="Region" value={g.regionName || g.region} />
                    <InfoRow label="City" value={g.city} />
                    <InfoRow label="ISP" value={g.isp} valueColor="#f9ca24" />
                    <InfoRow label="Organization" value={g.org} />
                    <InfoRow label="AS Number" value={g.as} />
                    <InfoRow label="Timezone" value={g.timezone} />
                    <InfoRow label="Coordinates" value={g.lat && g.lon ? `${g.lat}, ${g.lon}` : '—'} />
                    <InfoRow label="Mobile" value={g.mobile ? '✅ Yes' : '❌ No'} />
                    <InfoRow label="Proxy/VPN" value={g.proxy ? '⚠️ Yes' : '❌ No'} valueColor={g.proxy ? '#ff6b6b' : '#00d4aa'} />
                    <InfoRow label="Hosting/DC" value={g.hosting ? '⚠️ Yes' : '❌ No'} valueColor={g.hosting ? '#f9ca24' : '#00d4aa'} />
                    <button onClick={() => doBan('ip', ip, `Admin ban from device detail`)} style={{ ...styles.banBtn, marginTop: 4, fontSize: 10 }}>Ban this IP</button>
                  </>
                ) : <div style={{ color: '#666', fontSize: 12 }}>Geo lookup unavailable</div>}
              </div>
            )) : <div style={{ color: '#666', fontSize: 12 }}>Loading geo data...</div>}
          </Section>

          {/* Graphics */}
          <Section title="🎨 LAYER 1: GRAPHICS">
            <InfoRow label="GPU Vendor" value={c.webgl?.vendor} />
            <InfoRow label="GPU Renderer" value={c.webgl?.renderer} />
            <InfoRow label="Max Texture Size" value={c.webgl?.maxTextureSize} />
            <InfoRow label="WebGL Version" value={c.webgl?.version} />
            <InfoRow label="Extensions" value={c.webgl?.extensions ? `${c.webgl.extensions.length} extensions` : '—'} />
            <InfoRow label="Render Hash" value={c.webgl?.renderHash || '—'} />
            <InfoRow label="Canvas Hash" value={truncate(c.canvas?.hash, 40)} />
          </Section>

          {/* Audio */}
          <Section title="🔊 LAYER 2: AUDIO">
            <InfoRow label="Audio Hash" value={c.audio?.hash} />
            <InfoRow label="Sample Rate" value={c.audio?.sampleRate} />
            <InfoRow label="Channel Count" value={c.audio?.channelCount} />
            <InfoRow label="Max Channels" value={c.audio?.maxChannels} />
          </Section>

          {/* Hardware */}
          <Section title="⚙️ LAYER 3: HARDWARE">
            <InfoRow label="CPU Cores" value={c.hardware?.cpuCores} />
            <InfoRow label="Device Memory" value={c.hardware?.deviceMemory ? `${c.hardware.deviceMemory} GB` : '—'} />
            <InfoRow label="Screen" value={c.hardware?.screen ? `${c.hardware.screen.width}x${c.hardware.screen.height}` : '—'} />
            <InfoRow label="Color Depth" value={c.hardware?.screen?.colorDepth} />
            <InfoRow label="Pixel Ratio" value={c.hardware?.screen?.pixelRatio} />
            <InfoRow label="Color Gamut" value={c.hardware?.colorGamut} />
            <InfoRow label="HDR Support" value={c.hardware?.hdr?.toString()} />
            <InfoRow label="Touch Points" value={c.hardware?.touchPoints} />
          </Section>

          {/* Fonts & Voices */}
          <Section title="🔤 LAYER 4: FONTS & VOICES">
            <InfoRow label="Detected Fonts" value={`${c.fonts?.length || 0} fonts`} />
            <InfoRow label="TTS Voices" value={`${c.voices?.length || 0} voices`} />
            {c.fonts?.length > 0 && <div style={{ fontSize: 10, color: '#555', marginTop: 4, wordBreak: 'break-all' }}>{c.fonts.slice(0, 20).join(', ')}{c.fonts.length > 20 ? ` +${c.fonts.length - 20} more` : ''}</div>}
          </Section>

          {/* Browser */}
          <Section title="🌐 LAYER 5: BROWSER">
            <InfoRow label="User Agent" value={truncate(c.browser?.userAgent, 60)} />
            <InfoRow label="Platform" value={c.browser?.platform} />
            <InfoRow label="PDF Viewer" value={c.browser?.pdfViewer?.toString()} />
            <InfoRow label="Cookies Enabled" value={c.browser?.cookieEnabled?.toString()} />
            <InfoRow label="Do Not Track" value={c.browser?.doNotTrack} />
            <InfoRow label="JS Engine" value={c.browser?.jsEngine} />
          </Section>

          {/* Locale */}
          <Section title="🕐 LAYER 6: LOCALE">
            <InfoRow label="Timezone" value={c.locale?.timezone} />
            <InfoRow label="UTC Offset" value={c.locale?.utcOffset} />
            <InfoRow label="Language" value={c.locale?.language} />
            <InfoRow label="Languages" value={c.locale?.languages?.join(', ')} />
          </Section>

          {/* Accessibility */}
          <Section title="♿ LAYER 7: ACCESSIBILITY">
            <InfoRow label="Color Scheme" value={c.accessibility?.colorScheme} />
            <InfoRow label="Reduced Motion" value={c.accessibility?.reducedMotion?.toString()} />
            <InfoRow label="High Contrast" value={c.accessibility?.highContrast?.toString()} />
            <InfoRow label="Forced Colors" value={c.accessibility?.forcedColors?.toString()} />
          </Section>

          {/* Network */}
          <Section title="📡 LAYER 8: NETWORK">
            <InfoRow label="Connection Type" value={c.network?.connectionType} />
            <InfoRow label="Effective Type" value={c.network?.effectiveType} />
            <InfoRow label="Downlink" value={c.network?.downlink ? `${c.network.downlink} Mbps` : '—'} />
            <InfoRow label="RTT" value={c.network?.rtt ? `${c.network.rtt}ms` : '—'} />
            <InfoRow label="Data Saver" value={c.network?.saveData?.toString()} />
          </Section>

          {/* Linked Devices */}
          {linked.length > 0 && (
            <Section title={`🔗 LINKED DEVICES (${linked.length})`}>
              {linked.map((d, i) => (
                <div key={i} style={{ padding: 12, background: '#0a0a0a', borderRadius: 12, border: '1px solid #1a1a1a', marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#00d4aa' }}>{truncate(d.fingerprintId, 20)}</span>
                    <span style={{ ...styles.badge, background: d.confidence >= 80 ? '#ff6b6b30' : d.confidence >= 50 ? '#f9ca2430' : '#66666630', color: d.confidence >= 80 ? '#ff6b6b' : d.confidence >= 50 ? '#f9ca24' : '#888' }}>
                      {d.confidence}% match
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#888' }}>
                    <span style={{ color: '#a29bfe', marginRight: 12 }}>{d.linkType?.replace('_', ' ')}</span>
                    {d.reason}
                  </div>
                  <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>
                    {d.summary?.browser} · {d.summary?.os} · {d.summary?.screen} · Last: {timeAgo(d.lastSeen)}
                  </div>
                  {d.sharedIPs?.length > 0 && <div style={{ fontSize: 10, color: '#f9ca24', marginTop: 2 }}>Shared IPs: {d.sharedIPs.join(', ')}</div>}
                  <button onClick={() => doBan('fingerprint', d.fingerprintId, `Linked to ${truncate(device.fingerprintId, 12)}`)} style={{ ...styles.banBtn, marginTop: 6, fontSize: 10 }}>Ban linked device</button>
                </div>
              ))}
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ color: '#00d4aa', fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 10px', borderBottom: '1px solid #1a1a1a', paddingBottom: 6 }}>{title}</h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value, valueColor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #0d0d0d' }}>
      <span style={{ color: '#888', fontSize: 12 }}>{label}</span>
      <span style={{ color: valueColor || '#ccc', fontSize: 12, fontFamily: 'monospace', textAlign: 'right', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value ?? '—'}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// BAN MODAL
// ═══════════════════════════════════════════════════════════════
function BanModal({ initial, onBan, onClose }) {
  const [type, setType] = useState(initial.type || 'ip');
  const [value, setValue] = useState(initial.value || '');
  const [reason, setReason] = useState('');

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={{ ...styles.modal, maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 900, margin: '0 0 20px' }}>🚫 Create Ban</h2>
        <div style={{ marginBottom: 12 }}>
          <label style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>Type</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setType('ip')} style={{ ...styles.filterBtn, ...(type === 'ip' ? styles.filterBtnActive : {}) }}>IP</button>
            <button onClick={() => setType('fingerprint')} style={{ ...styles.filterBtn, ...(type === 'fingerprint' ? styles.filterBtnActive : {}) }}>Device</button>
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>Value</label>
          <input value={value} onChange={e => setValue(e.target.value)} placeholder={type === 'ip' ? 'e.g. 103.55.96.200' : 'fingerprint ID'} style={styles.input} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>Reason (optional)</label>
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Abuse, scraping, etc." style={styles.input} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { onBan(type, value, reason); onClose(); }} disabled={!value} style={{ ...styles.banBtn, padding: '10px 24px', fontSize: 14, opacity: value ? 1 : 0.4 }}>Confirm Ban</button>
          <button onClick={onClose} style={{ ...styles.banBtn, background: '#33333340', color: '#888', padding: '10px 24px', fontSize: 14 }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ADMIN ENTRY POINT
// ═══════════════════════════════════════════════════════════════
export function Admin() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function verify() {
      const token = getToken();
      if (!token) { setLoading(false); return; }
      try {
        const r = await fetch('/api/admin/auth/verify', { headers: { Authorization: `Bearer ${token}` } });
        if (r.ok) { setUser(await r.json()); } else { clearToken(); }
      } catch (e) { clearToken(); }
      setLoading(false);
    }
    verify();
  }, []);

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}><div style={{ color: '#888' }}>Loading...</div></div>;

  if (!user) return <LoginScreen onLogin={data => { setUser(data); }} />;

  return <Dashboard user={user} onLogout={() => { clearToken(); setUser(null); }} />;
}

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════
const styles = {
  shell: { display: 'flex', minHeight: '100vh', background: '#0a0a0a', fontFamily: 'Inter, -apple-system, sans-serif', color: '#ccc' },
  sidebar: { width: 200, background: '#111', borderRight: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh' },
  logo: { padding: '24px 20px 20px', fontSize: 18, fontWeight: 900, borderBottom: '1px solid #1a1a1a' },
  nav: { flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 },
  navBtn: { display: 'flex', alignItems: 'center', padding: '10px 14px', border: 'none', background: 'transparent', color: '#888', fontSize: 13, fontWeight: 500, borderRadius: 10, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' },
  navBtnActive: { background: '#00d4aa15', color: '#00d4aa', fontWeight: 700 },
  userBox: { padding: 16, borderTop: '1px solid #1a1a1a' },
  logoutBtn: { display: 'block', width: '100%', marginTop: 10, padding: '8px', border: '1px solid #333', borderRadius: 8, background: 'transparent', color: '#888', fontSize: 12, cursor: 'pointer' },
  main: { flex: 1, padding: '24px 32px', overflowY: 'auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  headerTitle: { fontSize: 22, fontWeight: 900, color: '#fff', margin: 0 },
  refreshBtn: { padding: '8px 16px', border: '1px solid #00d4aa30', borderRadius: 10, background: '#00d4aa10', color: '#00d4aa', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 },
  statCard: { background: '#111', border: '1px solid #1a1a1a', borderRadius: 16, padding: '16px 20px' },
  panel: { background: '#111', border: '1px solid #1a1a1a', borderRadius: 16, padding: 20 },
  panelTitle: { fontSize: 14, fontWeight: 800, color: '#fff', margin: '0 0 14px' },
  infoRow: { display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, color: '#aaa', borderBottom: '1px solid #0d0d0d' },
  table: { width: '100%' },
  tableHeader: { display: 'flex', padding: '10px 12px', borderBottom: '1px solid #222', fontSize: 10, fontWeight: 700, color: '#666', letterSpacing: 0.8, textTransform: 'uppercase' },
  tableRow: { display: 'flex', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #111', fontSize: 13, color: '#aaa', cursor: 'pointer', transition: 'background 0.1s' },
  badge: { display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, letterSpacing: 0.5 },
  banBtn: { padding: '4px 12px', border: 'none', borderRadius: 8, background: '#ff6b6b20', color: '#ff6b6b', fontSize: 11, fontWeight: 700, cursor: 'pointer' },
  actionBtn: { padding: '8px 16px', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', position: 'relative', zIndex: 1, transition: 'opacity 0.15s, transform 0.15s' },
  filterBtn: { padding: '6px 14px', border: '1px solid #333', borderRadius: 8, background: 'transparent', color: '#888', fontSize: 12, cursor: 'pointer' },
  filterBtnActive: { background: '#00d4aa15', borderColor: '#00d4aa40', color: '#00d4aa' },
  input: { flex: 1, padding: '10px 14px', border: '1px solid #222', borderRadius: 10, background: '#0a0a0a', color: '#ccc', fontSize: 13, outline: 'none' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#111', border: '1px solid #222', borderRadius: 20, padding: 32, maxWidth: 700, width: '90vw', maxHeight: '90vh', overflow: 'hidden' },
  loading: { display: 'flex', justifyContent: 'center', padding: 40, color: '#666' },
};
