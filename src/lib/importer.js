// ============================================================
//  导入流水线（这个工具的「大脑」）
//
//  一张照片进来，依次做四件事：
//    1. 读拍摄时间        → EXIF
//    2. 压缩 + 生成指纹    → 本地处理
//    3. 按时间匹配课表     → 得到「哪门课」
//    4. 查指纹去重         → 重复的就跳过
// ============================================================

import { readTakenAt } from './exif.js';
import { processPhoto, hamming } from './image.js';
import { matchSlot, dayKey, makeSessionKey } from './timetable.js';
import { allSlots, allPhotos, putPhoto } from './db.js';
import { newId } from './id.js';

/** 让浏览器有机会刷新界面，否则导入时进度条会卡住不动 */
const tick = () => new Promise((r) => setTimeout(r, 0));

export async function importFiles(files, config, { onProgress } = {}) {
  const slots = await allSlots();
  const existing = await allPhotos();

  // 按「天」建个索引，去重时只和同一天的照片比，快很多
  const byDay = new Map();
  for (const p of existing) {
    if (!byDay.has(p.day)) byDay.set(p.day, []);
    byDay.get(p.day).push(p);
  }

  const summary = {
    total: files.length,
    added: 0,
    duplicated: 0,
    unassigned: 0,
    failed: 0,
    // sessionKey -> { label, count }
    sessions: new Map(),
    errors: [],
  };

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.({ done: i, total: files.length, name: file.name });

    try {
      const takenAt = await readTakenAt(file);
      const day = dayKey(takenAt);
      const slot = matchSlot(takenAt, slots, config);

      const courseId = slot?.courseId ?? null;
      const courseName = slot?.courseName ?? null;

      const img = await processPhoto(file, config);

      // ---------- 去重：同一天 + 同一门课 里找相近的指纹 ----------
      const sameBucket = (byDay.get(day) || []).filter((p) => (p.courseId ?? null) === courseId);
      const duplicated = sameBucket.some(
        (p) => hamming(p.hash, img.hash) <= (config.dupThreshold ?? 5),
      );
      if (duplicated) {
        summary.duplicated += 1;
        continue;
      }

      const sessionKey = makeSessionKey(day, slot);
      const photo = {
        id: newId(),
        courseId,
        courseName,
        slotId: slot?.id ?? null,
        takenAt: takenAt.getTime(),
        day,
        sessionKey,
        width: img.width,
        height: img.height,
        hash: img.hash,
        bytes: img.blob.size,
        createdAt: Date.now(),
      };

      await putPhoto(photo, { full: img.blob, thumb: img.thumb });

      // 立刻记进索引，这样同一批里重复的照片也能被挡掉
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push(photo);

      summary.added += 1;
      if (!courseId) summary.unassigned += 1;

      const label = slot ? `${slot.courseName} · ${slot.start}-${slot.end}` : '待归类';
      const entry = summary.sessions.get(sessionKey) || { label, day, count: 0 };
      entry.count += 1;
      summary.sessions.set(sessionKey, entry);
    } catch (err) {
      summary.failed += 1;
      summary.errors.push(`${file.name}: ${err?.message || err}`);
    }

    // 每处理一张喘口气，界面才不会假死
    if (i % 3 === 0) await tick();
  }

  onProgress?.({ done: files.length, total: files.length, name: '' });
  return summary;
}
