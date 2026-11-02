// ============================================================
//  调多模态模型识别课表截图
//  只在服务端运行（Vite 开发中间件 / Vercel 函数），
//  Key 永远不会出现在前端代码里。
// ============================================================

export const TIMETABLE_PROMPT = `你是一个课程表识别器。输入是大学教务系统导出的课程表截图，可能有多张。

图片结构：
- 最上面一行是表头：星期一、星期二 … 星期日
- 最左边一列是节次分组：一、二、三…，依次对应 第1-2节、第3-4节、第5-6节、第7-8节、第9-10节、第11-12节；表格左边还标着「上午 / 下午 / 晚上」
- 一个格子里可能有 0 到多门课。一门课通常占四行：
    课程名
    教师名
    周次[节次]          例如 1-4,6-12,14,17[1-2]
    教室
- 一格里有多门课时，首尾相接继续往下排

任务：把每一门课都读成一条记录。

只输出 JSON，不要任何解释、不要 markdown 代码块、不要前后文字：
{"entries":[{"course":"课程名","teacher":"教师","weekday":1,"periods":[1,2],"weeks":"1-4,6-12,14,17","room":"教室"}],"periods":[{"label":"第 1-2 节","no":[1,2],"start":"08:20","end":"09:50"}]}

字段规则：
- weekday：1=周一 … 7=周日
- periods：节次编号的数组。图上写 [3-4] 就输出 [3,4]，写 [5-6] 就输出 [5,6]
- weeks：原样保留图上的写法，包括「1-16 单」这种
- room：原样抄写，下划线不用改
- 一个格子里有几门课就输出几条
- 空格子不输出任何记录
- 如果图上另外还有一张「作息时间表」（写着第几节几点到几点），把节次和时间填进 periods 数组，没有就输出空数组 []

特别注意：同一个课程名可能因为周次不同而出现在多个格子里
（例如「数据结构与算法分析」第 1-2 周在周一第 3-4 节，第 5-12、14 周在周五第 5-6 节）。
这是正常的，每条都要单独输出，绝对不要合并成一条。`;

/** 从模型输出里抠出 JSON（它经常包一层 ```json） */
export function extractJson(text) {
  const raw = String(text ?? '').trim();
  if (!raw) throw new Error('模型返回了空内容');

  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`模型没有返回 JSON：${raw.slice(0, 160)}`);
  }

  const body = raw.slice(start, end + 1);
  try {
    return JSON.parse(body);
  } catch {
    // 常见的最后一种情况：末尾多了逗号
    try {
      return JSON.parse(body.replace(/,\s*([}\]])/g, '$1'));
    } catch {
      throw new Error(`模型返回的 JSON 解析失败：${body.slice(0, 160)}`);
    }
  }
}

/**
 * @param {{images: string[], apiKey: string, baseUrl: string, model: string, timeoutMs?: number}} options
 */
export async function callVisionModel({ images, apiKey, baseUrl, model, timeoutMs = 90000 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${String(baseUrl).replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: TIMETABLE_PROMPT },
              ...images.map((url) => ({ type: 'image_url', image_url: { url } })),
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`模型服务返回 ${response.status}：${detail.slice(0, 300)}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    // 有的服务会把 content 返回成数组
    const text = Array.isArray(content)
      ? content.map((part) => part?.text || '').join('')
      : String(content ?? '');

    return extractJson(text);
  } finally {
    clearTimeout(timer);
  }
}
