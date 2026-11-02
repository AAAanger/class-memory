import { useRef, useState } from 'react';
import { importFiles } from '../lib/importer.js';
import { dayKey } from '../lib/timetable.js';

export default function Import({ config, onChanged, onGoTimetable }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const pickRef = useRef(null);
  const shotRef = useRef(null);

  async function handleFiles(fileList) {
    const files = [...(fileList || [])].filter(
      (f) => f.type.startsWith('image/') || /\.(jpe?g|png|heic|heif|webp)$/i.test(f.name),
    );
    if (!files.length) {
      setError('没选到图片');
      return;
    }

    setBusy(true);
    setError('');
    setSummary(null);
    try {
      const result = await importFiles(files, config, { onProgress: setProgress });
      setSummary(result);
      onChanged?.();
    } catch (e) {
      setError(e?.message || '导入出错了');
    } finally {
      setBusy(false);
      setProgress(null);
      if (pickRef.current) pickRef.current.value = '';
      if (shotRef.current) shotRef.current.value = '';
    }
  }

  const percent = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="page">
      <header className="page-head">
        <h1>导入照片</h1>
        <p className="page-sub">用系统相机拍，下课回来一次选完，按拍摄时间自动分课</p>
      </header>

      {!config.termStart && (
        <div className="banner banner-warn">
          还没填开学日期，周次算不出来，照片只能按星期几分。
          <button type="button" className="link" onClick={onGoTimetable}>
            去填一下
          </button>
        </div>
      )}

      <section className="card">
        <button
          type="button"
          className="dropzone"
          disabled={busy}
          onClick={() => pickRef.current?.click()}
        >
          <span className="dropzone-icon">＋</span>
          <strong>{busy ? '正在处理…' : '从相册选照片'}</strong>
          <span className="dropzone-sub">可以一次选几十上百张，会先压缩再存</span>
        </button>

        <input
          ref={pickRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
        <input
          ref={shotRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />

        <button
          type="button"
          className="btn btn-ghost btn-block"
          disabled={busy}
          onClick={() => shotRef.current?.click()}
        >
          直接用相机拍
        </button>
      </section>

      {busy && (
        <section className="card">
          <div className="progress">
            <div className="progress-bar" style={{ width: `${percent}%` }} />
          </div>
          <p className="hint">
            {progress ? `${progress.done} / ${progress.total}` : '准备中…'} · 正在压缩和识别时间
          </p>
        </section>
      )}

      {error && <div className="banner banner-error">{error}</div>}

      {summary && (
        <section className="card">
          <h2 className="card-title">这次导入</h2>
          <div className="stat-row">
            <div className="stat">
              <span className="stat-num">{summary.added}</span>
              <span className="stat-label">新增</span>
            </div>
            <div className="stat">
              <span className="stat-num">{summary.duplicated}</span>
              <span className="stat-label">重复跳过</span>
            </div>
            <div className="stat">
              <span className="stat-num">{summary.unassigned}</span>
              <span className="stat-label">待归类</span>
            </div>
            <div className="stat">
              <span className="stat-num">{summary.failed}</span>
              <span className="stat-label">失败</span>
            </div>
          </div>

          {summary.sessions.size > 0 && (
            <ul className="plain-list">
              {[...summary.sessions.values()]
                .sort((a, b) => (a.day < b.day ? 1 : -1))
                .map((s, i) => (
                  <li key={i}>
                    <span>{s.label}</span>
                    <span className="muted">
                      {s.day === dayKey(new Date()) ? '今天' : s.day} · {s.count} 张
                    </span>
                  </li>
                ))}
            </ul>
          )}

          {summary.unassigned > 0 && (
            <p className="hint">
              有 {summary.unassigned} 张没对上任何一节课，可能是在课表以外的时间拍的，
              可以在「相册」里手动挂到某门课。
            </p>
          )}

          {summary.errors.length > 0 && (
            <details className="details">
              <summary>看看失败的 {summary.errors.length} 张</summary>
              <ul className="plain-list">
                {summary.errors.slice(0, 20).map((e, i) => (
                  <li key={i} className="muted small">
                    {e}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      <section className="card card-plain">
        <h2 className="card-title">怎么用最省事</h2>
        <ol className="steps">
          <li>上课照常用手机相机拍板书，拍清楚、别手抖。</li>
          <li>下课回到宿舍，打开这里一次选完全部照片。</li>
          <li>拍的时间落在课表某节课里，就自动归到那门课。</li>
          <li>期末按课程翻，或者直接搜关键词。</li>
        </ol>
      </section>
    </div>
  );
}
