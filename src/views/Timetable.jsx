import { useEffect, useMemo, useState } from 'react';
import { allCourses, allSlots, putCourse, putSlot, deleteSlot } from '../lib/db.js';
import { parseWeeks, toMin, weeksToText, WEEKDAY_NAMES } from '../lib/timetable.js';
import { PALETTE } from '../config.js';
import { newId } from '../lib/id.js';
import ImportTimetable from './ImportTimetable.jsx';

const EMPTY = {
  name: '',
  teacher: '',
  weekday: 1,
  start: '08:00',
  end: '09:40',
  weeks: '1-16',
  room: '',
};

export default function Timetable({ config, updateConfig, version, onChanged }) {
  const [slots, setSlots] = useState([]);
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const [s, c] = await Promise.all([allSlots(), allCourses()]);
      setSlots(s);
      setCourses(c);
    })();
  }, [version]);

  const colorOf = useMemo(
    () => Object.fromEntries(courses.map((c) => [c.id, c.color])),
    [courses],
  );

  const grouped = useMemo(() => {
    const map = new Map();
    for (let d = 1; d <= 7; d++) map.set(d, []);
    for (const s of slots) {
      if (!map.has(s.weekday)) map.set(s.weekday, []);
      map.get(s.weekday).push(s);
    }
    return map;
  }, [slots]);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setError('');
  }

  function startEdit(slot) {
    setEditingId(slot.id);
    setForm({
      name: slot.courseName || '',
      teacher: courses.find((c) => c.id === slot.courseId)?.teacher || '',
      weekday: slot.weekday,
      start: slot.start,
      end: slot.end,
      weeks: weeksToText(slot.weeks),
      room: slot.room || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY);
    setError('');
  }

  async function handleSave() {
    const name = form.name.trim();
    if (!name) {
      setError('课程名要填一下');
      return;
    }
    if (toMin(form.end) <= toMin(form.start)) {
      setError('下课时间要晚于上课时间');
      return;
    }

    setSaving(true);
    try {
      const existingCourses = await allCourses();
      let course = existingCourses.find(
        (c) => c.name.trim().toLowerCase() === name.toLowerCase(),
      );
      if (!course) {
        course = {
          id: newId(),
          name,
          teacher: form.teacher.trim(),
          color: PALETTE[existingCourses.length % PALETTE.length],
          createdAt: Date.now(),
        };
        await putCourse(course);
      }

      await putSlot({
        id: editingId || newId(),
        courseId: course.id,
        courseName: course.name,
        weekday: Number(form.weekday),
        start: form.start,
        end: form.end,
        weeks: parseWeeks(form.weeks),
        room: form.room.trim(),
      });

      cancelEdit();
      onChanged?.();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(slot) {
    const ok = window.confirm(`删掉「${slot.courseName} ${WEEKDAY_NAMES[slot.weekday]} ${slot.start}」这节课？`);
    if (!ok) return;
    await deleteSlot(slot.id);
    if (editingId === slot.id) cancelEdit();
    onChanged?.();
  }

  function updatePeriod(index, patch) {
    const table = config.periods || [];
    const next = table.map((row, i) => (i === index ? { ...row, ...patch } : row));
    updateConfig({ periods: next });
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>课表</h1>
        <p className="page-sub">照片就是靠这张表自动分到各门课上的</p>
      </header>

      {!config.termStart && (
        <div className="banner banner-warn">
          还没填「开学第一天」，周次就没法算，照片只能按星期几分。
        </div>
      )}

      <section className="card">
        <h2 className="card-title">从截图导入</h2>
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => setImportOpen(true)}
        >
          识别课表截图
        </button>
        <p className="hint">
          上传教务系统的课表截图，自动拆成「星期 + 节次 + 周次 + 教室」。
          同一门课在不同周次换了时间（比如数据结构 1-2 周在周一、5-12 周挪到周五）会被拆成多条，这正是它能正确处理的情况。
          识别完先给你核对，确认后才写进课表。
        </p>
      </section>

      <section className="card">
        <label className="field">
          <span>开学第一周的周一</span>
          <input
            type="date"
            className="input"
            value={config.termStart || ''}
            onChange={(e) => updateConfig({ termStart: e.target.value })}
          />
        </label>
        <p className="hint">
          填错了只会影响「单双周」的判断，普通每周都上的课不受影响。
        </p>
      </section>

      <details className="card">
        <summary className="card-title" style={{ cursor: 'pointer', marginBottom: 0 }}>
          作息时间表（节次 → 几点）
        </summary>
        <p className="hint" style={{ marginTop: 10 }}>
          教务系统只写「第3-4节」，靠这张表翻译成时间。学校不同、楼栋不同就改这里。
        </p>
        {(config.periods || []).map((row, index) => (
          <div className="period-row" key={row.label || index}>
            <span className="period-label">{row.label}</span>
            <input
              type="time"
              className="input"
              value={row.start}
              onChange={(e) => updatePeriod(index, { start: e.target.value })}
            />
            <span className="period-dash">–</span>
            <input
              type="time"
              className="input"
              value={row.end}
              onChange={(e) => updatePeriod(index, { end: e.target.value })}
            />
          </div>
        ))}
      </details>

      <section className="card">
        <h2 className="card-title">{editingId ? '修改这节课' : '加一节课'}</h2>

        <label className="field">
          <span>课程名</span>
          <input
            className="input"
            placeholder="例如：高等数学"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </label>

        <div className="row">
          <label className="field">
            <span>星期</span>
            <select
              className="input"
              value={form.weekday}
              onChange={(e) => set('weekday', Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <option key={d} value={d}>
                  {WEEKDAY_NAMES[d]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>教室</span>
            <input
              className="input"
              placeholder="选填"
              value={form.room}
              onChange={(e) => set('room', e.target.value)}
            />
          </label>
        </div>

        <div className="row">
          <label className="field">
            <span>上课</span>
            <input
              type="time"
              className="input"
              value={form.start}
              onChange={(e) => set('start', e.target.value)}
            />
          </label>
          <label className="field">
            <span>下课</span>
            <input
              type="time"
              className="input"
              value={form.end}
              onChange={(e) => set('end', e.target.value)}
            />
          </label>
        </div>

        <label className="field">
          <span>周次</span>
          <input
            className="input"
            placeholder="1-16"
            value={form.weeks}
            onChange={(e) => set('weeks', e.target.value)}
          />
        </label>
        <p className="hint">可以写 1-16、1,3,5,7，或者 1-8,10-16；留空就是每周都上。</p>

        {error && <p className="error">{error}</p>}

        <div className="row row-btns">
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '保存中…' : editingId ? '保存修改' : '加进课表'}
          </button>
          {editingId && (
            <button type="button" className="btn btn-ghost" onClick={cancelEdit}>
              取消
            </button>
          )}
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">我的课表 · {slots.length} 节</h2>
        {slots.length === 0 && <p className="empty-inline">还空着，上面加一节试试。</p>}

        {[1, 2, 3, 4, 5, 6, 7].map((d) => {
          const list = grouped.get(d) || [];
          if (!list.length) return null;
          return (
            <div key={d} className="day-block">
              <p className="day-title">{WEEKDAY_NAMES[d]}</p>
              {list.map((s) => (
                <div key={s.id} className="slot-row">
                  <span
                    className="slot-dot"
                    style={{ background: colorOf[s.courseId] || '#94a3b8' }}
                  />
                  <div className="slot-main">
                    <p className="slot-name">{s.courseName}</p>
                    <p className="slot-meta">
                      {s.start}–{s.end} ·{' '}
                      {weeksToText(s.weeks) ? `第 ${weeksToText(s.weeks)} 周` : '每周'}
                      {s.room ? ` · ${s.room}` : ''}
                    </p>
                  </div>
                  <button type="button" className="mini" onClick={() => startEdit(s)}>
                    改
                  </button>
                  <button type="button" className="mini mini-danger" onClick={() => handleDelete(s)}>
                    删
                  </button>
                </div>
              ))}
            </div>
          );
        })}
      </section>

      {importOpen && (
        <ImportTimetable
          config={config}
          onClose={() => setImportOpen(false)}
          onImported={onChanged}
        />
      )}
    </div>
  );
}
