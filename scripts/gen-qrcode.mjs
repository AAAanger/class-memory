// 生成「手机扫一下就能打开」的二维码。
//
// 用法：
//   node scripts/gen-qrcode.mjs
//       自动找本机的局域网 IP，生成 http://<IP>:5173 的二维码
//
//   node scripts/gen-qrcode.mjs http://192.168.1.23:5173
//       指定地址
//
//   node scripts/gen-qrcode.mjs https://class-memory.pages.dev
//       部署之后用线上地址再生成一张
//
// 生成的文件：项目根目录下的「二维码.png」

import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '5173';

/** 挑出手机能连上的那个地址，顺便把虚拟网卡筛掉 */
function pickLanAddress() {
  const candidates = [];

  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const item of list || []) {
      if (item.family !== 'IPv4' || item.internal) continue;
      const ip = item.address;
      if (ip.startsWith('169.254.')) continue; // 没连上网时的自动地址
      if (ip.startsWith('192.168.56.')) continue; // VirtualBox 默认网段
      if (/^172\.(1[7-9]|2\d|3[01])\./.test(ip)) continue; // Docker
      candidates.push({ name, ip });
    }
  }

  // Wi-Fi 网卡优先，其次是第一个能用的
  const wifi = candidates.find((c) => /wlan|wi-?fi|无线/i.test(c.name));
  return { best: wifi || candidates[0] || null, candidates };
}

async function main() {
  const args = process.argv.slice(2);
  const given = args.find((a) => /^https?:\/\//i.test(a));
  const outName = args.find((a) => !/^https?:\/\//i.test(a));

  let url = given;
  let hint = '';

  if (!url) {
    const { best, candidates } = pickLanAddress();

    if (!best) {
      console.error('没找到局域网 IP。请手动指定地址，例如：');
      console.error('  node scripts/gen-qrcode.mjs http://192.168.1.23:5173');
      process.exit(1);
    }

    url = `http://${best.ip}:${PORT}`;

    if (candidates.length > 1) {
      hint = candidates.map((c) => `    ${c.name}: http://${c.ip}:${PORT}`).join('\n');
    }
  }

  const file = path.join(ROOT, outName || '二维码.png');

  await QRCode.toFile(file, url, {
    width: 720,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#0f172a', light: '#ffffff' },
  });

  console.log('');
  console.log('  二维码内容：' + url);
  console.log('  已保存到：  ' + file);
  if (hint) {
    console.log('');
    console.log('  本机其它网卡（如果上面那个连不上，换下面这些重跑）：');
    console.log(hint);
  }
  console.log('');

  // 顺手在终端也打一份，手机对着屏幕也能扫
  const ascii = await QRCode.toString(url, { type: 'terminal', small: true });
  console.log(ascii);
  console.log('  提示：手机要和电脑连同一个 WiFi，而且 npm run dev 必须正在跑。');
  console.log('');
}

main().catch((error) => {
  console.error('生成失败：' + (error?.message || error));
  process.exit(1);
});
