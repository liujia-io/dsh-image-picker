# dsh-image-picker

DeepSeek Harness Web GUI 插件:在会话输入框左侧添加一个 📎 按钮,通过**系统文件选择器**添加附件。

- **图片**(png/jpeg/webp/gif)→ 合成 drop 注入**官方附件管线**:缩略图 rail、数量/大小校验、随消息上传
- **文本类**(`.txt` / `.md` / `.markdown` / `.docx`)→ 浏览器读出内容后 **POST 到本地服务端暂存**,消息里只插入一段极短的"回执"(保存路径 + 字符数 + 预览),正文不进会话上下文,agent 用普通读取工具按需取用

## 为什么这样设计

1. **官方管线是图片专用**——非图文件直接报"不支持类型"。文本类走不了上传路径。
2. **浏览器 File 对象拿不到真实磁盘路径**——"传路径让 agent 自己读"在纯前端走不通:拖拽路径会被浏览器安全策略隐藏,对话框也取不到绝对路径。
3. **全文内联会撑爆上下文**——几万字直接塞进消息既浪费又容易截断。

于是:脚本把选中文件的内容**暂存为 `~/.dsh/picker-attachments/` 下的本地文件**,消息里给出绝对路径 + 短预览。浏览器端无法偷懒绕过,但服务端 shell(host 插件)可以——它运行在 dsh web 进程里,有完整文件系统访问权。
`.docx` 在浏览器内用迷你 ZIP 解析 + `DecompressionStream("deflate-raw")` 提取正文后再暂存。

## 容量与安全护栏

| 护栏 | 说明 |
|---|---|
| 单文件暂存上限 | 25 MB(超出返回 413) |
| 文件名 | 自动清洗非法字符并加时间戳前缀,防路径遍历 |
| 暂存目录 | `~/.dsh/picker-attachments/` |
| 降级 | 若暂存接口不可用,自动回退为全文内联(单文件 3 万字符截断) |

## 工作原理

```
点击 📎 → <input type="file" multiple>
  ├─ image/*  → DataTransfer + 合成 drop → 官方 ComposerAttachments 接收
  └─ 文本/docx → 浏览器读出 → POST /dsh-image-picker/store
              → 落盘 ~/.dsh/picker-attachments/<time>-<name>
              → 插入"回执"(路径+字符数+120字预览)到输入框
```

投递通道:host 壳(`lib/index.js`)激活时注册
- `GET /dsh-image-picker/client.js` —— client 脚本,每次请求现读磁盘(改完刷新页面即生效)
- `POST /dsh-image-picker/store` —— 文本类附件落盘
- 并通过 `webServer.tapIndex` 注入 `<script defer>` 标签(whale-widget 同款模式)

client 端是免模块系统的自执行 IIFE,不对 `window.__ModuleLoader__` 有任何依赖。

## 安装(web profile)

```bash
dsh plugin --profile web add github:liujia-io/dsh-image-picker
# 重启 dsh web 生效
```

要求:仓库已声明 `dsh.bundle`;正在申请收录 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)(PR #3278)。

## 版本

- **1.2.0** — 文本/docx 改为"暂存为本地文件 + 回执",正文不进上下文;`/store` 落盘路由;文档类支持
- 1.1.0 — 文本与 docx 内容内联插入草稿;容量护栏;跳过清单
- 1.0.1 — 打包修复:真实的 `lib/index.js` host 入口 + `"."` 导出;client 改经 webServer 路由投递
- 1.0.0 — 📎 选图按钮(官方附件管线)
