import { App, Modal, TFile, normalizePath } from "obsidian";
import type GDCardPlugin from "./main";
import { CardData, STATUS_LABEL, STATUS_ORDER, Status, parseCard } from "./data";
import { cardHTML, refreshWeak } from "./card";
import { mountHTML } from "./dom";
import { extractCardBlock } from "./block";

const SORT_OPTIONS: Array<[string, string]> = [
  ["mtime-desc", "最近修改"],
  ["created-desc", "创建时间 新→旧"],
  ["created-asc", "创建时间 旧→新"],
  ["rare-desc", "稀有度 高→低"],
  ["name-asc", "名称"],
  ["status", "开发状态"],
];

/** 卡片库：扫描卡片目录，按开发状态筛选 + 多种排序，点卡片跳到对应笔记 */
export class LibraryModal extends Modal {
  private cards: Array<{ file: TFile; data: CardData }> = [];
  private filter: Status | "all" = "all";
  private headEl!: HTMLElement;
  private gridEl!: HTMLElement;

  constructor(app: App, private plugin: GDCardPlugin) {
    super(app);
    this.modalEl.addClass("gd-lib-modal");
  }

  async onOpen(): Promise<void> {
    this.titleEl.setText("卡片库");
    const loading = this.contentEl.createDiv({ cls: "gd-lib-loading", text: "正在读取卡片…" });
    await this.load();
    loading.remove();

    this.headEl = this.contentEl.createDiv({ cls: "gd-lib-head" });
    this.gridEl = this.contentEl.createDiv({ cls: "gd-lib-grid" });
    this.render();
  }

  private async load(): Promise<void> {
    const folder = normalizePath(this.plugin.settings.cardFolder);
    // 范围限制在卡片目录：先按路径前缀过滤，目录外的文件不读取
    for (const f of this.app.vault.getFiles()) {
      if (f.extension !== "md") continue;
      if (!(f.path === folder || f.path.startsWith(folder + "/"))) continue;
      const text = await this.app.vault.cachedRead(f);
      const body = extractCardBlock(text);
      if (!body) continue;
      this.cards.push({ file: f, data: parseCard(body, this.plugin.settings) });
    }
  }

  private sorted(): Array<{ file: TFile; data: CardData }> {
    const arr = [...this.cards];
    const byCreated = (a: { data: CardData }, b: { data: CardData }) =>
      (a.data.created || "").localeCompare(b.data.created || "");
    const mtime = (x: { file: TFile }) => x.file.stat?.mtime ?? 0;

    switch (this.plugin.settings.librarySort) {
      case "created-asc":
        arr.sort(byCreated);
        break;
      case "created-desc":
        arr.sort((a, b) => byCreated(b, a));
        break;
      case "rare-desc":
        arr.sort((a, b) => (Number(b.data.rare) || 0) - (Number(a.data.rare) || 0) || byCreated(a, b));
        break;
      case "name-asc":
        arr.sort((a, b) => (a.data.name || "").localeCompare(b.data.name || "", "zh"));
        break;
      case "status":
        arr.sort((a, b) =>
          STATUS_ORDER.indexOf(a.data.status) - STATUS_ORDER.indexOf(b.data.status) || byCreated(a, b));
        break;
      default:
        arr.sort((a, b) => mtime(b) - mtime(a));
    }
    return arr;
  }

  private render(): void {
    const all = this.sorted();
    const list = this.filter === "all" ? all : all.filter(c => c.data.status === this.filter);

    this.headEl.empty();

    /* 第一行：标题 + 工具（排序、新建） */
    const top = this.headEl.createDiv({ cls: "gd-lib-top" });

    const titleBox = top.createDiv({ cls: "gd-lib-title" });
    titleBox.createEl("h2", { text: "卡片库" });
    titleBox.createSpan({ cls: "gd-lib-count", text: `${list.length} 张` });

    const tools = top.createDiv({ cls: "gd-lib-tools" });
    const sel = tools.createEl("select", { cls: "dropdown gd-lib-sort" });
    for (const [value, label] of SORT_OPTIONS) {
      const opt = sel.createEl("option", { text: label });
      opt.value = value;
      if (this.plugin.settings.librarySort === value) opt.selected = true;
    }
    sel.onchange = async () => {
      this.plugin.settings.librarySort = sel.value;
      await this.plugin.saveSettings();
      this.render();
    };

    /* 第二行：状态筛选 */
    const chips = this.headEl.createDiv({ cls: "gd-lib-chips" });
    const filters: Array<[Status | "all", string]> = [
      ["all", "全部"],
      ...STATUS_ORDER.map(s => [s, STATUS_LABEL[s]] as [Status, string]),
    ];
    for (const [key, label] of filters) {
      const b = chips.createEl("button", {
        cls: "gd-filter" + (this.filter === key ? " is-on" : ""),
        text: label,
      });
      b.onclick = () => { this.filter = key; this.render(); };
    }

    /* 网格 */
    this.gridEl.empty();
    if (!list.length) {
      this.gridEl.createDiv({
        cls: "gd-lib-empty",
        text: this.cards.length
          ? "这个状态下还没有卡片。"
          : "还没有卡片，用左侧功能区的 ＋ 新建一张。",
      });
      return;
    }

    for (const item of list) {
      const cell = this.gridEl.createDiv({ cls: "gd-lib-cell" });
      const card = cell.createDiv({ cls: "gdcard gd-static" });
      mountHTML(card, cardHTML(item.data, this.plugin.settings, false));
      refreshWeak(card);
      cell.onclick = () => {
        void this.app.workspace.getLeaf(false).openFile(item.file);
        this.close();
      };
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
