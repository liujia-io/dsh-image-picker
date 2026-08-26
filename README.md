# dsh-image-picker

DeepSeek Harness Web GUI 插件:在会话输入框左侧添加一个 📎 按钮,通过**系统文件选择器**添加附件。

- 图片(png/jpeg/webp/gif)→ 合成 drop 注入**官方附件管线**:缩略图 rail、数量/大小校验、随消息上传
- `.txt` / `.md` / `.markdown` → 浏览器内读取内容,以附件块形式插入草稿,agent 原生处理
- `.docx` → 浏览器内迷你 ZIP 解析 + `DecompressionStream("deflate-raw")` 提取 `word/document.xml` 正文(支持中文、实体解码、段落保留),同样插入草稿

## 为什么需要它

官方附件链路(`dsh-client-ui-attachment`)支持拖拽与粘贴,但在部分 Windows 环境下,从资源管理器/云盘客户端拖文件进浏览器会静默失败(常见根因:浏览器以管理员身份运行而资源管理器不是,UIPI 完整性级别不一致;云盘占位文件;嵌入式 webview)。文件选择器对话框不经过任何拖拽通道,不受这些环境问题影响。而官方管线本身是图片专用的,文本类文件改走"内容内联":浏览器读出文本包上定界标记插入输入框,agent 随消息原生处理。

## 容量护栏

| 护栏 | 默认值 |
|---|---|
| 单文件截断 | 30,000 字符 |
| 批量总量 | 60,000 字符(超出的文件列入"未处理"清单)|

超出部分自动截断并标注原长度;不支持的类型会计入"未处理"清单而不会静默丢弃。

## 工作原理

```
点击 📎 → <input type="file" multiple>
  ├─ image/*        → DataTransfer + 合成 drop → 官方 ComposerAttachments 接收
  └─ 文本/docx      → File.text() / 内置 docx 解压器
                    → React 安全的 value setter 写入 textarea
```

投递通道:host 壳(`lib/index.js`)激活时注册 `/dsh-image-picker/client.js` 静态路由,
并通过 `webServer.tapIndex` 向页面注入 `<script defer>` 标签(whale-widget 同款模式);
client 端是免模块系统的自执行 IIFE。

## 安装(web profile)

```bash
dsh plugin --profile web add github:liujia-io/dsh-image-picker
# 重启 dsh web 生效
```

要求:仓库已声明 `dsh.bundle`;正在申请收录 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)(PR #3278)。

## 版本

- **1.1.0** — 文本与 docx 内容内联;容量护栏;跳过清单
- 1.0.1 — 打包修复:真实的 `lib/index.js` host 入口 + `"."` 导出;client 改经 webServer 路由投递
- 1.0.0 — 📎 选图按钮(官方附件管线)
