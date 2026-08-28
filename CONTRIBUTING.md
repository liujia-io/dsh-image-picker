# Contributing

欢迎为 `dsh-image-picker` 提交改进。这是一个走 `dsh.bundle` 的 DSH web 插件，改动都很小，前提是你能在本地跑起 dsh web 验证。

## 开发环境

```bash
git clone https://github.com/liujia-io/dsh-image-picker.git
cd dsh-image-picker
```

插件本身没有构建步骤（client 是免模块系统的自执行 IIFE），所以改完只需要：

1. 以本地链接方式把它挂进你的 dsh web profile（`dsh plugin --profile web add <本地路径>`）。
2. 重启 dsh web。
3. 刷新页面即可看到最新 client（`lib/client.js` 每次请求现读磁盘，不缓存）。

## 改动范围

- **host 壳**：`lib/index.js` —— 路由注册、HTML 注入、落盘逻辑。
- **client**：`lib/client.js` —— 选图按钮、文件读取、`/store` 调用。
- **文档**：`README.md`、`CHANGELOG.md`、`docs/`。

改动时请保持现有风格：中文注释 + 关键技术点英文名词、每处职责写明「为什么」。

## 提交规范

- 一次一个关注点，让 `CHANGELOG.md` 能对上号。
- 前缀建议：`feat` / `fix` / `docs` / `chore`。
- 修改行为时在 `CHANGELOG.md` 补一条对应版本记。

## 行为护栏（改前先想清楚）

| 关注点 | 说明 |
|---|---|
| 路径安全 | 文件名必须清洗非法字符并加时间戳前缀，防路径遍历。 |
| 上下文占用 | 文本类附件走「暂存 + 回执」，别把全文怼进消息。 |
| 兼容 | 不依赖 `window.__ModuleLoader__` 之外的构建/运行时特性。 |

## License

MIT。提交即表示同意以 MIT 许可发布你的改动。
