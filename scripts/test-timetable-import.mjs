// 课表识别解析层的测试。跑法：npm test 或 node scripts/test-timetable-import.mjs
//
// 这一层是「模型输出 → 真正能用的课表」，
// 所有脏数据都在这里被挡住，所以必须测死。

import { parseWeeks } from '../src/lib/timetable.js';
import { resolvePeriods, coercePeriods, DEFAULT_PERIODS } from '../src/lib/periods.js';
import { coerceWeekday, normalizeExtraction } from '../src/lib/timetableImport.js';
import { SAMPLE_TIMETABLE } from '../src/data/sample-timetable.js';

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

console.log('\n[周次的单双周]');
check('1-16 单 → 8 个奇数周', parseWeeks('1-16 单'), [1, 3, 5, 7, 9, 11, 13, 15]);
check('1-16 双 → 8 个偶数周', parseWeeks('1-16 双'), [2, 4, 6, 8, 10, 12, 14, 16]);
check('1-16单（没有空格）', parseWeeks('1-16单'), [1, 3, 5, 7, 9, 11, 13, 15]);
check('不带范围只有「单」→ 1-30 里的奇数', parseWeeks('单').length, 15);

console.log('\n[星期的各种写法]');
check('星期三 → 3', coerceWeekday('星期三'), 3);
check('周三 → 3', coerceWeekday('周三'), 3);
check('礼拜五 → 5', coerceWeekday('礼拜五'), 5);
check('周日 → 7', coerceWeekday('周日'), 7);
check('星期天 → 7', coerceWeekday('星期天'), 7);
check('数字 6 → 6', coerceWeekday(6), 6);
check('字符串 "2" → 2', coerceWeekday('2'), 2);
check('看不懂 → null', coerceWeekday('Sunday'), null);

console.log('\n[节次的各种写法]');
check('[3,4] → [3,4]', coercePeriods([3, 4]), [3, 4]);
check('"3-4" → [3,4]', coercePeriods('3-4'), [3, 4]);
check('"3、4" → [3,4]', coercePeriods('第3、4节'), [3, 4]);
check('"5" → [5]', coercePeriods('5'), [5]);
check('空 → null', coercePeriods(''), null);

console.log('\n[节次 → 时间]');
check('第3-4节 → 10:15–11:45', resolvePeriods([3, 4], DEFAULT_PERIODS), {
  start: '10:15',
  end: '11:45',
  label: '第 3-4 节',
});
check('第5-6节 → 13:50–15:20', resolvePeriods([5, 6], DEFAULT_PERIODS), {
  start: '13:50',
  end: '15:20',
  label: '第 5-6 节',
});
check('第11-12节 → 19:30–21:00', resolvePeriods([11, 12], DEFAULT_PERIODS), {
  start: '19:30',
  end: '21:00',
  label: '第 11-12 节',
});
check('不存在的第 99 节 → null', resolvePeriods([99], DEFAULT_PERIODS), null);

console.log('\n[示例课表（虚构）]');
const real = normalizeExtraction(SAMPLE_TIMETABLE);
check('原始条目 27 条', SAMPLE_TIMETABLE.entries.length, 27);
check('全部解析成功', real.slots.length, 27);
check('没有解析失败的问题', real.problems.length, 0);
check('12 门课', real.stats.courseCount, 12);

const ds = real.slots.filter((s) => s.courseName === '数据结构与算法');
check('数据结构拆成 3 个时段', ds.length, 3);
check(
  '第 1-2 周：周一第3-4节',
  ds.some((s) => s.weekday === 1 && s.start === '10:15' && s.weeks.join() === '1,2'),
  true,
);
check(
  '第 5-12、14 周：周五第5-6节',
  ds.some((s) => s.weekday === 5 && s.start === '13:50' && s.weeks.includes(5) && s.weeks.includes(14)),
  true,
);

const english = real.slots.find((s) => s.courseName === '大学英语' && s.weekday === 2 && s.start === '13:50');
check('大学英语「1-16 单」→ 8 个单周', english.weeks, [1, 3, 5, 7, 9, 11, 13, 15]);

const pe = real.slots.filter((s) => s.courseName === '大学体育');
check('大学体育 两个时段（周四1-2节 + 周二9-10节）', pe.length, 2);

const net = real.slots.filter((s) => s.courseName === '计算机网络');
check('计算机网络 3 个时段（周五3-4节、周五5-6节、周二7-8节）', net.length, 3);

console.log('\n[脏数据挡得住吗]');
const dirty = normalizeExtraction({
  entries: [
    { course: '正常课', teacher: '某老师', weekday: '星期三', periods: '3-4', weeks: '1-16 双', room: 'A101' },
    { course: '', weekday: 1, periods: [1, 2], weeks: '1-2' },
    { course: '星期写错的课', weekday: 'Sunday', periods: [1, 2], weeks: '1-2' },
    { course: '节次对不上的课', weekday: 1, periods: [99], weeks: '1-2' },
    { course: '正常课', weekday: '周三', periods: [3, 4], weeks: '1-16 双', room: 'A101' },
  ],
});
check('只留下 1 条有效', dirty.slots.length, 1);
check('同一批里重复的会被合并', dirty.stats.read, 5);
check('记录了 3 条问题', dirty.problems.length, 3);
check('正常课的时间来自作息表', [dirty.slots[0].start, dirty.slots[0].end], ['10:15', '11:45']);
check('双周正确展开', dirty.slots[0].weeks.length, 8);

console.log('\n[重复导入不重复进库]');
const again = normalizeExtraction(SAMPLE_TIMETABLE, {
  existingCourses: real.courses,
  existingSlots: real.slots,
});
check('第二次导入 0 条新增', again.slots.length, 0);
check('27 条判为已存在', again.stats.duplicated, 27);
check('不会重复创建课程', again.newCourses.length, 0);

console.log(`\n结果：${pass} 通过 / ${fail} 失败\n`);
process.exit(fail ? 1 : 0);
