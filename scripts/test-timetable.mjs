// 核心算法的自测。跑法：node scripts/test-timetable.mjs
// 只测纯逻辑，不需要浏览器。

import { toMin, parseWeeks, termWeek, matchSlot, dayKey, makeSessionKey } from '../src/lib/timetable.js';

let pass = 0;
let fail = 0;

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fail += 1;
    console.log(`  ✗ ${name}\n      期望 ${JSON.stringify(expected)}\n      实际 ${JSON.stringify(actual)}`);
  }
}

const CONFIG = {
  termStart: '2026-09-07', // 周一
  beforeBufferMin: 10,
  afterBufferMin: 30,
};

// 周三 10:00–11:40 的高数
const MATH = {
  id: 'slot-math',
  courseId: 'c-math',
  courseName: '高等数学',
  weekday: 3,
  start: '10:00',
  end: '11:40',
  weeks: parseWeeks('1-16'),
};

// 周三 14:00–15:40 的英语
const ENGLISH = {
  id: 'slot-en',
  courseId: 'c-en',
  courseName: '大学英语',
  weekday: 3,
  start: '14:00',
  end: '15:40',
  weeks: parseWeeks('1-16'),
};

const SLOTS = [MATH, ENGLISH];

console.log('\n[时间换算]');
check('08:30 -> 510', toMin('08:30'), 510);
check('00:00 -> 0', toMin('00:00'), 0);

console.log('\n[周次解析]');
check('1-16 共 16 周', parseWeeks('1-16').length, 16);
check('1-16 首尾', [parseWeeks('1-16')[0], parseWeeks('1-16')[15]], [1, 16]);
check('1-8,10-16 跳过第 9 周', parseWeeks('1-8,10-16').includes(9), false);
check('逗号分隔 1,3,5', parseWeeks('1,3,5'), [1, 3, 5]);
check('中文顿号 1、3、5', parseWeeks('1、3、5'), [1, 3, 5]);
check('空值 = 全学期 30 周', parseWeeks('').length, 30);

console.log('\n[算第几周]');
// 2026-09-07 是周一，所以 09-07~09-13 是第 1 周
check('开学当天 = 第 1 周', termWeek(new Date('2026-09-07T10:00:00'), CONFIG.termStart), 1);
check('09-09 = 第 1 周', termWeek(new Date('2026-09-09T10:00:00'), CONFIG.termStart), 1);
check('09-14 = 第 2 周', termWeek(new Date('2026-09-14T10:00:00'), CONFIG.termStart), 2);
check('10-21 = 第 7 周', termWeek(new Date('2026-10-21T10:00:00'), CONFIG.termStart), 7);

console.log('\n[匹配课程]');
const hit = (iso) => matchSlot(new Date(iso), SLOTS, CONFIG)?.courseName ?? null;

check('上课中 10:20 → 高数', hit('2026-11-04T10:20:00'), '高等数学');
check('课前 5 分钟 09:55 → 高数', hit('2026-11-04T09:55:00'), '高等数学');
check('课前 11 分钟 09:49 → 不匹配', hit('2026-11-04T09:49:00'), null);
check('下课后 30 分钟 12:10 → 高数', hit('2026-11-04T12:10:00'), '高等数学');
check('下课后 35 分钟 12:15 → 不匹配', hit('2026-11-04T12:15:00'), null);
check('下午英语 14:30 → 大学英语', hit('2026-11-04T14:30:00'), '大学英语');
check('周四同一时间 → 不匹配（星期不对）', hit('2026-11-05T10:20:00'), null);
check('第 20 周（超出 1-16 周）→ 不匹配', hit('2027-01-20T10:20:00'), null);

console.log('\n[边界：两节课挨着]');
// 一节 08:00-09:40，一节 10:00-11:40，中间 09:50 拍的算谁？
const back = { ...MATH, id: 'slot-a', courseId: 'c-a', courseName: '第一节', start: '08:00', end: '09:40' };
const front = { ...MATH, id: 'slot-b', courseId: 'c-b', courseName: '第二节', start: '10:00', end: '11:40' };
const both = [back, front];
check('09:35 归第一节', matchSlot(new Date('2026-11-04T09:35:00'), both, CONFIG)?.courseName, '第一节');
check('10:05 归第二节', matchSlot(new Date('2026-11-04T10:05:00'), both, CONFIG)?.courseName, '第二节');
// 09:46 两节课都在宽限窗口里，取离课中更近的
const mid = matchSlot(new Date('2026-11-04T09:46:00'), both, CONFIG);
check('09:46 有结论（不返回 null）', mid !== null, true);

console.log('\n[分组键]');
check('day 格式', dayKey(new Date('2026-11-04T10:20:00')), '2026-11-04');
check('有课时的 key', makeSessionKey('2026-11-04', MATH), '2026-11-04_slot-math');
check('没课时归待归类', makeSessionKey('2026-11-04', null), '2026-11-04_unsorted');

console.log(`\n结果：${pass} 通过 / ${fail} 失败\n`);
process.exit(fail ? 1 : 0);
