import { App, Modal, Notice, TFile, normalizePath } from "obsidian";
import { GDSettings, parseCard, sanitizeFileName } from "./data";
import { extractCardBlock } from "./block";

export type RenameStatus = "rename" | "same" | "conflict" | "skip";

export interface RenameItem {
  file: TFile;
  from: string;
  to: string;
  targetPath: string;
  status: RenameStatus;
  reason?: string;
}

/**
 * 只扫「卡片目录」里、且正文带 ```gdcard 代码块的笔记。
 * 目录外的文档、目录里没有卡片块的普通笔记，一律不碰。
 */
export async function buildRenamePlan(app: App, settings: GDSettings): Promise<RenameItem[]> {
  const folder = normalizePath(settings.cardFolder || "卡片");
  // 范围限制在卡片目录：先按路径前缀过滤，目录外的笔记一律不碰
  const inFolder = app.vault.getFiles().filter(f =>
    f.extension === "md" && (f.path === folder || f.path.startsWith(folder + "/")));

  const plan: RenameItem[] = [];
  const claimed = new Set<string>();

  for (const f of inFolder) {
    const text = await app.vault.cachedRead(f);
    const body = extractCardBlock(text);
    if (!body) continue; // 不是卡片

    const data = parseCard(body, settings);
    const title = sanitizeFileName((data.name || "").trim());
    const dir = f.parent && f.parent.path !== "/" ? f.parent.path : "";
    const targetPath = title ? normalizePath(dir ? `${dir}/${title}.md` : `${title}.md`) : "";

    if (!title) {
      plan.push({ file: f, from: f.basename, to: "", targetPath: "", status: "skip", reason: "标题为空" });
      continue;
    }
    if (targetPath === f.path) {
      plan.push({ file: f, from: f.basename, to: title, targetPath, status: "same" });
      continue;
    }
    const key = targetPath.toLowerCase();
    if (claimed.has(key)) {
      plan.push({ file: f, from: f.basename, to: title, targetPath, status: "conflict", reason: "和本次另一张卡重名" });
      continue;
    }
    if (app.vault.getAbstractFileByPath(targetPath)) {
      plan.push({ file: f, from: f.basename, to: title, targetPath, status: "conflict", reason: "同名文件已存在" });
      continue;
    }

    claimed.add(key);
    plan.push({ file: f, from: f.basename, to: title, targetPath, status: "rename" });
  }

  return plan.sort((a, b) => a.from.localeCompare(b.from, "zh"));
}

/** 确认列表：勾选要改的，冲突项标出来且不能选 */
export class BatchRenameModal extends Modal {
  private items: RenameItem[] = [];
  private selected = new Set<string>();
  private listEl!: HTMLElement;
  private confirmBtn!: HTMLButtonElement;

  constructor(app: App, private settings: GDSettings) {
    super(app);
    this.modalEl.addClass("gd-batch-modal");
  }

  async onOpen(): Promise<void> {
    this.titleEl.setText("批量按标题重命名");
    const loading = this.contentEl.createDiv({ cls: "gd-lib-loading", text: "正在检查卡片…" });
    this.items = await buildRenamePlan(this.app, this.settings);
    loading.remove();

    const toRename = this.items.filter(i => i.status === "rename");
    for (const it of toRename) this.selected.add(it.file.path);

    const summary = this.contentEl.createDiv({ cls: "gd-batch-summary" });
    const stat = (n: number, label: string): void => {
      summary.createEl("b", { text: String(n) });
      summary.appendText(" " + label);
    };
    stat(this.items.length, "张卡片");
    summary.appendText(" · ");
    stat(toRename.length, "张待改名");
    summary.appendText(" · ");
    stat(this.items.filter(i => i.status === "conflict").length, "张冲突");
    summary.appendText(" · ");
    stat(this.items.filter(i => i.status === "skip").length, "张跳过");
    if (!toRename.length) {
      summary.createDiv({ cls: "gd-batch-hint", text: "没有需要改名的卡片。" });
    }

    this.listEl = this.contentEl.createDiv({ cls: "gd-batch-list" });
    for (const it of this.items) this.listEl.appendChild(this.row(it));

    const foot = this.contentEl.createDiv({ cls: "gd-batch-foot" });
    const cancel = foot.createEl("button", { text: "取消" });
    cancel.onclick = () => this.close();
    this.confirmBtn = foot.createEl("button", { cls: "mod-cta" });
    this.updateConfirm();
    this.confirmBtn.onclick = () => void this.run();
  }

  private row(it: RenameItem): HTMLElement {
    const row = createDiv({
      cls: "gd-batch-row" + (it.status === "conflict" ? " is-conflict" : it.status === "same" ? " is-same" : ""),
    });

    const box = row.createEl("input", { type: "checkbox" });
    box.checked = it.status === "rename" && this.selected.has(it.file.path);
    box.disabled = it.status !== "rename";
    box.onchange = () => {
      if (box.checked) this.selected.add(it.file.path);
      else this.selected.delete(it.file.path);
      this.updateConfirm();
    };

    row.createSpan({ cls: "gd-batch-from", text: it.from });
    row.createSpan({ cls: "gd-batch-arrow", text: "→" });
    row.createSpan({
      cls: "gd-batch-to",
      text: it.status === "skip" ? "（不改）" : it.to,
    });

    const tag = it.status === "conflict" ? it.reason
      : it.status === "same" ? "已是标题"
        : it.status === "skip" ? it.reason
          : "";
    if (tag) row.createSpan({ cls: "gd-batch-tag", text: tag });

    return row;
  }

  private updateConfirm(): void {
    const n = this.selected.size;
    this.confirmBtn.setText(n ? `重命名 ${n} 个` : "没有可改的");
    this.confirmBtn.disabled = n === 0;
  }

  private async run(): Promise<void> {
    const picked = this.items.filter(i => i.status === "rename" && this.selected.has(i.file.path));
    if (!picked.length) { this.close(); return; }

    this.close();
    let ok = 0;
    let fail = 0;
    for (const it of picked) {
      try {
        await this.app.fileManager.renameFile(it.file, it.targetPath);
        ok++;
      } catch {
        fail++;
      }
    }
    new Notice(
      `GDCard：已重命名 ${ok} 张卡片` + (fail ? `，${fail} 张失败（多为同名冲突，再跑一次即可）` : "")
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
