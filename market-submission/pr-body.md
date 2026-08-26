# PR 标题(直接复制)

Add dsh-image-picker — composer image-picker button feeding the official attachment pipeline

# PR 正文(直接复制)

## Plugin

`<你的GitHub用户名>/dsh-image-picker` — a paperclip button in the conversation composer that opens the system file dialog and injects the picked images into the official attachment pipeline (`ComposerAttachments` → `intakeImages` → draft-image rail), so users on Windows setups where OS-level drag-and-drop into the browser silently fails (UIPI integrity-level mismatch, cloud-drive placeholder files, embedded webviews) can still attach reference images.

## Compliance checklist

- [x] `dsh.bundle` declared in `package.json` (with `cordis.patch.yml` insert + `dsh.client.platform: "web"`)
- [x] Installs via `dsh plugin --profile web add github:<你的GitHub用户名>/dsh-image-picker`
- [x] Repo carries the `dsh-plugin` topic
- [x] Repo age / commit count requirement met before opening this PR
- [x] Client code is plain ES2020 registered through `window.__ModuleLoader__`, no build step required

## How it works

Click 📎 → hidden `<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple>` → picked `File`s go into a synthetic `DataTransfer` → a `drop` event is dispatched on `[data-composer-card]`, where the official `dsh-client-ui-attachment` document-level listener takes over. Zero custom upload logic; all native behavior (thumbnail rail, 20-images/20MB limits, upload with message) is reused.

MIT licensed.
