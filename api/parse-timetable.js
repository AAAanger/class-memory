// Vercel 函数：部署后自动变成 POST /api/parse-timetable
// 环境变量在 Vercel 项目的 Settings → Environment Variables 里配。

import { handleParseRequest } from '../server/handler.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    res.status(405).json({ error: '只接受 POST' });
    return;
  }

  const result = await handleParseRequest(req.body, process.env);
  res.status(result.status).json(result.body);
}
