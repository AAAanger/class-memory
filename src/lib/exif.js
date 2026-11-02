// ============================================================
//  读照片的「拍摄时间」
//  优先用 EXIF 里记录的快门时间（最准），读不到就退回文件修改时间。
// ============================================================

import exifr from 'exifr';

export async function readTakenAt(file) {
  try {
    const meta = await exifr.parse(file, [
      'DateTimeOriginal',
      'CreateDate',
      'DateTimeDigitized',
      'ModifyDate',
    ]);
    const raw = meta?.DateTimeOriginal || meta?.CreateDate || meta?.DateTimeDigitized;
    if (raw) {
      const d = raw instanceof Date ? raw : new Date(raw);
      if (!Number.isNaN(d.getTime())) return d;
    }
  } catch {
    // HEIC、截图、被转码过的图常常没有 EXIF，走下面的兜底
  }

  if (file.lastModified) return new Date(file.lastModified);
  return new Date();
}
