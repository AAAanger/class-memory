// ============================================================
//  图片处理：压缩 + 缩略图 + 指纹（用来判断是不是重复照片）
//  全部在手机本地完成，照片不会上传到任何服务器。
// ============================================================

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('图片编码失败'))),
      'image/jpeg',
      quality,
    );
  });
}

/** 把文件读成可以画到 canvas 上的位图（順便纠正手机照片的方向） */
export async function loadBitmap(blob) {
  if (typeof createImageBitmap === 'function') {
    // imageOrientation: 'from-image' 会按 EXIF 把照片转正
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch {
      /* 部分旧浏览器不认这个参数，往下走 */
    }
    try {
      return await createImageBitmap(blob);
    } catch {
      /* 继续降级 */
    }
  }

  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.src = url;
  await img.decode();
  // 解码完再延迟回收，避免个别浏览器把图也一起丢掉
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return img;
}

function sizeOf(src) {
  return { w: src.width || src.naturalWidth, h: src.height || src.naturalHeight };
}

function drawTo(canvas, src, w, h) {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  // 铺一层白底：JPEG 不支持透明，不铺的话透明区域会变黑
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(src, 0, 0, w, h);
  return ctx;
}

/** 8x8 灰度平均哈希，返回 64 个 '0'/'1' 字符 */
async function averageHash(sourceCanvas) {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 8;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(sourceCanvas, 0, 0, 8, 8);

  const { data } = ctx.getImageData(0, 0, 8, 8);
  const gray = [];
  for (let i = 0; i < data.length; i += 4) {
    gray.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }
  const avg = gray.reduce((a, b) => a + b, 0) / gray.length;
  return gray.map((g) => (g >= avg ? '1' : '0')).join('');
}

/** 两张图的指纹差多少位（0 = 完全一样，64 = 毫无关系） */
export function hamming(a, b) {
  if (!a || !b || a.length !== b.length) return 64;
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff += 1;
  return diff;
}

/**
 * 一张原始照片 → 存进数据库的三样东西
 *   blob   压缩后的大图（看板书用）
 *   thumb  小缩略图（列表用，省内存）
 *   hash   指纹（去重用）
 */
export async function processPhoto(file, options = {}) {
  const { maxEdge = 1280, quality = 0.75, thumbEdge = 360 } = options;

  const src = await loadBitmap(file);
  const { w: sw, h: sh } = sizeOf(src);
  if (!sw || !sh) throw new Error('无法读取图片尺寸');

  // 大图
  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));
  const fullCanvas = document.createElement('canvas');
  drawTo(fullCanvas, src, w, h);
  const blob = await canvasToBlob(fullCanvas, quality);

  // 缩略图
  const tScale = Math.min(1, thumbEdge / Math.max(sw, sh));
  const thumbCanvas = document.createElement('canvas');
  drawTo(thumbCanvas, src, Math.max(1, Math.round(sw * tScale)), Math.max(1, Math.round(sh * tScale)));
  const thumb = await canvasToBlob(thumbCanvas, 0.7);

  // 指纹
  const hash = await averageHash(thumbCanvas);

  if (typeof src.close === 'function') src.close();

  return { blob, thumb, width: w, height: h, hash };
}

/**
 * 压缩成 dataURL，用来发给模型识别。
 * 课表截图文字很密，别压太狠，1800px / 0.85 基本能保住小字。
 */
export async function compressToDataUrl(file, maxEdge = 1800, quality = 0.85) {
  const src = await loadBitmap(file);
  const { w: sw, h: sh } = sizeOf(src);
  if (!sw || !sh) throw new Error('无法读取图片尺寸');

  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  drawTo(canvas, src, Math.max(1, Math.round(sw * scale)), Math.max(1, Math.round(sh * scale)));
  const url = canvas.toDataURL('image/jpeg', quality);

  if (typeof src.close === 'function') src.close();
  return url;
}

