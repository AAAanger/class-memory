// ============================================================
//  备份导出：把照片 + 课表打包成一个 zip 下载下来
//  手机浏览器有被清存储的风险，建议期末前导一次。
// ============================================================

import JSZip from 'jszip';
import { allPhotos, allCourses, allSlots, getAsset } from './db.js';
import { dayKey } from './timetable.js';

function safeName(s) {
  return String(s || '未命名').replace(/[\\/:*?"<>|]/g, '_').trim() || '未命名';
}

export async function buildBackupZip(onProgress) {
  const [photos, courses, slots] = await Promise.all([allPhotos(), allCourses(), allSlots()]);
  const zip = new JSZip();

  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    const asset = await getAsset(p.id);
    if (asset?.full) {
      const folder = safeName(p.courseName || '待归类');
      const name = `${p.day}_${p.id.slice(0, 8)}.jpg`;
      zip.file(`照片/${folder}/${name}`, asset.full);
    }
    if (photos.length) onProgress?.(Math.round(((i + 1) / photos.length) * 80));
  }

  zip.file(
    '数据.json',
    JSON.stringify(
      { format: 'class-memory/1', exportedAt: new Date().toISOString(), courses, slots, photos },
      null,
      2,
    ),
  );

  // 照片本身已经是压缩过的 JPEG，再压一遍没意义，用 STORE 快很多
  return zip.generateAsync({ type: 'blob', compression: 'STORE' }, (meta) =>
    onProgress?.(80 + Math.round((meta.percent || 0) * 0.2)),
  );
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function defaultBackupName() {
  return `课堂记忆库备份_${dayKey(new Date())}.zip`;
}
