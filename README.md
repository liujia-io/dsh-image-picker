# dsh-image-picker

DeepSeek Harness Web GUI 插件:在会话输入框左侧添加一个 📎 按钮,通过**系统文件选择器**选择图片并注入官方附件管线。

## 为什么需要它

官方附件链路(`dsh-client-ui-attachment`)支持拖拽与粘贴,但在部分 Windows 环境下,从资源管理器/云盘客户端拖文件进浏览器会静默失败(常见根因:浏览器以管理员身份运行而资源管理器不是,UIPI 完整性级别不一致;云盘占位文件;嵌入式 webview)。文件选择器对话框不经过任何拖拽通道,不受这些环境问题影响。

## 工作原理

```
点击 📎 → <input type="file" accept="image/*" multiple>
       → 构造 DataTransfer(含 Files)
       → 在 [data-composer-card] 派发合成 dragenter/dragover/drop
       → 官方 ComposerAttachments 的 document 级监听器接收
       → onAddImages → intakeImages(数量/大小校验)→ 缩略图 rail
       → 随消息一起上传
```

完全复用官方管线,无自建上传逻辑。

## 安装(web profile)

```bash
# 1. 放置或克隆本包,然后在 profile 目录:
cd ~/.dsh/profiles/web
pnpm add file:H:/dw/dsh-image-picker   # 或 git 仓库地址

# 2. 编辑 ~/.dsh/profiles/web/package.json,在 dsh.profile.bundles 数组加入 "dsh-image-picker"

# 3. 重启 dsh web
```

重启前想立即生效:把一段临时 shim 追加进任一已加载插件的 client.js(如 dsh-cost-meter)。注意模块系统按启动清单物化插件,追加的独立 `load()` 调用不会被执行——shim 必须用**纯 DOM 注入**(MutationObserver 找 `[data-composer-card]`,把按钮插到原生"+"按钮旁),不能走插槽 API。代码带 `.dip-btn` 存在性检查与 `window.__DSH_IMAGE_PICKER__` 门控,与正式包并存时只渲染一个按钮;下次重启后删除该 shim 段即可。

## 临时 shim 状态

2026-08-24 已将 v3 DOM 注入 shim 追加到 `~/.dsh/profiles/web/node_modules/dsh-cost-meter/lib/client.js` 尾部(标记:`/* ==== dsh-image-picker TEMPORARY SHIM (v3)`),当前无需重启即可使用。服务器下次重启后本插件正式生效,届时可删除该 shim 段。

## 字段

- 插槽:`conversation.input.left`(输入卡片左下角,"+"按钮旁)
- 接受类型:image/png、image/jpeg、image/webp、image/gif
