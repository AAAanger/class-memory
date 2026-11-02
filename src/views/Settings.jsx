import { useEffect, useState } from 'react';
import { allPhotos, clearAllData, storageUsage } from '../lib/db.js';
import { buildBackupZip, downloadBlob, defaultBackupName } from '../lib/backup.js';
import { formatBytes } from '../lib/id.js';

export default function Settings({ config, updateConfig, onChanged }) {
  const [count, setCount] = useState(0);
  const [bytes, setBytes] = useState(0);
  const [usage, setUsage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportPercent, setExportPercent] = useState(0);
  const [confirmClear, setConfirmClear] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    (async () => {
      const photos = await allPhotos();
      setCount(photos.length);
      setBytes(photos.reduce((sum, p) => sum + (p.bytes || 0), 0));
      setUsage(await storageUsage());
    })();
  }, []);

  async function handleExport() {
    setExporting(true);
    setExportPercent(0);
    setMessage('');
    try {
      const blob = await buildBackupZip(setExportPercent);
      downloadBlob(blob, defaultBackupName());
      setMessage(`已导出 ${formatBytes(blob.size)}，去手机的下载目录里找找。`);
    } catch (e) {
      setMessage(`导出失败：${e?.message || e}`);
    } finally {
      setExporting(false);
    }
  }

  async function handleClear() {
    await clearAllData();
    setConfirmClear(false);
    setCount(0);
    setBytes(0);
    setUsage(0);
    setMessage('已清空全部数据。');
    onChanged?.();
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>设置</h1>
        <p className="page-sub">照片只存在这台手机里，不会上传</p>
      </header>

      <section className="card">
        <h2 className="card-title">存储</h2>
        <div className="kv">
          <span>照片数量</span>
          <strong>{count} 张</strong>
        </div>
        <div className="kv">
          <span>照片占用</span>
          <strong>{formatBytes(bytes)}</strong>
        </div>
        <div className="kv">
          <span>浏览器总占用</span>
          <strong>{formatBytes(usage)}</strong>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={handleExport}
          disabled={exporting || !count}
        >
          {exporting ? `正在打包… ${exportPercent}%` : '导出备份（zip）'}
        </button>
        <p className="hint">
          导出来的是压缩包，里面有按课程分好文件夹的照片和一份数据.json。
          手机浏览器有被系统清理存储的可能，期末前导一次比较稳。
        </p>
      </section>

      <section className="card">
        <h2 className="card-title">压缩</h2>

        <label className="field">
          <span>图片长边</span>
          <select
            className="input"
            value={config.maxEdge}
            onChange={(e) => updateConfig({ maxEdge: Number(e.target.value) })}
          >
            <option value={1024}>1024 px（省空间）</option>
            <option value={1280}>1280 px（推荐）</option>
            <option value={1600}>1600 px（更清楚）</option>
            <option value={2048}>2048 px（占地方）</option>
          </select>
        </label>

        <label className="field">
          <span>JPEG 质量</span>
          <select
            className="input"
            value={config.quality}
            onChange={(e) => updateConfig({ quality: Number(e.target.value) })}
          >
            <option value={0.6}>0.6（省空间）</option>
            <option value={0.75}>0.75（推荐）</option>
            <option value={0.85}>0.85（更清楚）</option>
          </select>
        </label>
        <p className="hint">改完只影响之后导入的照片，已经存好的不会重压。</p>
      </section>

      <section className="card">
        <h2 className="card-title">归类规则</h2>

        <div className="row">
          <label className="field">
            <span>课前宽限（分钟）</span>
            <input
              type="number"
              className="input"
              min={0}
              max={120}
              value={config.beforeBufferMin}
              onChange={(e) => updateConfig({ beforeBufferMin: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span>课后宽限（分钟）</span>
            <input
              type="number"
              className="input"
              min={0}
              max={240}
              value={config.afterBufferMin}
              onChange={(e) => updateConfig({ afterBufferMin: Number(e.target.value) })}
            />
          </label>
        </div>

        <label className="field">
          <span>去重灵敏度：{config.dupThreshold}</span>
          <input
            type="range"
            min={0}
            max={16}
            step={1}
            value={config.dupThreshold}
            onChange={(e) => updateConfig({ dupThreshold: Number(e.target.value) })}
          />
        </label>
        <p className="hint">
          数字越小越严格。0 只去掉几乎一样的，10 以上会把相似的整体板书也当重复删掉。
          默认 5 适合连拍同一块板。
        </p>
      </section>

      <section className="card">
        <h2 className="card-title">危险操作</h2>
        {confirmClear ? (
          <>
            <p className="error">这会删掉所有照片和课表，且不能撤销。</p>
            <div className="row">
              <button type="button" className="btn btn-danger" onClick={handleClear}>
                确认清空
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmClear(false)}>
                取消
              </button>
            </div>
          </>
        ) : (
          <button type="button" className="btn btn-ghost btn-block" onClick={() => setConfirmClear(true)}>
            清空全部数据
          </button>
        )}
      </section>

      {message && <div className="banner banner-info">{message}</div>}

      <section className="card card-plain">
        <h2 className="card-title">下一步可以加的 AI</h2>
        <p className="hint">
          现在这一版完全不用网络也算得出来：靠的是课表 + 拍摄时间。
          等用顺了，可以再加一步 —— 每节课结束后，把那几张贴图发给一个多模态模型，
          让它返回「这节课的标题 + 3 个关键词」，显示在时间轴上。
          一次课只调 1 次，成本几乎为零。具体怎么接，看项目里的 docs/下一步-加AI.md。
        </p>
      </section>

      <p className="footnote">课堂记忆库 v0.1 · 数据在你自己手机里</p>
    </div>
  );
}
