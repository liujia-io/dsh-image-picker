# 上户口操作手册(全程约 5 分钟点击 + 1 天等待)

## 前置条件(一次性)

这台机器没有 GitHub 登录凭证,所以"创建仓库/推送/发 PR"需要你在浏览器里完成。
推送那一步如果你想让我代劳:在 GitHub 创建 Personal Access Token(classic,勾 `repo` 权限)发我,
我用它推完即弃;或者你自己在本机跑两条 git 命令也行。

## 第 1 步:创建 GitHub 仓库(浏览器)

1. 打开 https://github.com/new
2. Repository name:`dsh-image-picker`
3. 选 Public,不要勾任何初始化选项(README/.gitignore/license 都不勾——我们本地已有)
4. 点 Create repository

## 第 2 步:设置仓库 topics(浏览器)

仓库页右侧 About 齿轮 → Topics 输入 `dsh-plugin` 回车保存。
(投稿硬性要求;顺便可加 `deepseek-harness`、`image`)

## 第 3 步:推送代码

方案 A(你推):在本机执行

```bash
cd H:\dw\dsh-image-picker
git remote add origin https://github.com/<你的GitHub用户名>/dsh-image-picker.git
git push -u origin master
```

(推的时候弹 GitHub 登录窗,授权即可)

方案 B(我推):把 PAT 发我,我来执行并立刻删除 token 记录。

## 第 4 步:让仓库满足收录门槛

规则:仓库 ≥1 天龄 且 ≥10 commits。
第一次提交已完成。之后每次真实迭代(改文档、加截图、修 bug)都单独 commit,
一两天内自然凑满 10 个;凑满前 PR 会被机器人礼貌拒绝,别急。

## 第 5 步:发 PR(浏览器)

1. Fork:打开 https://github.com/awesome-dsh-plugin/awesome-dsh-plugin → 右上角 Fork
2. 在你 fork 里新建文件,路径精确为:
   `data/plugins/<你的GitHub用户名>__dsh-image-picker.yml`
   内容 = 本目录 `registry-entry.yml`(记得替换 `<你的GitHub用户名>`)
3. 提交到你的 fork,然后向 `awesome-dsh-plugin/main` 发 PR
   标题和描述用本目录 `pr-body.md`(替换占位符)
4. 等 CI 自动校验 + 维护者合并

## 第 6 步:收录后

合并后一天内,https://awesome-dsh-plugin.com 和 DSH 设置里的插件市场会出现 dsh-image-picker。
从此它就是市场眼里的"正规军":
- 安装走官方流程 `dsh plugin --profile web add github:<你的GitHub用户名>/dsh-image-picker`
- dshmarket 的安装/更新/回滚不会再把它当垃圾清掉
- 你可以删掉现在 cost-meter 里的临时 shim 和手动 bundles 条目,改由市场统一管理

## 收录后的迁移(喊我一声即可)

1. 卸载手动残留 → 用市场重新安装
2. 删除 cost-meter client.js 尾部的 TEMPORARY SHIM (v3) 段
3. 完成,从此户口在册
