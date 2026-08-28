# Architecture

`dsh-image-picker` 分两层：**host 壳**（服务端）与 **client**（浏览器），通过 `dsh.bundle` 注入到一个 web profile 的依赖栈里。

```
┌────────────── 浏览器 (client) ──────────────┐        ┌──────────── 服务端 (host 壳) ────────────┐
│ 📎 按钮 ──<input file multiple>             │        │  lib/index.js                             │
│   ├─ image/*  → DataTransfer + 合成 drop     │        │   ├─ GET  /dsh-image-picker/client.js     │
│   │            → 官方 ComposerAttachments     │        │   │     (no-store, 每次现读磁盘)           │
│   └─ 文本/docx → 读内容 → POST /store ───────┼───────►│   ├─ POST /dsh-image-picker/store          │
│                                             │        │   │     → 落盘 ~/.dsh/picker-attachments/   │
└─────────────────────────────────────────────┘        │   └─ tapIndex → 注入 <script defer>        │
                                                        └───────────────────────────────────────────┘
```

## host 壳（`lib/index.js`）

- `inject = ['webServer']` —— 依赖注入 dsh 的 `webServer` 上下文。
- **静态资源**：`GET /dsh-image-picker/client.js` 每次从磁盘现读、`no-store`，改完刷新页面即生效，无需重启。
- **落盘路由**：`POST /dsh-image-picker/store` 接收 `{ name, text }`，清洗文件名 + 加时间戳后写入 `~/.dsh/picker-attachments/`，返回绝对路径 + 字符数。25 MB 上限，超限 413。
- **HTML 注入**：`webServer.tapIndex` 幂等地在 `</body>` 前插入 `<script defer>`，whale-widget 同款挂载模式。
- **清理**：`ctx.effect` 在插件卸载时逐一 dispose 已注册的资源。

## client（`lib/client.js`）

- 免模块系统的自执行 IIFE，通过 `webServer` 路由交付，不依赖 `window.__ModuleLoader__`、无构建步骤。
- 图片走**官方附件管线**：合成 `DataTransfer` → 派发 `drop` 到 `[data-composer-card]`，由 `dsh-client-ui-attachment` 的 document 级监听接管——缩略图 rail、20 张 / 20 MB 上限、随消息上传全部复用，零自定义上传逻辑。
- 文本 / `.docx` 走暂存路径：浏览器用迷你 ZIP + `DecompressionStream("deflate-raw")` 提取正文后 `POST /store`，消息里只放「回执」。

## 为什么要两层

1. **官方管线图片专用**，非图文件会报「不支持类型」，文本类只能另开暂存通道。
2. **浏览器拿不到真实磁盘路径**——`File` 对象在纯前端没有绝对路径，拖拽路径也被安全策略隐藏。
3. **全文内联会撑爆上下文**——几万字直接进消息既浪费又易截断；服务端壳跑在 dsh web 进程里，有完整文件系统访问权，能真正落盘。
