import { useMemo, useRef, useState } from 'react';
import { compressToDataUrl } from '../lib/image.js';
import { normalizeExtraction } from '../lib/timetableImport.js';
import { weeksToText, WEEKDAY_NAMES } from '../lib/timetable.js';
import { describePeriods } from '../lib/periods.js';
import { allCourses, allSlots, importTimetable } from '../lib/db.js';
import { SAMPLE_TIMETABLE } from '../data/sample-timetable.js';

const MAX_IMAGES = 4;

export default function ImportTimetable({ config, onClose, onImported }) {
  const [images, setImages] = useState([]); // dataURL[]
  const [status, setStatus] = useState('idle'); // idle | preparing | working | preview
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const fileRef = useRef(null);

  /* ---------------- 选图 ---------------- */

  async function handlePick(fileList) {
    const picked = [...(fileList || [])].filter((f) => f.type.startsWith('image/'));
    if (!picked.length) return;

    setError('');
    setStatus('preparing');
    try {
      const urls = [];
      for (const file of picked.slice(0, MAX_IMAGES)) {
        urls.push(await compressToDataUrl(file));
      }
      setImages(urls);
    } catch (e) {
      setError(e?.message || '图片处理失败');
    } finally {
      setStatus('idle');
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  /* ---------------- 识别 ---------------- */

  async function applyRaw(raw, noteText = '') {
    const [existingCourses, existingSlots] = await Promise.all([allCourses(), allSlots()]);
    const normalized = normalizeExtraction(raw, {
      periodsTable: config.periods,
      existingCourses,
      existingSlots,
    });
    setResult(normalized);
    setSelected(new Set(normalized.slots.map((s) => s.id)));
    setNote(noteText);
    setStatus('preview');
  }

  async function handleRecognize() {
    if (!images.length) return;
    setStatus('working');
    setError('');
    try {
      const response = await fetch('/api/parse-timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = [payload.error || `识别失败（${response.status}）`, payload.hint]
          .filter(Boolean)
          .join('\n\n');
        throw new Error(message);
      }

      await applyRaw(payload.data, payload.mock ? '演示模式：返回的是内置课表，没有真的调模型' : '');
    } catch (e) {
      setError(e?.message || '识别失败');
      setStatus('idle');
    }
  }

  async function handlePreset() {
    setError('');
    try {
      await applyRaw(SAMPLE_TIMETABLE, '这是内置的示例课表，走的是同一套解析流程');
    } catch (e) {
      setError(e?.message || '载入失败');
    }
  }

  /* ---------------- 勾选 ---------------- */

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleGroup(slots) {
    const ids = slots.map((s) => s.id);
    const allOn = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (allOn) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  /* ---------------- 导入 ---------------- */

  async function handleImport() {
    const slots = result.slots.filter((s) => selected.has(s.id));
    if (!slots.length) return;
    const used = new Set(slots.map((s) => s.courseName));
    const courses = result.newCourses.filter((c) => used.has(c.name));
    await importTimetable({ courses, slots });
    onImported?.();
    onClose();
  }

  /* ---------------- 分组 ---------------- */

  const groups = useMemo(() => {
    if (!result) return [];
    const byName = new Map();
    for (const slot of result.slots) {
      if (!byName.has(slot.courseName)) byName.set(slot.courseName, []);
      byName.get(slot.courseName).push(slot);
    }
    return [...byName.entries()]
      .map(([name, slots]) => ({
        name,
        color: result.courses.find((c) => c.name === name)?.color || '#94a3b8',
        slots: slots.sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start)),
      }))
      .sort((a, b) => b.slots.length - a.slots.length);
  }, [result]);

  const selectedCount = selected.size;

  return (
    <div className="sheet">
      <header className="sheet-head">
        <button type="button" className="sheet-close" onClick={onClose}>
          ✕
        </button>
        <div>
          <h2>识别课表截图</h2>
          <p className="sheet-sub">
            {status === 'preview' ? '核对一下，勾掉的不会导入' : '上传教务系统截的课程表，自动拆成一门门课'}
          </p>
        </div>
      </header>

      <div className="sheet-body">
        {status !== 'preview' && (
          <>
            <button
              type="button"
              className="dropzone"
              disabled={status === 'working' || status === 'preparing'}
              onClick={() => fileRef.current?.click()}
            >
              <span className="dropzone-icon">＋</span>
              <strong>{images.length ? `已选 ${images.length} 张` : '选择课表截图'}</strong>
              <span className="dropzone-sub">最多 {MAX_IMAGES} 张，表格太长可以分几张截</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => handlePick(e.target.files)}
            />

            {images.length > 0 && (
              <div className="thumb-strip">
                {images.map((url, i) => (
                  <img key={i} src={url} alt={`第 ${i + 1} 张`} />
                ))}
              </div>
            )}

            {status === 'preparing' && <p className="hint">正在压缩图片…</p>}

            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={!images.length || status === 'working' || status === 'preparing'}
              onClick={handleRecognize}
            >
              {status === 'working' ? '正在识别，通常 10~30 秒…' : '开始识别'}
            </button>

            {status === 'working' && (
              <div className="progress" style={{ marginTop: 12 }}>
                <div className="progress-bar progress-indeterminate" />
              </div>
            )}

            <div className="or-line"><span>或者</span></div>

            <button type="button" className="btn btn-ghost btn-block" onClick={handlePreset}>
              载入示例课表（不用 Key，直接看效果）
            </button>

            <p className="hint">
              识别需要模型 Key，配置方法见 <code>docs/识别课表截图.md</code>。
              没配也能用下面那个按钮，先看看效果。
            </p>
          </>
        )}

        {error && <div className="banner banner-error" style={{ whiteSpace: 'pre-wrap' }}>{error}</div>}

        {status === 'preview' && result && (
          <>
            {note && <div className="banner banner-info">{note}</div>}

            <div className="stat-row">
              <div className="stat">
                <span className="stat-num">{result.stats.courseCount}</span>
                <span className="stat-label">门课</span>
              </div>
              <div className="stat">
                <span className="stat-num">{result.stats.accepted}</span>
                <span className="stat-label">个时段</span>
              </div>
              <div className="stat">
                <span className="stat-num">{result.stats.duplicated}</span>
                <span className="stat-label">已存在</span>
              </div>
              <div className="stat">
                <span className="stat-num">{result.problems.length}</span>
                <span className="stat-label">没认出来</span>
              </div>
            </div>

            {result.problems.length > 0 && (
              <details className="details">
                <summary>有 {result.problems.length} 条没处理，点开看看</summary>
                <ul className="plain-list">
                  {result.problems.map((p, i) => (
                    <li key={i} className="small muted">{p}</li>
                  ))}
                </ul>
              </details>
            )}

            <p className="section-label">核对一下（点一下取消勾选）</p>

            {groups.map((group) => {
              const allOn = group.slots.every((s) => selected.has(s.id));
              return (
                <div key={group.name} className="entry-group">
                  <button type="button" className="entry-group-head" onClick={() => toggleGroup(group.slots)}>
                    <span className="slot-dot" style={{ background: group.color }} />
                    <span className="entry-group-name">{group.name}</span>
                    <span className="entry-group-count">{group.slots.length} 个时段</span>
                    <span className={`check${allOn ? ' is-on' : ''}`}>{allOn ? '✓' : ''}</span>
                  </button>

                  {group.slots.map((slot) => {
                    const on = selected.has(slot.id);
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        className={`entry-row${on ? '' : ' is-off'}`}
                        onClick={() => toggle(slot.id)}
                      >
                        <span className={`check small${on ? ' is-on' : ''}`}>{on ? '✓' : ''}</span>
                        <span className="entry-text">
                          <span className="entry-line1">
                            {WEEKDAY_NAMES[slot.weekday]} {describePeriods(slot.periods)}
                            <em>{slot.start}–{slot.end}</em>
                          </span>
                          <span className="entry-line2">
                            {weeksToText(slot.weeks) ? `第 ${weeksToText(slot.weeks)} 周` : '每周'}
                            {slot.room ? ` · ${slot.room}` : ''}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}

            {result.slots.length === 0 && (
              <p className="hint">没有可导入的时段：可能全都已经存在了，或者一条都没认出来。</p>
            )}
          </>
        )}
      </div>

      {status === 'preview' && (
        <footer className="sheet-foot">
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={selectedCount === 0}
            onClick={handleImport}
          >
            导入 {selectedCount} 个时段
          </button>
        </footer>
      )}
    </div>
  );
}
