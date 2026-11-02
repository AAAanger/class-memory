import { useCallback, useEffect, useState } from 'react';
import Import from './views/Import.jsx';
import Library from './views/Library.jsx';
import Timetable from './views/Timetable.jsx';
import Settings from './views/Settings.jsx';
import { CONFIG } from './config.js';
import { getSetting, setSetting, requestPersist } from './lib/db.js';

/* ---------------- 底部导航的四个图标 ---------------- */

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function IconImport() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.5v11" {...stroke} />
      <path d="M7 10.5l5 5 5-5" {...stroke} />
      <path d="M4.5 19.5h15" {...stroke} />
    </svg>
  );
}

function IconLibrary() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" {...stroke} />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" {...stroke} />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" {...stroke} />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" {...stroke} />
    </svg>
  );
}

function IconTimetable() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="2.2" {...stroke} />
      <path d="M3.5 9.5h17" {...stroke} />
      <path d="M8 3.5v3M16 3.5v3" {...stroke} />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" {...stroke} />
      <circle cx="16" cy="7" r="2.2" {...stroke} />
      <circle cx="8" cy="17" r="2.2" {...stroke} />
    </svg>
  );
}

const TABS = [
  { key: 'import', label: '导入', icon: IconImport },
  { key: 'library', label: '相册', icon: IconLibrary },
  { key: 'timetable', label: '课表', icon: IconTimetable },
  { key: 'settings', label: '设置', icon: IconSettings },
];

export default function App() {
  const [tab, setTab] = useState('library');
  const [version, setVersion] = useState(0);
  const [config, setConfig] = useState(null);

  // 启动时把用户改过的设置读出来，和默认值合并
  useEffect(() => {
    let alive = true;
    (async () => {
      const saved = await getSetting('config', {});
      if (!alive) return;
      setConfig({ ...CONFIG, ...saved });
      // 申请持久化存储，让浏览器别随手把照片清掉
      requestPersist();
    })();
    return () => {
      alive = false;
    };
  }, []);

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const updateConfig = useCallback(
    async (patch) => {
      const next = { ...config, ...patch };
      setConfig(next);
      await setSetting('config', next);
    },
    [config],
  );

  if (!config) {
    return (
      <div className="boot">
        <div className="boot-dot" />
        <p>正在打开课堂记忆库…</p>
      </div>
    );
  }

  return (
    <div className="app">
      <main className="main">
        {tab === 'import' && (
          <Import config={config} onChanged={bump} onGoTimetable={() => setTab('timetable')} />
        )}
        {tab === 'library' && (
          <Library
            version={version}
            onChanged={bump}
            onGoTimetable={() => setTab('timetable')}
            onGoImport={() => setTab('import')}
          />
        )}
        {tab === 'timetable' && (
          <Timetable config={config} updateConfig={updateConfig} version={version} onChanged={bump} />
        )}
        {tab === 'settings' && <Settings config={config} updateConfig={updateConfig} onChanged={bump} />}
      </main>

      <nav className="nav">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            className={`nav-btn${tab === key ? ' is-active' : ''}`}
            onClick={() => setTab(key)}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
