# 课堂记忆库

上课拍的板书，按课表自动分到各门课，期末按课程翻着复习。

不上传、不登录、不联网也能用 —— 照片只存在你自己的手机里。

---

## 现在能做什么

- **上传教务系统的课表截图，自动拆成「星期 + 节次 + 周次 + 教室」**，核对后一键导入
  （同一门课在不同周次换了时间，会拆成多条独立时段，各管各的周次）
- 录一次课表（课程名 / 星期几 / 几点到几点 / 第几周），也可以手动加
- 下课后从相册一次选中几十上百张照片导入
- 按**拍摄时间**自动判断属于哪节课，自动分好类
- 连拍同一块板书的会按指纹去重，只留一两张
- 照片压缩后存本地，一节课二三十张大概 3~6 MB
- 按「课程 → 哪一次课 → 那天的照片」三层翻
- 归错了可以手动改，能一键导出 zip 备份

## 还没做（下一步）

- 搜关键词、按意思搜图（要 OCR / 向量检索）
- 给每节课自动起标题、生成复习提纲（要接多模态模型）
- 多设备同步

---

## 三条命令

```bash
npm install     # 第一次用，装依赖
npm run dev     # 开发模式，改代码会自动刷新
npm run build   # 打包到 dist/，用来部署
npm test        # 跑归类算法的测试
```

详细步骤（包括怎么放到手机上用）见 **[使用说明.md](./使用说明.md)**。
想加 AI 见 **[docs/下一步-加AI.md](./docs/下一步-加AI.md)**。

---

## 文件地图

| 文件 | 管什么 |
|---|---|
| `src/config.js` | **所有能直接调的参数**：宽限时间、压缩质量、去重灵敏度、配色、默认作息表 |
| `src/lib/timetable.js` | **核心算法**：拍摄时间 → 哪门课；周次解析（含单双周） |
| `src/lib/periods.js` | 节次（第3-4节）→ 具体几点 |
| `src/lib/timetableImport.js` | **课表识别解析层**：校验、翻译、去重 |
| `src/lib/image.js` | 压缩、缩略图、去重指纹、转 base64 |
| `src/lib/exif.js` | 读照片的拍摄时间 |
| `src/lib/importer.js` | 板书照片导入流程 |
| `src/lib/db.js` | 本地数据库（IndexedDB）的读写 |
| `src/lib/backup.js` | 导出 zip |
| `server/vision.js` | 课表识别的提示词 + 调模型 |
| `server/handler.js` | 识别接口的校验与分发 |
| `api/parse-timetable.js` | Vercel 函数入口 |
| `src/views/ImportTimetable.jsx` | 上传截图 → 核对 → 导入 |
| `src/views/Library.jsx` | 相册页（三层浏览 + 大图 + 改归属） |
| `src/views/Import.jsx` | 板书照片导入页 |
| `src/views/Timetable.jsx` | 课表页（含作息表编辑） |
| `src/views/Settings.jsx` | 设置页 |
| `src/styles.css` | 全部样式，主色在 `--accent` |
| `public/manifest.webmanifest` | App 名字、图标、主题色 |
| `src/data/sample-timetable.js` | 示例课表（虚构，演示用；不需要可删） |
| `scripts/test-timetable.mjs` | 归类算法测试，26 条 |
| `scripts/test-timetable-import.mjs` | 课表解析测试，39 条 |
| `scripts/gen-qrcode.mjs` | 生成手机扫码用的二维码 |
| `scripts/gen-icons.py` | 重新生成图标 |

## 改完算法先跑测试

```bash
node scripts/test-timetable.mjs
```

改了 `timetable.js` 之后一定要跑一遍，这是唯一会「悄悄归类错」的地方。
