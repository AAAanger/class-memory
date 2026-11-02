# 下一步：给每节课自动起标题

现在这一版**一个 AI 都没用**，全靠「课表 + 拍摄时间」算出归属。这是故意的：
它免费、离线、可解释，而且准确率比你去调一个图像分类模型高得多。

真正值得加 AI 的地方只有一个：

> 一节课结束，把那天最关键的两三张板书发给一个「多模态模型」，
> 让它回一个标题 + 三个关键词，显示在时间轴上。

加完之后，复习时看到的不再是「11月4日 · 32张」，而是「**§3.2 洛必达法则**」，找起来快得多。

一次课只调 **1 次**，一学期一百来次课，成本大概几块钱。

---

## 一、为什么必须有个"后端"

API Key 绝对不能写在前端代码里 —— 任何人打开开发者工具都能看到，然后拿去刷你的额度。

所以需要一个只有几十行的中间层：

```
手机上的网页  →  你的小函数（拿着 Key）  →  模型服务
```

这个小函数可以放在 Vercel / Cloudflare，免费额度就够。

---

## 二、准备一个 API Key

国内能直接用的几个（选一个就行，都是 OpenAI 兼容格式，下面代码通用）：

| 服务 | 地址 | 说明 |
|---|---|---|
| 阿里云百炼（通义千问 VL） | https://dashscope.console.aliyun.com | 有免费额度，中文好，推荐先试这个 |
| 智谱（GLM-4V） | https://open.bigmodel.cn | 也便宜 |
| 火山方舟（豆包视觉） | https://console.volcengine.com/ark | 便宜 |
| OpenAI（GPT-4o） | https://platform.openai.com | 效果最好，但要外币卡 |

拿到 Key 之后**不要**写进任何前端文件，先放在一边。

> 具体的模型名、接口地址以各家官网当前文档为准，这里不写死。

---

## 三、写后端小函数

在项目根目录新建文件夹 `api`，里面放 `title.js`：

```
class-memory/
  api/
    title.js      ← 新建
  src/
  ...
```

`api/title.js` 的内容：

```js
// 放在 Vercel 上时，这个文件会自动变成一个接口：POST /api/title
// 密钥从环境变量读，永远不会出现在前端代码里。

const BASE_URL = process.env.AI_BASE_URL;   // 例如 https://dashscope.aliyuncs.com/compatible-mode/v1
const API_KEY = process.env.AI_API_KEY;
const MODEL = process.env.AI_MODEL;         // 例如 qwen-vl-max

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只接受 POST' });
  }

  const { images } = req.body || {};
  if (!Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: '没有图片' });
  }
  // 最多 4 张，防止有人传一堆把额度刷爆
  const picked = images.slice(0, 4);

  const prompt =
    '下面是同一节课上连续拍下的黑板/投影照片，按时间顺序。\n' +
    '请用中文返回一个 JSON，不要有任何多余文字：\n' +
    '{"title":"这节课讲了什么，20字以内，像课本小标题那样",' +
    '"keywords":["3个关键词"],"summary":"一句话概括，40字以内"}\n' +
    '如果照片里没有可读的板书（比如拍到人、糊了），title 返回空字符串。';

  try {
    const upstream = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              ...picked.map((url) => ({ type: 'image_url', image_url: { url } })),
            ],
          },
        ],
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      return res.status(502).json({ error: '模型服务返回错误', detail: detail.slice(0, 300) });
    }

    const data = await upstream.json();
    const text = data?.choices?.[0]?.message?.content || '';

    // 模型有时会包一层 ```json，剥掉
    const cleaned = String(text).replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return res.status(200).json({
      title: String(parsed.title || '').slice(0, 30),
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 5) : [],
      summary: String(parsed.summary || '').slice(0, 60),
    });
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
```

**配置环境变量**（在 Vercel 项目里）：`Settings → Environment Variables`，加三个：

| 名字 | 值 |
|---|---|
| `AI_BASE_URL` | 你选的那家的 OpenAI 兼容地址 |
| `AI_API_KEY` | 你的 Key |
| `AI_MODEL` | 模型名 |

改完要 **Redeploy 一次**才生效。

---

## 四、前端怎么调

新建 `src/lib/ai.js`：

```js
import { getAsset } from './db.js';

/** Blob -> data URL（模型接口要这种格式） */
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * 给一节课的照片要一个标题。
 * 传进来的是这一节课的 photo 数组，内部只取前 3 张的缩略图，省流量。
 */
export async function requestSessionTitle(photos, endpoint = '/api/title') {
  const picked = photos.slice(0, 3);
  const dataUrls = [];
  for (const p of picked) {
    const asset = await getAsset(p.id);
    if (asset?.thumb) dataUrls.push(await blobToDataUrl(asset.thumb));
  }
  if (!dataUrls.length) throw new Error('没有可用的缩略图');

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images: dataUrls }),
  });
  if (!res.ok) throw new Error(`AI 接口失败：${res.status}`);
  return res.json(); // { title, keywords, summary }
}
```

用缩略图（360px）而不是原图，是有意的：令牌少、传得快，模型认标题够用了。

---

## 五、标题存哪

现在数据库里有 5 张表，加第 6 张 `sessionMeta`，按「哪节课」存：

打开 `src/lib/db.js`，把版本号从 1 改成 2，并在 `upgrade` 里加一段：

```js
const DB_VERSION = 2;   // ← 原来是 1

// upgrade(db) { ... } 里面追加：
if (!db.objectStoreNames.contains('sessionMeta')) {
  db.createObjectStore('sessionMeta', { keyPath: 'sessionKey' });
}
```

再加两个读写函数：

```js
export async function getSessionMeta(sessionKey) {
  return (await dbPromise).get('sessionMeta', sessionKey);
}

export async function putSessionMeta(meta) {
  await (await dbPromise).put('sessionMeta', meta);
}
```

> 注意：版本号一改，旧数据不会丢，浏览器会自动跑一次 upgrade，只是多建一张空表。

---

## 六、接到界面上

在「相册」页第二层（某门课的那次课列表）里，每行加一个按钮：

```jsx
<button
  type="button"
  className="mini"
  onClick={async () => {
    try {
      const result = await requestSessionTitle(s.items, ENDPOINT);
      if (result.title) {
        await putSessionMeta({ sessionKey: s.key, ...result, at: Date.now() });
        onChanged();   // 触发重新加载
      }
    } catch (e) {
      alert(`起标题失败：${e.message}`);
    }
  }}
>
  起标题
</button>
```

然后在 `Library.jsx` 里把 `sessionMeta` 一并读出来，行标题就显示 `meta.title || 日期`。

**关键设计**：这是用户**主动点**的，不是自动跑。这样：

- 不想要 AI 的人完全不受影响
- 失败不会打断导入流程
- 你调试的时候只花一次钱

---

## 七、成本大概多少

一节课 3 张 360px 缩略图 + 一段提示词，大概 1000~3000 个输入令牌，输出几十个。

按国内视觉模型的价格，一节节课大约 **1 分钱到 3 分钱**。一学期 100 次课，**1~3 块钱**。

如果嫌贵，只对「照片超过 10 张」的课触发，或者一周批量跑一次。

---

## 八、更进一步的第二步：文字识别 + 搜索

「起标题」解决的是「一眼看出来这是啥」。「搜关键词」需要真的把字认出来。

两条路：

**A. 直接用同一个多模态模型做 OCR**（最省事）

把提示词改成「把这张板书上的文字按行输出，公式用 LaTeX」，一次调用同时拿到文字和标题。
缺点：手写板书认错率不低，而且每张都要调一次，比只取 3 张贵。

**B. 上专门的 OCR**（更稳）

- 自托管 [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR)，中文识别好，免费，但要一台服务器跑
- 或者买云厂商的「手写体 OCR」接口

拿到文字之后：

1. 存到 `photos` 表加个 `text` 字段
2. 相册页加个搜索框，在 `photos` 里 `text.includes(关键词)` 过滤
3. 照片上千张之后再考虑上向量检索（pgvector / sqlite-vec），一般学生一学期的量用不上

**重要提醒**：板书手写的识别率现实值大概 60~85%。所以搜索只能是**辅助**，主路径永远是「课程 → 时间 → 翻图」。别把产品押在 OCR 上。

---

## 九、加 AI 之前先想清楚的一件事

这些照片会**离开你的手机**，发到模型提供方。

- 别拍同学的正脸（真要拍就打个码，或者别用这功能）
- 有些老师明确不希望课堂内容外传，先问一句
- 同学一起用的话，告诉他们这个功能会把图发出去

不想发就别加。现在这一版是完全离线的，一样能用。
