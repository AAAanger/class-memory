import { useEffect, useMemo, useState } from 'react';
import { allCourses, allPhotos, getAsset, deletePhoto, updatePhoto } from '../lib/db.js';
import { formatDate, formatTime } from '../lib/id.js';
import { WEEKDAY_NAMES } from '../lib/timetable.js';

/* ---------------- 缩略图：用到才加载，省内存 ---------------- */

function Thumb({ id, onClick }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let alive = true;
    let objectUrl = null;
    getAsset(id).then((asset) => {
      if (!alive || !asset?.thumb) return;
      objectUrl = URL.createObjectURL(asset.thumb);
      setUrl(objectUrl);
    });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  return (
    <button type="button" className="thumb" onClick={onClick}>
      {url ? <img src={url} alt="" loading="lazy" /> : <span className="thumb-ph" />}
    </button>
  );
}

/* ---------------- 大图查看 ---------------- */

function Viewer({ photo, courses, onClose, onChanged }) {
  const [url, setUrl] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let alive = true;
    let objectUrl = null;
    getAsset(photo.id).then((asset) => {
      if (!alive || !asset?.full) return;
      objectUrl = URL.createObjectURL(asset.full);
      setUrl(objectUrl);
    });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo.id]);

  async function handleReassign(event) {
    const courseId = event.target.value;
    const course = courses.find((c) => c.id === courseId) || null;
    await updatePhoto({
      ...photo,
      courseId: course ? course.id : null,
      courseName: course ? course.name : null,
      slotId: null,
      sessionKey: course ? `${photo.day}_manual_${course.id}` : `${photo.day}_unsorted`,
    });
    onChanged?.();
    onClose();
  }

  async function handleDelete() {
    await deletePhoto(photo.id);
    onChanged?.();
    onClose();
  }

  const weekday = WEEKDAY_NAMES[new Date(photo.takenAt).getDay() || 7];

  return (
    <div className="viewer">
      <div className="viewer-top">
        <button type="button" className="viewer-close" onClick={onClose}>
          ✕
        </button>
        <span className="viewer-meta">
          {formatDate(photo.takenAt)} {weekday} {formatTime(photo.takenAt)}
        </span>
      </div>

      <div className="viewer-stage">
        {url ? <img src={url} alt="板书" /> : <span className="viewer-loading">加载中…</span>}
      </div>

      <div className="viewer-bottom">
        <label className="field field-compact">
          <span>归到哪门课</span>
          <select className="input" value={photo.courseId || ''} onChange={handleReassign}>
            <option value="">待归类</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        {confirmDelete ? (
          <div className="row">
            <button type="button" className="btn btn-danger" onClick={handleDelete}>
              真的删掉
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
              算了
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-ghost btn-block" onClick={() => setConfirmDelete(true)}>
            删掉这张
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------- 主页面 ---------------- */

export default function Library({ version, onChanged, onGoTimetable, onGoImport }) {
  const [courses, setCourses] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [route, setRoute] = useState({ name: 'courses' });
  const [viewerPhoto, setViewerPhoto] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [c, p] = await Promise.all([allCourses(), allPhotos()]);
      if (!alive) return;
      setCourses(c);
      setPhotos(p);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [version]);

  // 课程 → 每节课（同一天同一时段算一节）
  const groups = useMemo(() => {
    const byKey = new Map();
    for (const p of photos) {
      const key = p.courseId || '__none__';
      if (!byKey.has(key)) byKey.set(key, { key, name: p.courseName || '待归类', items: [] });
      byKey.get(key).items.push(p);
    }

    return [...byKey.values()]
      .map((g) => {
        const course = courses.find((c) => c.id === g.key);
        const sessions = new Map();
        for (const p of g.items) {
          if (!sessions.has(p.sessionKey)) {
            sessions.set(p.sessionKey, { key: p.sessionKey, day: p.day, items: [] });
          }
          sessions.get(p.sessionKey).items.push(p);
        }
        const sessionList = [...sessions.values()]
          .map((s) => ({ ...s, items: s.items.sort((a, b) => a.takenAt - b.takenAt) }))
          .sort((a, b) => (a.day < b.day ? 1 : -1));
        return {
          key: g.key,
          name: g.name,
          color: course?.color || '#94a3b8',
          count: g.items.length,
          sessions: sessionList,
        };
      })
      .sort((a, b) => {
        const an = a.key === '__none__' ? 1 : 0;
        const bn = b.key === '__none__' ? 1 : 0;
        if (an !== bn) return an - bn;
        if (an === 1) return 0;
        return b.count - a.count;
      });
  }, [photos, courses]);

  const currentGroup = groups.find((g) => g.key === route.groupKey) || null;
  const currentSession =
    currentGroup?.sessions.find((s) => s.key === route.sessionKey) || null;

  /* ---------- 空状态 ---------- */

  if (loading) {
    return (
      <div className="page">
        <div className="skeleton-list">
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  }

  if (!photos.length) {
    return (
      <div className="page">
        <header className="page-head">
          <h1>相册</h1>
          <p className="page-sub">按课程翻你的板书</p>
        </header>
        <section className="card empty">
          <p className="empty-title">还一张照片都没有</p>
          <p className="empty-text">
            先把课表录进去，再导入上课拍的照片，它们就会自己归好类。
          </p>
          <div className="row row-btns">
            <button type="button" className="btn btn-ghost" onClick={onGoTimetable}>
              录课表
            </button>
            <button type="button" className="btn btn-primary" onClick={onGoImport}>
              导入照片
            </button>
          </div>
        </section>
      </div>
    );
  }

  /* ---------- 第三层：一节课里的照片 ---------- */

  if (currentSession) {
    return (
      <div className="page">
        <header className="page-head page-head-row">
          <button
            type="button"
            className="back"
            onClick={() => setRoute({ name: 'sessions', groupKey: route.groupKey })}
          >
            ‹ 返回
          </button>
          <div>
            <h1>{currentGroup.name}</h1>
            <p className="page-sub">
              {formatDate(currentSession.items[0].takenAt)} · {currentSession.items.length} 张
            </p>
          </div>
        </header>

        <div className="grid">
          {currentSession.items.map((p) => (
            <Thumb key={p.id} id={p.id} onClick={() => setViewerPhoto(p)} />
          ))}
        </div>

        {viewerPhoto && (
          <Viewer
            photo={viewerPhoto}
            courses={courses}
            onClose={() => setViewerPhoto(null)}
            onChanged={onChanged}
          />
        )}
      </div>
    );
  }

  /* ---------- 第二层：某门课有哪几节课 ---------- */

  if (currentGroup) {
    return (
      <div className="page">
        <header className="page-head page-head-row">
          <button type="button" className="back" onClick={() => setRoute({ name: 'courses' })}>
            ‹ 返回
          </button>
          <div>
            <h1 style={{ color: currentGroup.color }}>{currentGroup.name}</h1>
            <p className="page-sub">{currentGroup.sessions.length} 次课 · {currentGroup.count} 张</p>
          </div>
        </header>

        <div className="card">
          {currentGroup.sessions.map((s) => (
            <button
              key={s.key}
              type="button"
              className="session-row"
              onClick={() =>
                setRoute({ name: 'photos', groupKey: currentGroup.key, sessionKey: s.key })
              }
            >
              <span className="session-date">
                {formatDate(s.items[0].takenAt)}
                <small>{WEEKDAY_NAMES[new Date(s.items[0].takenAt).getDay() || 7]}</small>
              </span>
              <span className="session-info">
                {formatTime(s.items[0].takenAt)}–{formatTime(s.items[s.items.length - 1].takenAt)}
                <small>{s.items.length} 张</small>
              </span>
              <span className="chev">›</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ---------- 第一层：所有课程 ---------- */

  return (
    <div className="page">
      <header className="page-head">
        <h1>相册</h1>
        <p className="page-sub">{photos.length} 张板书，按课程分开</p>
      </header>

      <div className="course-list">
        {groups.map((g) => (
          <button
            key={g.key}
            type="button"
            className="course-card"
            onClick={() => setRoute({ name: 'sessions', groupKey: g.key })}
          >
            <span className="course-bar" style={{ background: g.color }} />
            <span className="course-body">
              <span className="course-name">{g.name}</span>
              <span className="course-meta">
                {g.sessions.length} 次课 · {g.count} 张
              </span>
            </span>
            <span className="chev">›</span>
          </button>
        ))}
      </div>

      <p className="footnote">
        点进某门课 → 挑一次课 → 看那天的板书。期末复习从最上面那门开始翻就行。
      </p>
    </div>
  );
}
