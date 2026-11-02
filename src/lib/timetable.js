// ============================================================
//  课表匹配：把「拍摄时间」翻译成「哪门课」
//  这是整个工具唯一的核心算法，只有几十行。
// ============================================================

/** "08:30" -> 510（从 0 点开始的分钟数） */
export function toMin(hhmm) {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Date -> "2026-11-04"，用来按天分组 */
export function dayKey(d) {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const dd = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** 这天是学期第几周（1 开始）；没设学期开始日期就返回 null */
export function termWeek(at, termStart) {
  if (!termStart) return null;
  const days = Math.round((startOfDay(at) - startOfDay(new Date(termStart))) / 86400000);
  return Math.floor(days / 7) + 1;
}

/**
 * 解析「周次」文本，支持这些写法：
 *   "1-16"        第 1 到 16 周
 *   "1,3,5,7"     指定周
 *   "1-8,10-16"   多段
 *   "1-16 单"     这个区间里只上单周（教务系统常这么写）
 *   "1-16 双"     只上双周
 *   留空          当作全学期（1-30 周）
 */
export function parseWeeks(text) {
  const raw = String(text ?? '').trim();
  const oddOnly = /单/.test(raw);
  const evenOnly = /双/.test(raw);
  // 把「单」「双」「周」这些字去掉，剩下的才是数字部分
  const body = raw.replace(/[单双周]/g, '').trim();

  const out = new Set();
  if (body) {
    for (const part of body.split(/[,，、\s]+/)) {
      if (!part) continue;
      const range = part.match(/^(\d+)\s*[-~到至]\s*(\d+)$/);
      if (range) {
        let a = Number(range[1]);
        let b = Number(range[2]);
        if (a > b) [a, b] = [b, a];
        for (let i = a; i <= b; i++) out.add(i);
      } else if (/^\d+$/.test(part)) {
        out.add(Number(part));
      }
    }
  }

  // 写成了看不懂的东西（比如 "每天"），当全学期处理，别让这节课永远匹配不上
  if (!out.size) {
    for (let i = 1; i <= 30; i++) out.add(i);
  }

  let list = [...out];
  if (oddOnly && !evenOnly) list = list.filter((w) => w % 2 === 1);
  if (evenOnly && !oddOnly) list = list.filter((w) => w % 2 === 0);
  return list.sort((a, b) => a - b);
}

/**
 * 给一张照片的时间，找出它属于哪个上课时段。
 * 命中多个（比如两节连堂课前后重叠）时，取时间上最靠近中间的那个。
 * 匹配不上返回 null —— 宁可说不知道，也不要瞎猜。
 */
export function matchSlot(at, slots, config) {
  const d = new Date(at);
  const weekday = d.getDay() || 7; // 周一 = 1 … 周日 = 7
  const week = termWeek(d, config.termStart);
  const cur = d.getHours() * 60 + d.getMinutes();

  let best = null;
  for (const s of slots) {
    if (Number(s.weekday) !== weekday) continue;
    // 没设学期开始日期时，先不按周次过滤
    if (week != null && Array.isArray(s.weeks) && !s.weeks.includes(week)) continue;

    const from = toMin(s.start) - (config.beforeBufferMin ?? 10);
    const to = toMin(s.end) + (config.afterBufferMin ?? 30);
    if (cur < from || cur > to) continue;

    const mid = (toMin(s.start) + toMin(s.end)) / 2;
    const score = Math.abs(cur - mid);
    if (!best || score < best.score) best = { slot: s, score };
  }
  return best ? best.slot : null;
}

/** 给这组照片一个稳定的分组 id：同一天 + 同一时段 = 同一节课 */
export function makeSessionKey(day, slot) {
  return slot ? `${day}_${slot.id}` : `${day}_unsorted`;
}

export const WEEKDAY_NAMES = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];

/**
 * [1,2,3,5,6] -> "1-3, 5-6"
 * 整学期（30 周）或空数组 -> ""（界面上显示成「每周」）
 */
export function weeksToText(weeks) {
  if (!Array.isArray(weeks) || !weeks.length || weeks.length >= 30) return '';

  const sorted = [...weeks].sort((a, b) => a - b);
  const parts = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const week = sorted[i];
    if (week === prev + 1) {
      prev = week;
      continue;
    }
    parts.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = week;
    prev = week;
  }
  parts.push(start === prev ? `${start}` : `${start}-${prev}`);

  return parts.join(', ');
}

