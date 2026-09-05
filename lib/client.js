/**
 * dsh-image-picker v1.2.0 — browser side (self-contained injector)
 *
 * Delivered as a plain <script> by the host-side shell (lib/index.js):
 * webServer route "/dsh-image-picker/client.js" + tapIndex script-tag
 * injection. Deliberately NOT a window.__ModuleLoader__.load() bundle:
 * ids absent from the frozen boot manifest are never materialized by the
 * client module system, so this file must stay dependency-free and
 * self-executing.
 *
 * Routing by type:
 *   - images             -> synthetic drop -> OFFICIAL attachment pipeline
 *                           (thumbnails, limit checks, upload with message)
 *   - .txt .md .markdown -> content POSTed to /dsh-image-picker/store,
 *                           saved server-side under ~/.dsh/picker-attachments/;
 *                           only a short receipt (path + size + preview)
 *                           is inserted into the draft. Inline fallback
 *                           with caps if the store route is unavailable.
 *   - .docx              -> minimal in-browser ZIP reader +
 *                           DecompressionStream("deflate-raw") extracts
 *                           word/document.xml -> plain text, same staging.
 *
 * Pure helpers live on Core and are exported on globalThis for testing.
 */
;(function () {
	"use strict";

	var STORE_ROUTE = "/dsh-image-picker/store";
	var INLINE_PER_FILE_CHAR_CAP = 30000;
	var INLINE_TOTAL_CHAR_CAP = 60000;
	var PREVIEW_CHARS = 120;
	var ACCEPTED_TEXT_RE = /\.(txt|md|markdown)$/i;
	var DOCX_RE = /\.docx$/i;

	function decodeEntities(s) {
		return s
			.replace(/&lt;/g, "<")
			.replace(/&gt;/g, ">")
			.replace(/&quot;/g, '"')
			.replace(/&apos;/g, "'")
			.replace(/&#x([0-9a-fA-F]+);/g, function (_, h) { return String.fromCharCode(parseInt(h, 16)); })
			.replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(+d); })
			.replace(/&amp;/g, "&");
	}

	/** Extract plain text from a .docx (zip) buffer. Returns Promise<string>. */
	function extractDocxText(buf) {
		var dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
		var i, eocd = -1;
		for (i = buf.length - 22; i >= Math.max(0, buf.length - 65558); i--) {
			if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
		}
		if (eocd < 0) return Promise.reject(new Error("not a zip (no EOCD)"));
		var count = dv.getUint16(eocd + 10, true);
		var off = dv.getUint32(eocd + 16, true);
		var target = null;
		for (i = 0; i < count; i++) {
			if (dv.getUint32(off, true) !== 0x02014b50) break;
			var method = dv.getUint16(off + 10, true);
			var compSize = dv.getUint32(off + 20, true);
			var nameLen = dv.getUint16(off + 28, true);
			var extraLen = dv.getUint16(off + 30, true);
			var commentLen = dv.getUint16(off + 32, true);
			var localOffset = dv.getUint32(off + 42, true);
			var name = new TextDecoder().decode(new Uint8Array(buf.buffer, buf.byteOffset + off + 46, nameLen)).replace(/\\/g, "/");
			if (name === "word/document.xml") {
				target = { method: method, compSize: compSize, localOffset: localOffset };
				break;
			}
			off += 46 + nameLen + extraLen + commentLen;
		}
		if (!target) return Promise.reject(new Error("word/document.xml not found"));
		var lnLen = dv.getUint16(target.localOffset + 26, true);
		var lxLen = dv.getUint16(target.localOffset + 28, true);
		var start = target.localOffset + 30 + lnLen + lxLen;
		var packed = buf.subarray(start, start + target.compSize);
		var done = function (bytes) {
			var xml = new TextDecoder("utf-8").decode(bytes);
			var t = xml
				.replace(/<w:tab[^>]*\/>/g, "\t")
				.replace(/<w:br[^>]*\/>/g, "\n")
				.replace(/<\/w:p>/g, "\n\n");
			t = t.replace(/<(?!\/?w:t\b)[^>]*>/g, "");
			t = t.replace(/<\/?w:t[^>]*>/g, "");
			t = decodeEntities(t).replace(/\n{3,}/g, "\n\n").trim();
			return t;
		};
		if (target.method === 0) return Promise.resolve(done(packed));
		if (target.method !== 8) return Promise.reject(new Error("unsupported zip method " + target.method));
		return new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream("deflate-raw")))
			.arrayBuffer()
			.then(function (ab) { return done(new Uint8Array(ab)); });
	}

	/** Read a text-ish file. Returns Promise<{name,text,origLen}> */
	function readTextFile(file) {
		return file.text().then(function (raw) {
			return { name: file.name, text: raw, origLen: raw.length };
		});
	}

	/** Read a .docx, extract text. Same shape as readTextFile. */
	function readDocxFile(file) {
		return file
			.arrayBuffer()
			.then(extractDocxText)
			.then(function (raw) {
				return { name: file.name, text: raw, origLen: raw.length };
			});
	}

	/** Stage content server-side; resolves to a short receipt block. */
	function stagePart(part) {
		return fetch(STORE_ROUTE, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: part.name, text: part.text })
		})
			.then(function (r) { return r.json(); })
			.then(function (j) {
				if (!j || j.ok !== true) throw new Error((j && j.error) || "store failed");
				var preview = part.text.replace(/\s+/g, " ").slice(0, PREVIEW_CHARS);
				return "[附件已暂存 · " + j.path + "]\n"
					+ part.name + " · " + j.chars + " 字符 · agent 可按上述路径按需读取\n"
					+ "预览: " + preview + (part.text.length > PREVIEW_CHARS ? "…" : "");
			});
	}

	/** Inline fallback when the store route is unavailable (v1.1 behavior). */
	function inlineBlock(part) {
		var capped = part.text.length > INLINE_PER_FILE_CHAR_CAP;
		var head = "[附件 · " + part.name + " · " + part.origLen + " 字符" + (capped ? " · 已截断至 " + INLINE_PER_FILE_CHAR_CAP : "") + " · 暂存服务不可用,内容内联]";
		return head + "\n<<<ATTACHMENT-BEGIN>>>\n" + (capped ? part.text.slice(0, INLINE_PER_FILE_CHAR_CAP) : part.text) + "\n<<<ATTACHMENT-END>>>";
	}

	/** Find the composer's Lexical contenteditable (the current DSH input, not a <textarea>).
	 *  Tries several candidate shapes so it survives DSH DOM changes across rc builds:
	 *  [data-composer-input] (scoped to the card, then global), then the card's
	 *  contenteditable / textbox, then a global contenteditable as a last resort. */
	function findComposerInput() {
		var card = document.querySelector("[data-composer-card]");
		var cand = [];
		if (card) {
			cand.push(card.querySelector("[data-composer-input]"));
			cand.push(card.querySelector('[contenteditable="true"]'));
			cand.push(card.querySelector("[role='textbox']"));
		}
		cand.push(document.querySelector("[data-composer-input]"));
		cand.push(document.querySelector('[contenteditable="true"]'));
		cand.push(document.querySelector("[role='textbox']"));
		for (var i = 0; i < cand.length; i++) if (cand[i]) return cand[i];
		return null;
	}

	/** Focus the editable and drop the caret at the end of its content. */
	function caretToEnd(el) {
		try {
			el.focus();
			var range = document.createRange();
			range.selectNodeContents(el);
			range.collapse(false);
			var sel = window.getSelection();
			sel.removeAllRanges();
			sel.addRange(range);
		} catch (e) {}
	}

	/** Deliver text into the Lexical composer via a synthetic paste event.
	 *  The composer registers PASTE_COMMAND and reads clipboardData.getData("text/plain")
	 *  before calling pasteText(), so a paste carrying the text as text/plain is ingested
	 *  by the editor. */
	function pasteIntoEditable(el, text) {
		var dt = new DataTransfer();
		dt.setData("text/plain", text);
		var ev = new ClipboardEvent("paste", { bubbles: true, cancelable: true });
		try { Object.defineProperty(ev, "clipboardData", { value: dt }); } catch (e) {}
		el.dispatchEvent(ev);
	}

	/** Insert text at the end of the composer draft.
	 *  Prefers the Lexical contenteditable (synthetic paste), falls back to
	 *  execCommand("insertText"), then to a plain <textarea> for legacy/simple hosts. */
	function insertIntoDraft(text) {
		var ed = findComposerInput();
		if (ed) {
			caretToEnd(ed);
			var pasted = false;
			try { pasted = document.execCommand("insertText", false, text); } catch (e) {}
			if (!pasted) {
				pasteIntoEditable(ed, text);
				pasted = true; // the composer's PASTE_COMMAND handler applies it
			}
			return pasted;
		}
		// Legacy/plain-textarea fallback.
		var card = document.querySelector("[data-composer-card]");
		var ta = card ? card.querySelector("textarea") : document.querySelector("textarea");
		if (!ta) return false;
		var setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
		var cur = ta.value;
		setter.call(ta, cur ? cur.replace(/\s*$/, "") + "\n\n" + text : text);
		ta.dispatchEvent(new Event("input", { bubbles: true }));
		ta.focus();
		return true;
	}

	// ---- pure-core export for node-side tests -------------------------------
	var Core = {
		extractDocxText: extractDocxText,
		readTextFile: readTextFile,
		readDocxFile: readDocxFile,
		inlineBlock: inlineBlock,
		decodeEntities: decodeEntities
	};

	if (typeof globalThis !== "undefined") globalThis.__DIP_CORE__ = Core;
	if (typeof window === "undefined") return;

	// ---- UI bootstrap -------------------------------------------------------
	if (window.__DSH_IMAGE_PICKER__) return;
	window.__DSH_IMAGE_PICKER__ = true;

	var CSS = ".dip-btn{display:inline-grid;place-items:center;width:28px;height:28px;padding:0;border:none;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:8px;transition:background .15s ease,color .15s ease}"
		+ ".dip-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}"
		+ ".dip-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}"
		+ ".dip-btn svg{display:block}"
		+ ".dip-btn.dip-flash{outline:2px solid var(--dsw-alias-brand-primary)}";
	var CLIP = "m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48";
	var TITLE = "\u9009\u62E9\u6587\u4EF6(\u56FE\u7247\u76F4\u4F20\uFF1B\u6587\u672C/docx \u6682\u5B58\u4E3A\u672C\u5730\u6587\u4EF6,\u4EC5\u56DE\u6267\u63D2\u5165)";

	function ensureStyle() {
		if (document.querySelector('style[data-plugin-css="dsh-image-picker"]')) return;
		var tag = document.createElement("style");
		tag.dataset.plugin = "dsh-image-picker";
		tag.dataset.pluginCss = "dsh-image-picker";
		tag.textContent = CSS;
		document.head.appendChild(tag);
	}

	function feedImages(files) {
		var dt = new DataTransfer();
		for (var k = 0; k < files.length; k++) dt.items.add(files[k]);
		var card = document.querySelector("[data-composer-card]");
		var target = card || document.body;
		var types = ["dragenter", "dragover", "drop"];
		for (var i = 0; i < types.length; i++) {
			target.dispatchEvent(new DragEvent(types[i], { bubbles: true, cancelable: true, composed: true, dataTransfer: dt }));
		}
		window.dispatchEvent(new DragEvent("dragend"));
	}

	function flashButton(btn) {
		btn.classList.add("dip-flash");
		setTimeout(function () { btn.classList.remove("dip-flash"); }, 1200);
	}

	function handlePicked(files, btn) {
		var imgs = [], texts = [], skipped = [];
		for (var k = 0; k < files.length; k++) {
			var f = files[k];
			if (/^image\//.test(f.type)) { imgs.push(f); continue; }
			if (ACCEPTED_TEXT_RE.test(f.name)) { texts.push(readTextFile(f)); continue; }
			if (DOCX_RE.test(f.name)) {
				(function (docxName) {
					texts.push(
						readDocxFile(f)["catch"](function (e) {
							return { name: docxName, text: "[dsh-image-picker] docx 解析失败: " + e.message, origLen: 0 };
						})
					);
				})(f.name);
				continue;
			}
			skipped.push(f.name);
		}
		if (imgs.length > 0) feedImages(imgs);
		if (texts.length > 0) {
			Promise.all(texts).then(function (parts) {
				return Promise.all(parts.map(function (p) {
					return stagePart(p)["catch"](function (e) {
						console.warn("[dsh-image-picker] stage failed, inlining:", e.message);
						return inlineBlock(p);
					});
				}));
			}).then(function (blocks) {
				if (skipped.length > 0) blocks.push("[dsh-image-picker] 未处理: " + skipped.join(", "));
				if (!insertIntoDraft(blocks.join("\n\n"))) console.warn("[dsh-image-picker] composer textarea not found");
			})["catch"](function (e) { console.error("[dsh-image-picker]", e); flashButton(btn); });
		} else if (imgs.length === 0 && skipped.length > 0) {
			flashButton(btn);
			console.warn("[dsh-image-picker] skipped:", skipped.join(", "));
		}
	}

	function buildButton() {
		var btn = document.createElement("button");
		btn.type = "button";
		btn.className = "dip-btn";
		btn.title = TITLE;
		btn.setAttribute("aria-label", TITLE);
		btn.addEventListener("mousedown", function (e) { e.preventDefault(); });
		btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="' + CLIP + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
		var input = document.createElement("input");
		input.type = "file";
		input.accept = "image/png,image/jpeg,image/webp,image/gif,.txt,.md,.markdown,.docx";
		input.multiple = true;
		input.style.display = "none";
		input.addEventListener("change", function () {
			var picked = Array.prototype.slice.call(input.files || []);
			input.value = "";
			if (picked.length > 0) handlePicked(picked, btn);
		});
		btn.addEventListener("click", function () { input.click(); });
		var wrap = document.createDocumentFragment();
		wrap.appendChild(btn);
		wrap.appendChild(input);
		return wrap;
	}

	function findHost() {
		var card = document.querySelector("[data-composer-card]");
		if (!card || card.querySelector(".dip-btn")) return null;
		var addBtn = card.querySelector("button[class*='_add']");
		if (addBtn && addBtn.parentElement) return { parent: addBtn.parentElement, ref: addBtn.nextSibling };
		var tools = card.querySelector("[class*='_tools']");
		if (tools) return { parent: tools, ref: tools.firstChild };
		return null;
	}

	function tick() {
		var spot = findHost();
		if (!spot) return;
		ensureStyle();
		spot.parent.insertBefore(buildButton(), spot.ref);
	}

	function start() {
		tick();
		new MutationObserver(function () { tick(); }).observe(document.body, { childList: true, subtree: true });
	}
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
	else start();
})();
