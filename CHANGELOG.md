# Changelog

本文件记录 `dsh-image-picker` 的版本演进。变更遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 约定。

## [1.2.0] - 2026-08-26

### Changed

- 文本 / `.md` / `.docx` 附件不再全文内联进草稿，改为「暂存为本地文件 + 回执」：浏览器读出内容后 `POST /dsh-image-picker/store` 落盘到 `~/.dsh/picker-attachments/`，消息里只插入极短回执（绝对路径 + 字符数 + 120 字预览），正文不进会话上下文，agent 用普通读取工具按需取用。

### Added

- `POST /dsh-image-picker/store` 落盘路由，包含文件名清洗、时间戳前缀与 25 MB 单文件上限。

## [1.1.0] - 2026-08-26

### Added

- 文本与 `.docx` 内容内联插入草稿（单文件 3 万字符截断）。
- 容量护栏：单文件暂存上限、文件名非法字符清洗、暂存目录可降级回退。

## [1.0.1] - 2026-08-26

### Changed

- 打包修复：改用真实的 `lib/index.js` host 入口和 `"."` 导出；client 改经 `webServer` 路由（`/dsh-image-picker/client.js`）+ `tapIndex` 注入投递，取代原先不可物化的 boot id。

## [1.0.0] - 2026-08-26

### Added

- 📎 选图按钮：通过系统文件选择器选取参考图，合成 `drop` 事件注入官方附件管线（缩略图 rail、数量/大小校验、随消息上传），绕开拖拽环境问题。
