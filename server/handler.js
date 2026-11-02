// ============================================================
//  识别接口的统一处理逻辑
//  两个地方共用它：
//    1. Vite 开发中间件（npm run dev 时就有 /api/parse-timetable）
//    2. api/parse-timetable.js（部署到 Vercel 用）
// ============================================================

import { callVisionModel } from './vision.js';

const MAX_IMAGES = 4;

export async function handleParseRequest(payload, env = {}) {
  const apiKey = env.AI_API_KEY || env.OPENAI_API_KEY || '';
  const baseUrl = env.AI_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
  const model = env.AI_MODEL || 'qwen-vl-max';

  const images = Array.isArray(payload?.images) ? payload.images : [];
  if (!images.length) {
    return { status: 400, body: { code: 'NO_IMAGE', error: '没有收到图片' } };
  }
  if (images.length > MAX_IMAGES) {
    return {
      status: 400,
      body: { code: 'TOO_MANY_IMAGES', error: `一次最多 ${MAX_IMAGES} 张，建议按内容拆成几次识别` },
    };
  }
  for (const url of images) {
    if (typeof url !== 'string' || !url.startsWith('data:image/')) {
      return { status: 400, body: { code: 'BAD_IMAGE', error: '图片格式不对，需要 data:image/... 的 dataURL' } };
    }
  }

  // 演示模式：不花钱、不联网，直接吐一份内置课表，方便先把界面流程跑通
  if (env.TIMETABLE_MOCK === '1') {
    const { SAMPLE_TIMETABLE } = await import('../src/data/sample-timetable.js');
    return { status: 200, body: { ok: true, mock: true, data: SAMPLE_TIMETABLE } };
  }

  if (!apiKey) {
    return {
      status: 503,
      body: {
        code: 'NO_API_KEY',
        error: '服务端还没有配置模型 Key',
        hint: '在项目根目录建一个 .env.local，写上 AI_API_KEY=你的Key，然后重启 npm run dev。详见 docs/识别课表截图.md',
      },
    };
  }

  try {
    const data = await callVisionModel({ images, apiKey, baseUrl, model });
    return { status: 200, body: { ok: true, data } };
  } catch (error) {
    return {
      status: 502,
      body: { code: 'UPSTREAM', error: String(error?.message || error) },
    };
  }
}
