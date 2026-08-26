/**
 * dsh-image-picker — host-side shell (服务端挂载壳)
 *
 * 职责一:把 lib/client.js 作为静态资源暴露给 web 端,并在 HTML 中注入
 * <script defer> 标签(whale-widget 同款挂载模式),client 每次请求都从磁盘
 * 现读,迭代时刷新页面即可看到新版,无需重启。
 *
 * 职责二:POST /dsh-image-picker/store —— 接收客户端选中的文本类附件内容,
 * 落盘到 ~/.dsh/picker-attachments/,把绝对路径回给浏览器。消息里只出现
 * 路径回执,正文不进会话上下文,agent 用普通读取工具按需取用。
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Package root: lib/index.js -> package root. Keeps the bundle relocatable
// when installed as a normal DSH npm plugin (node_modules or a local link).
const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const CLIENT_ROUTE = '/dsh-image-picker/client.js'
const STORE_ROUTE = '/dsh-image-picker/store'
const SCRIPT_TAG = `<script defer src="${CLIENT_ROUTE}"></script>`
const STORE_DIR = path.join(os.homedir(), '.dsh', 'picker-attachments')
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

function clientScript() {
  try {
    return fs.readFileSync(path.join(PACKAGE_ROOT, 'lib', 'client.js'), 'utf8')
  } catch (err) {
    return `console.error('[dsh-image-picker] failed to load client.js:', ${JSON.stringify(String(err))})`
  }
}

function sanitizeName(name) {
  const base = String(name ?? 'file.txt').split(/[\\/]/).pop()
  return base.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0, 120) || 'file.txt'
}

function stamp(d) {
  const p = (n, w) => String(n).padStart(w, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1, 2)}${p(d.getDate(), 2)}-${p(d.getHours(), 2)}${p(d.getMinutes(), 2)}${p(d.getSeconds(), 2)}-${p(d.getMilliseconds(), 3)}`
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > limit) {
        reject(Object.assign(new Error('payload too large'), { statusCode: 413 }))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export const name = 'dsh-image-picker'

// 依赖注入:webServer(静态资源 + HTML 注入)
export const inject = ['webServer']

export function apply(ctx) {
  const disposers = []

  // 1) 暴露 client.js 静态资源(no-store,每次现读磁盘,改完即生效于下次刷新)
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: CLIENT_ROUTE,
    handler: (req, res) => {
      res.writeHead(200, {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-store',
      })
      res.end(clientScript())
    },
  }))

  // 2) 文本类附件落盘:POST JSON { name, text } -> { ok, path }
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: STORE_ROUTE,
    handler: async (req, res) => {
      try {
        const raw = await readBody(req, MAX_UPLOAD_BYTES)
        const parsed = JSON.parse(raw.toString('utf8'))
        const safeName = sanitizeName(parsed?.name)
        const text = typeof parsed?.text === 'string' ? parsed.text : ''
        fs.mkdirSync(STORE_DIR, { recursive: true })
        const target = path.join(STORE_DIR, `${stamp(new Date())}-${safeName}`)
        fs.writeFileSync(target, text, 'utf8')
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ ok: true, path: target, chars: text.length }))
      } catch (err) {
        const code = err?.statusCode ?? 500
        res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ ok: false, error: String(err?.message ?? err) }))
      }
    },
  }))

  // 3) 注入 <script> 标签(幂等:已注入则跳过)
  disposers.push(ctx.webServer.tapIndex((html) => {
    if (html.indexOf(CLIENT_ROUTE) !== -1) return html
    if (html.indexOf('</body>') !== -1) return html.replace('</body>', SCRIPT_TAG + '</body>')
    return html + SCRIPT_TAG
  }))

  // 4) 清理
  ctx.effect(() => () => {
    for (const d of disposers) {
      try { d() } catch (err) {}
    }
  })
}
