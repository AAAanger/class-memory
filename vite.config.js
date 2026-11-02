import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { handleParseRequest } from './server/handler.js';

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

/**
 * 开发时也提供一个 /api/parse-timetable 接口，
 * 这样 npm run dev 就能直接测课表识别，不用先部署。
 * Key 从 .env.local 读，不会打进前端包。
 */
function timetableApiPlugin(env) {
  return {
    name: 'timetable-api',
    configureServer(server) {
      server.middlewares.use('/api/parse-timetable', async (req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');

        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: '只接受 POST' }));
          return;
        }

        try {
          const payload = await readJsonBody(req);
          const result = await handleParseRequest(payload, env);
          res.statusCode = result.status;
          res.end(JSON.stringify(result.body));
        } catch (error) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(error?.message || error) }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // 第三个参数传 '' 表示把 .env 里所有变量都读进来（不只是 VITE_ 开头的）
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), timetableApiPlugin(env)],
    // 用相对路径打包，这样把 dist 丢到任何静态托管（含子目录）都能跑
    base: './',
    server: {
      // 手机和电脑连同一个 WiFi，就能用局域网地址打开
      host: true,
      port: 5173,
      // 端口被占就直接报错，不要偷偷换到 5174/5175。
      // 因为二维码里写死的是 5173，端口一漂，码就失效了。
      strictPort: true,
    },
  };
});
