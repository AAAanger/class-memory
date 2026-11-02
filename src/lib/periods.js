// ============================================================
//  节次 → 具体几点几分
//
//  教务系统的课表上写的是「第1-2节」「第3-4节」，不是时间。
//  所以需要一张「作息时间表」把节次翻译成时间。
//  不同学校不一样，可以在「课表」页下面那栏里改。
// ============================================================

// 默认按常见高校作息（第 3-4 节取 10:15–11:45；有的学校 5 层以上会顺延 5 分钟）
export const DEFAULT_PERIODS = [
  { label: '第 1-2 节', no: [1, 2], start: '08:20', end: '09:50' },
  { label: '第 3-4 节', no: [3, 4], start: '10:15', end: '11:45' },
  { label: '第 5-6 节', no: [5, 6], start: '13:50', end: '15:20' },
  { label: '第 7-8 节', no: [7, 8], start: '15:40', end: '17:10' },
  { label: '第 9-10 节', no: [9, 10], start: '17:45', end: '19:15' },
  { label: '第 11-12 节', no: [11, 12], start: '19:30', end: '21:00' },
];

/** 把节次数组 [3,4] 翻译成 { start, end, label }，对不上就返回 null */
export function resolvePeriods(periods, table = DEFAULT_PERIODS) {
  if (!Array.isArray(periods) || periods.length === 0) return null;
  const list = [...periods].map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (!list.length) return null;
  list.sort((a, b) => a - b);

  const rows = (Array.isArray(table) && table.length ? table : DEFAULT_PERIODS).filter(
    (r) => Array.isArray(r.no) && r.no.length,
  );

  // 最理想：某一行的节次正好把这几个节全覆盖了
  const exact = rows
    .filter((r) => list.every((p) => r.no.includes(p)))
    .sort((a, b) => a.no[0] - b.no[0]);
  if (exact.length) {
    return { start: exact[0].start, end: exact[0].end, label: exact[0].label };
  }

  // 退一步：拿第一个节的开始 + 最后一个节的结束（比如 3、4 节被拆成了两行）
  const first = rows.find((r) => r.no.includes(list[0]));
  const last = rows.find((r) => r.no.includes(list[list.length - 1]));
  if (first && last) {
    return {
      start: first.start,
      end: last.end,
      label: list.length > 1 ? `第 ${list[0]}-${list[list.length - 1]} 节` : `第 ${list[0]} 节`,
    };
  }

  return null;
}

/** [3,4] -> "第3-4节" */
export function describePeriods(periods) {
  const list = [...(periods || [])].map(Number).sort((a, b) => a - b);
  if (!list.length) return '';
  return list.length === 1 ? `第${list[0]}节` : `第${list[0]}-${list[list.length - 1]}节`;
}

/**
 * 模型可能会返回 [3,4]，也可能返回 "3-4"、"3,4"、[3]、"第三四节"。
 * 这里统一成数字数组，认不出来返回 null。
 */
export function coercePeriods(value) {
  if (Array.isArray(value)) {
    const list = value.map((v) => Number(String(v).replace(/[^\d]/g, ''))).filter((n) => n > 0);
    return list.length ? [...new Set(list)].sort((a, b) => a - b) : null;
  }
  const text = String(value ?? '').replace(/[第节\s]/g, '');
  if (!text) return null;

  // "3-4" / "3~4"
  const range = text.match(/^(\d+)\s*[-~到至]\s*(\d+)$/);
  if (range) {
    let a = Number(range[1]);
    let b = Number(range[2]);
    if (a > b) [a, b] = [b, a];
    const out = [];
    for (let i = a; i <= b; i++) out.push(i);
    return out;
  }
  // "3,4" 或 "3"
  const nums = text.split(/[,，、\s]+/).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  return nums.length ? [...new Set(nums)].sort((a, b) => a - b) : null;
}
