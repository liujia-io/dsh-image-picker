/**
 * dsh-image-picker — host-side shell (服务端挂载壳)
 *
 * 职责：把 lib/client.js 作为静态资源暴露给 web 端，并在 HTML 中注入
 * <script> 标签，使浏览器端能通过 window.__ModuleLoader__.load() 注册
 * 输入框 📎 选图按钮（复用官方附件管线）。
 *
 * 与 dsh-whale-widget 的挂载模式一致：webServer.register 暴露 JS 文件，
 * tapIndex 注入 script 标签。client 端逻辑全部在 lib/client.js。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Package root: lib/index.js -> package root. Keeps the bundle relocatable
// when installed as a normal DSH npm plugin (node_modules or a local link).
const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// 静态路由前缀（浏览器可访问的路径）
const CLIENT_ROUTE = '/dsh-image-picker/client.js'
const SCRIPT_TAG = `<script defer src="${CLIENT_ROUTE}"></script>`

// 读取 client.js 内容（启动时读一次，缓存）
function loadClientScript() {
  const clientPath = path.join(PACKAGE_ROOT, 'lib', 'client.js')
  try {
    return fs.readFileSync(clientPath, 'utf8')
  } catch (err) {
    return `console.error('[dsh-image-picker] failed to load client.js:', ${JSON.stringify(String(err))})`
  }
}

export const name = 'dsh-image-picker'

// 依赖注入：webServer（静态资源 + HTML 注入）
export const inject = ['webServer']

export function apply(ctx) {
  const disposers = []
  const script = loadClientScript()

  // 1) 暴露 client.js 静态资源（no-store，开发时改动即时生效）
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: CLIENT_ROUTE,
    handler: (req, res) => {
      res.writeHead(200, {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-store',
      })
      res.end(script)
    },
  }))

  // 2) 注入 <script> 标签（幂等：已注入则跳过）
  disposers.push(ctx.webServer.tapIndex((html) => {
    if (html.indexOf(CLIENT_ROUTE) !== -1) return html
    if (html.indexOf('</body>') !== -1) return html.replace('</body>', SCRIPT_TAG + '</body>')
    return html + SCRIPT_TAG
  }))

  // 3) 清理
  ctx.effect(() => () => {
    for (const d of disposers) {
      try { d() } catch (err) {}
    }
  })
}
