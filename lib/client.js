/**
 * dsh-image-picker — browser side (self-contained injector)
 *
 * Delivered as a plain <script> by the host-side shell (lib/index.js):
 * webServer route "/dsh-image-picker/client.js" + tapIndex script-tag
 * injection. Deliberately NOT a window.__ModuleLoader__.load() bundle:
 * ids absent from the frozen boot manifest are never materialized by the
 * client module system, so this file must stay dependency-free and
 * self-executing (same proven pattern as the temporary composer shim).
 *
 * Injects one paperclip button next to the composer "+" button; picked
 * Files go through a synthetic drop into the official attachment pipeline.
 */
;(function () {
	"use strict";
	if (window.__DSH_IMAGE_PICKER__) return;
	window.__DSH_IMAGE_PICKER__ = true;

	var CSS = ".dip-btn{display:inline-grid;place-items:center;width:28px;height:28px;padding:0;border:none;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:8px;transition:background .15s ease,color .15s ease}"
		+ ".dip-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}"
		+ ".dip-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}"
		+ ".dip-btn svg{display:block}";
	var CLIP = "m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48";
	var TITLE = "\u9009\u62E9\u56FE\u7247\u6DFB\u52A0\u5230\u6D88\u606F(\u66FF\u4EE3\u62D6\u62FD)";

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
		input.accept = "image/png,image/jpeg,image/webp,image/gif";
		input.multiple = true;
		input.style.display = "none";
		input.addEventListener("change", function () {
			var picked = Array.prototype.slice.call(input.files || []);
			input.value = "";
			if (picked.length > 0) feedImages(picked);
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
