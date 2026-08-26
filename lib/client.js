/**
 * dsh-image-picker — 输入框 📎 选图按钮
 *
 * 背景:官方附件链路(dsh-client-ui-attachment)本身支持拖拽与粘贴,但在部分
 * Windows 环境下(浏览器提权与资源管理器完整性级别不一致、云盘占位文件、
 * 嵌入式 webview 等),从外部拖文件进浏览器会静默失败。本插件在
 * conversation.input.left 插槽加一个系统文件选择器按钮,选中的 File 对象
 * 通过合成 DataTransfer 走 document 级 drop 事件,完整复用官方管线:
 * 缩略图 rail、数量/大小上限校验、随消息上传,全部原生行为。
 *
 * 模块契约:window.__ModuleLoader__.load({id, factory}),导出 {inject, apply}。
 */

window.__ModuleLoader__.load({
	id: "dsh-image-picker",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		/* 防重入门控:正式安装包与临时 shim 并存时只激活一份 */
		if (window.__DSH_IMAGE_PICKER__ === true) return module.exports;
		window.__DSH_IMAGE_PICKER__ = true;

		const React = require("react");

		const PICKER_ID = "dsh-image-picker";
		const SLOT_NAME = "conversation.input.left";
		const SLOT_ID = "image-picker-button";

		const css = [
			".dip-btn{display:inline-grid;place-items:center;width:28px;height:28px;padding:0;border:none;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:8px;transition:background .15s ease,color .15s ease}",
			".dip-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
			".dip-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}",
			".dip-btn:disabled{opacity:.4;cursor:default}",
			".dip-btn svg{display:block}"
		].join("");
		if (typeof document !== "undefined" && document.querySelector('style[data-plugin-css="' + PICKER_ID + '"]') === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = PICKER_ID;
			tag.dataset.pluginCss = PICKER_ID;
			tag.textContent = css;
			document.head.appendChild(tag);
		}

		const PAPERCLIP_SVG = React.createElement(
			"svg",
			{ viewBox: "0 0 24 24", width: 16, height: 16, "aria-hidden": true },
			React.createElement("path", {
				d: "m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "2",
				strokeLinecap: "round",
				strokeLinejoin: "round"
			})
		);

		/**
		 * 把 File 列表注入官方附件管线:构造带 Files 的 DataTransfer,
		 * 在输入卡片(document 兜底)派发 dragenter + drop。ComposerAttachments
		 * 的 document 级监听器会接收并调用 onAddImages → intakeImages → addImages。
		 */
		function feedImagesToPipeline(files) {
			const dt = new DataTransfer();
			for (const file of files) dt.items.add(file);
			const card = document.querySelector("[data-composer-card]");
			const target = card ?? document.body;
			const fire = (type, on) => {
				on.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, composed: true, dataTransfer: dt }));
			};
			fire("dragenter", target);
			fire("dragover", target);
			fire("drop", target);
			window.dispatchEvent(new DragEvent("dragend"));
		}

		function ImagePickerButton() {
			const inputRef = React.useRef(null);
			const [busy, setBusy] = React.useState(false);
			const openPicker = () => inputRef.current?.click();
			const onChange = async (event) => {
				const picked = [...(event.target.files ?? [])];
				event.target.value = "";
				if (picked.length === 0) return;
				setBusy(true);
				try {
					feedImagesToPipeline(picked);
				} finally {
					setTimeout(() => setBusy(false), 300);
				}
			};
			return React.createElement(
				React.Fragment,
				null,
				React.createElement(
					"button",
					{
						type: "button",
						className: "dip-btn",
						title: "选择图片添加到消息(替代拖拽)",
						"aria-label": "选择图片添加到消息",
						onMouseDown: (e) => e.preventDefault(),
						onClick: openPicker,
						disabled: busy
					},
					PAPERCLIP_SVG
				),
				React.createElement("input", {
					ref: inputRef,
					type: "file",
					accept: "image/png,image/jpeg,image/webp,image/gif",
					multiple: true,
					style: { display: "none" },
					onChange
				})
			);
		}

		const inject = ["slots"];

		function apply(ctx) {
			const slots = ctx.slots ?? ctx.get("slots");
			slots.inject(SLOT_NAME, () => {
				return slots.register({ name: SLOT_NAME, id: SLOT_ID, order: 0 }, ImagePickerButton);
			});
		}

		exports.inject = inject;
		exports.apply = apply;
		return module.exports;
	}
});
