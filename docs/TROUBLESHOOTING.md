# Troubleshooting — 常见问题排查

## 1. 点了 📎 没有反应 / 选图后附件不出现

- 检查浏览器控制台有无报错；确认 `lib/client.js` 已被注入。
- 确认 host 壳已激活：`GET /dsh-image-picker/client.js` 应返回脚本内容，而不是 404。
- 若 404：插件没被加载到当前 profile，或 `webServer` 路由未注册。重新 `dsh plugin --profile web add` 并重启。

## 2. Windows 上「拖拽图片进浏览器」失败

这是本项目要绕开的原始问题，常见的三个根因：

| 根因 | 现象 | 说明 |
|---|---|---|
| **UIPI 完整性级别不匹配** | 拖拽提示被拦 / 光标变禁止 | 浏览器进程与桌面之间的完整性级别不同，OS 屏蔽拖放消息。 |
| **云盘占位文件** | 拖进去是 0 字节 / 打不开或不完整 | 文件尚未物化（OneDrive/坚果云等按需下载占位）。 |
| **嵌入 webview** | 无系统文件框、拖放不响应 | 宿主是 WebView2 / Electron 等嵌入式容器，拖放通道被截断。 |

解决：用 📎 按钮走**系统文件选择器**，不依赖拖放，三者在文件框路径下均绕开。

## 3. 文本 / `.docx` 附件消息里只有一行「回执」

这是 1.2.0 起的设计——正文被暂存到本地，用普通读取工具按路径取用即可。若你期待正文内联，卸载后安装 1.1.0，或自行关掉暂存降级。

## 4. `/store` 返回 413

单文件超过 25 MB 上限。把文件拆小，或改用官方图片管线（图片受 20 张 / 20 MB 的总量限制）。

## 5. 改了 `lib/client.js` 刷新不见效

1. 确认 host 壳运行在**改动所在的包**（本地链接而非 `node_modules` 里的旧拷贝）。
2. client 路由设了 `Cache-Control: no-store`，理论上每次都现读磁盘；若仍旧，强制刷新（Ctrl+F5）清掉 HTML 里的 `<script>` 缓存。

## 6. 装机后市场里找不到

正在收录 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)（PR 详见 README）。合并前只能 `dsh plugin --profile web add github:liujia-io/dsh-image-picker` 手动安装。
