// ============================================================
//  识别结果 → 真正能用的课表
//
//  模型返回的东西一定会有脏数据：星期写成"星期三"、节次写成"3-4"、
//  周次写成"1-16 单"、一格里塞了三门课……
//  这一层负责校验、翻译、去重、分组，把脏数据变成干净的 slots。
//  它是纯函数，不碰数据库、不碰网络，所以可以完整测试。
// ============================================================

import { PALETTE } from '../config.js';
import { newId } from './id.js';
import { parseWeeks, WEEKDAY_NAMES } from './timetable.js';
import { DEFAULT_PERIODS, resolvePeriods, coercePeriods } from './periods.js';

const DAY_CHARS = ['一', '二', '三', '四', '五', '六', '日'];

/** "星期三" / "周三" / 3 / "3" / "Sunday" 之类的，统一成 1-7 */
export function coerceWeekday(value) {
  if (typeof value === 'number' && value >= 1 && value <= 7) return value;

  const text = String(value ?? '').trim();
  if (!text) return null;

  for (let i = 1; i <= 7; i++) {
    if (text.includes(WEEKDAY_NAMES[i])) return i; // 周一、周日
    if (text.includes(`星期${DAY_CHARS[i - 1]}`)) return i; // 星期一
    if (text.includes(`礼拜${DAY_CHARS[i - 1]}`)) return i;
  }
  if (/周末|周日|周天|星期天/.test(text)) return 7;

  const n = Number(text.replace(/[^\d]/g, ''));
  if (Number.isFinite(n) && n >= 1 && n <= 7) return n;

  return null;
}

/** 周次可能就是数组，也可能是一段文字 */
function coerceWeeks(value) {
  if (Array.isArray(value)) {
    const list = value.map(Number).filter((n) => Number.isFinite(n) && n > 0);
    return list.length ? [...new Set(list)].sort((a, b) => a - b) : [];
  }
  return parseWeeks(value);
}

const slotSignature = (s) =>
  `${String(s.courseName || '').trim().toLowerCase()}|${s.weekday}|${s.start}|${s.end}|${(s.weeks || []).join(',')}`;

/**
 * @param {{entries?: any[]}} raw   模型返回的原始 JSON
 * @param {object} options
 * @param {Array}  options.periodsTable    作息时间表
 * @param {Array}  options.existingCourses 已有的课程（同名的复用 id/颜色）
 * @param {Array}  options.existingSlots   已有的时段（用来跳过重复）
 */
export function normalizeExtraction(raw, options = {}) {
  const {
    periodsTable = DEFAULT_PERIODS,
    existingCourses = [],
    existingSlots = [],
  } = options;

  const rawEntries = Array.isArray(raw?.entries) ? raw.entries : [];
  const problems = [];
  const coursesByName = new Map();
  const slots = [];
  const seen = new Set();

  // 已有课程先放进来，同名课程沿用原来的 id 和颜色
  for (const c of existingCourses) {
    coursesByName.set(String(c.name).trim().toLowerCase(), { ...c, isNew: false });
  }

  rawEntries.forEach((entry, index) => {
    const line = index + 1;
    const name = String(entry?.course ?? entry?.name ?? '').trim();
    if (!name) {
      problems.push(`第 ${line} 条没有课程名，已跳过`);
      return;
    }

    const weekday = coerceWeekday(entry?.weekday);
    if (!weekday) {
      problems.push(`「${name}」的星期写成「${entry?.weekday ?? ''}」，认不出来，已跳过`);
      return;
    }

    const periods = coercePeriods(entry?.periods);
    if (!periods) {
      problems.push(`「${name}」的节次写成「${entry?.periods ?? ''}」，认不出来，已跳过`);
      return;
    }

    const time = resolvePeriods(periods, periodsTable);
    if (!time) {
      problems.push(
        `「${name}」的节次 ${periods.join('、')} 在作息时间表里找不到对应时间，已跳过（可以去课表页改作息表）`,
      );
      return;
    }

    const weeks = coerceWeeks(entry?.weeks);
    if (!weeks.length) {
      problems.push(`「${name}」的周次写成「${entry?.weeks ?? ''}」，认不出来，已跳过`);
      return;
    }

    const key = name.toLowerCase();
    let course = coursesByName.get(key);
    if (!course) {
      course = {
        id: newId(),
        name,
        teacher: String(entry?.teacher ?? '').trim(),
        color: PALETTE[coursesByName.size % PALETTE.length],
        createdAt: Date.now(),
        isNew: true,
      };
      coursesByName.set(key, course);
    } else if (!course.teacher && entry?.teacher) {
      course.teacher = String(entry.teacher).trim();
    }

    const candidate = {
      id: newId(),
      courseId: course.id,
      courseName: course.name,
      weekday,
      start: time.start,
      end: time.end,
      periods,
      weeks,
      room: String(entry?.room ?? '').trim(),
      source: 'ocr',
    };

    // 同一批里重复的（模型有时会把一格读两遍）
    const signature = slotSignature(candidate);
    if (seen.has(signature)) return;
    seen.add(signature);

    slots.push(candidate);
  });

  // 和数据库里已有的课表去重
  const existingKeys = new Set(existingSlots.map(slotSignature));
  const fresh = slots.filter((s) => !existingKeys.has(slotSignature(s)));
  const duplicated = slots.length - fresh.length;

  const allCourses = [...coursesByName.values()];
  const strip = ({ isNew, ...rest }) => rest;

  return {
    courses: allCourses.map(strip),
    newCourses: allCourses.filter((c) => c.isNew).map(strip),
    slots: fresh,
    problems,
    stats: {
      read: rawEntries.length,
      accepted: fresh.length,
      duplicated,
      skipped: rawEntries.length - slots.length,
      courseCount: new Set(fresh.map((s) => s.courseName)).size,
    },
  };
}
