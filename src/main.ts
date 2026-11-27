import {
  App,
  MarkdownPostProcessorContext,
  MarkdownRenderChild,
  MarkdownView,
  Menu,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  normalizePath,
} from "obsidian";
import type { SettingDefinitionItem } from "obsidian";

import {
  CardData,
  DEFAULT_SETTINGS,
  GDSettings,
  STATUS_LABEL,
  STATUS_ORDER,
  emptyCard,
  joinList,
  parseCard,
  serializeCard,
  splitList,
} from "./data";
import { cardHTML, refreshWeak, richHTML } from "./card";
import { mountHTML } from "./dom";
import { extractCardBlock, replaceCardBlock } from "./block";
import { LibraryModal } from "./library";
import { BatchRenameModal } from "./batchRename";
import { PromptModal } from "./prompt";

/* ============================================================
   一个 ```gdcard 代码块 = 一张卡片
   ============================================================ */

/** 区块元素用 innerText（保留换行），短字段用 textContent */
function readText(el: HTMLElement): string {
  const isBlock = el.classList.contains("gd-text") || el.classList.contains("gd-p");
  return ((isBlock ? el.innerText : el.textContent) || "").replace(/\u00a0/g, " ");
}

class CardBlock extends MarkdownRenderChild {
  private data: CardData;
  private raw: string;
  private cardEl!: HTMLElement;
  private dirty = false;
  private saveTimer: number | null = null;

  constructor(
    private plugin: GDCardPlugin,
    private sourcePath: string,
    source: string,
    containerEl: HTMLElement
  ) {
    super(containerEl);
    this.raw = source;
    this.data = parseCard(source, plugin.settings);
  }

  onload(): void {
    this.containerEl.empty();
    this.cardEl = this.containerEl.createDiv({ cls: "gdcard" });
    this.render();

    this.registerDomEvent(this.cardEl, "click", (e) => this.onClick(e as MouseEvent));
    this.registerDomEvent(this.cardEl, "input", (e) => this.onInput(e));
    this.registerDomEvent(this.cardEl, "focusout", () => this.onFocusOut());
    this.registerDomEvent(this.cardEl, "blur", (e) => this.onBlur(e), { capture: true });
    // 实时预览下别让编辑器把卡片里的点击当成移动光标
    this.registerDomEvent(this.cardEl, "mousedown", (e) => e.stopPropagation());
  }

  onunload(): void {
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
    void this.save(true);
  }

  /* ---------------- 渲染 ---------------- */

  private render(): void {
    mountHTML(this.cardEl, cardHTML(this.data, this.plugin.settings, true));
    refreshWeak(this.cardEl);
  }

  private commit(): void {
    this.render();
    this.dirty = true;
    void this.save();
  }

  /* ---------------- 保存 ---------------- */

  private scheduleSave(ms = 900): void {
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      void this.save();
    }, ms);
  }

  private async save(silent = false): Promise<void> {
    if (!this.dirty) return;
    // 光标还在卡片里就不写盘：写文件会让 Obsidian 重渲染这个块，正在打的字会丢焦点
    if (this.cardEl.isConnected && this.cardEl.contains(document.activeElement)) return;
    this.dirty = false;
    const body = serializeCard(this.data, this.plugin.settings);
    if (body === this.raw) return;
    try {
      // 用真实文件对象，而不是缓存的路径：文件被改名后路径会失效
      const file = await this.plugin.writeCard(this.sourcePath, this.raw, body);
      this.sourcePath = file.path;
      this.raw = body;
    } catch (e) {
      this.dirty = true;
      if (!silent) {
        new Notice("GDCard 保存失败：" + (e instanceof Error ? e.message : String(e)));
      }
    }
  }

  /** 焦点离开整张卡片才写盘，避免边打字边重渲染丢光标 */
  private onFocusOut(): void {
    window.setTimeout(async () => {
      if (this.cardEl.contains(document.activeElement)) return;
      await this.save();
    }, 220);
  }

  /* ---------------- 输入 ---------------- */

  private onInput(evt: Event): void {
    const el = evt.target as HTMLElement;
    if (!el || !el.dataset) return;
    const ds = el.dataset;

    if (ds.attr !== undefined && el.classList.contains("gd-v")) {
      const k = ds.attr;
      const v = readText(el);
      if (k in this.data.attrs) this.data.attrs[k] = v;
      else this.data.optional[k] = v;
    } else if (ds.bal !== undefined) {
      this.data.balance[ds.bal] = readText(el);
    } else if (ds.field) {
      const f = ds.field as keyof CardData;
      let v = readText(el);
      if (f === "owner") v = v.replace(/^@/, "");
      (this.data as unknown as Record<string, unknown>)[f] = v;
    }

    this.dirty = true;
    refreshWeak(this.cardEl);
    this.scheduleSave();
  }

  private onBlur(evt: Event): void {
    const el = evt.target as HTMLElement;
    if (!el || !el.isContentEditable) return;

    // 联动：失焦时换回带高亮的富文本
    if (el.classList.contains("gd-rich")) {
      const raw = (el.innerText || "").replace(/[ \t]+\n/g, "\n").trim();
      this.data.synergy = raw;
      el.removeAttribute("contenteditable");
      mountHTML(el, raw ? richHTML(raw) : "");
      el.dataset.linkedit = "1";
      this.dirty = true;
      refreshWeak(this.cardEl);
      this.scheduleSave(150);
      return;
    }

    if (!(el.textContent || "").trim()) el.empty();
  }

  /* ---------------- 点击 ---------------- */

  private onClick(evt: MouseEvent): void {
    const t = evt.target as HTMLElement;

    const wiki = t.closest<HTMLElement>(".gd-wiki");
    if (wiki) {
      evt.preventDefault();
      const href = wiki.dataset.href || wiki.textContent || "";
      void this.plugin.app.workspace.openLinkText(href, this.sourcePath, false);
      return;
    }

    const rich = t.closest<HTMLElement>("[data-linkedit]");
    if (rich && !rich.isContentEditable) {
      this.enterSynergyEdit(rich);
      return;
    }

    const act = t.closest<HTMLElement>("[data-act]")?.dataset.act;
    if (act === "add-opt") { this.attrMenu(evt); return; }
    if (act === "add-bal") { this.balMenu(evt); return; }
    if (act === "status") { this.statusMenu(evt); return; }

    const del = t.closest<HTMLElement>("[data-del]");
    if (del && del.dataset.del !== undefined) {
      delete this.data.optional[del.dataset.del];
      this.commit();
      return;
    }

    const delBal = t.closest<HTMLElement>("[data-delbal]");
    if (delBal && delBal.dataset.delbal !== undefined) {
      delete this.data.balance[delBal.dataset.delbal];
      this.commit();
      return;
    }
  }

  private enterSynergyEdit(el: HTMLElement): void {
    el.setAttribute("contenteditable", "true");
    el.removeAttribute("data-linkedit");
    el.textContent = this.data.synergy;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  /* ---------------- 菜单 ---------------- */

  private attrMenu(evt: MouseEvent): void {
    const menu = new Menu();
    const used = Object.keys(this.data.optional);
    const avail = this.plugin.settings.optionalAttrs.filter(k => !used.includes(k));

    for (const k of avail) {
      menu.addItem(item => item.setTitle(k).onClick(() => {
        this.data.optional[k] = "";
        this.commit();
      }));
    }
    if (!avail.length) {
      menu.addItem(item => item.setTitle("可选属性都已添加").setDisabled(true));
    }
    menu.addSeparator();
    menu.addItem(item => item.setTitle("自定义字段…").onClick(() => {
      new PromptModal(this.plugin.app, "自定义属性名", (name) => {
        this.data.optional[name] = "";
        this.commit();
      }).open();
    }));

    menu.showAtMouseEvent(evt);
  }

  private balMenu(evt: MouseEvent): void {
    const menu = new Menu();
    const used = Object.keys(this.data.balance);
    const avail = this.plugin.settings.balancePool.filter(k => !used.includes(k));

    for (const k of avail) {
      menu.addItem(item => item.setTitle(k).onClick(() => {
        this.data.balance[k] = "";
        this.commit();
      }));
    }
    if (!avail.length) {
      menu.addItem(item => item.setTitle("指标都已添加").setDisabled(true));
    }
    menu.addSeparator();
    menu.addItem(item => item.setTitle("自定义指标…").onClick(() => {
      new PromptModal(this.plugin.app, "自定义平衡指标", (name) => {
        this.data.balance[name] = "";
        this.commit();
      }).open();
    }));

    menu.showAtMouseEvent(evt);
  }

  private statusMenu(evt: MouseEvent): void {
    const menu = new Menu();
    for (const s of STATUS_ORDER) {
      menu.addItem(item => item
        .setTitle(STATUS_LABEL[s])
        .setChecked(this.data.status === s)
        .onClick(() => {
          this.data.status = s;
          this.commit();
        }));
    }
    menu.showAtMouseEvent(evt);
  }
}

/* ============================================================
   插件
   ============================================================ */
export default class GDCardPlugin extends Plugin {
  settings: GDSettings = { ...DEFAULT_SETTINGS };

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new GDCardSettingTab(this.app, this));

    this.registerMarkdownCodeBlockProcessor("gdcard", (
      source: string,
      el: HTMLElement,
      ctx: MarkdownPostProcessorContext
    ) => {
      ctx.addChild(new CardBlock(this, ctx.sourcePath, source, el));
    });

    this.addRibbonIcon("file-plus", "GDCard：新建武器卡片", () => {
      void this.newCard();
    });

    this.addRibbonIcon("library", "GDCard：卡片库", () => this.openLibrary());

    this.addCommand({
      id: "new-weapon-card",
      name: "新建武器卡片",
      callback: () => void this.newCard(),
    });

    this.addCommand({
      id: "open-card-library",
      name: "打开卡片库",
      callback: () => this.openLibrary(),
    });

    this.addCommand({
      id: "batch-rename-cards",
      name: "批量按标题重命名所有卡片",
      callback: () => new BatchRenameModal(this.app, this.settings).open(),
    });
  }

  /* ---------------- 设置 ---------------- */

  async loadSettings(): Promise<void> {
    const raw: unknown = await this.loadData();
    const saved = (raw && typeof raw === "object" ? raw : {}) as Partial<GDSettings>;

    const text = (v: unknown, fallback: string): string =>
      typeof v === "string" && v.trim() ? v : fallback;
    /** 列表项只收字符串；keepEmpty 为 false 时，空列表回落到默认值 */
    const list = (v: unknown, fallback: string[], keepEmpty: boolean): string[] => {
      if (!Array.isArray(v)) return [...fallback];
      const arr: unknown[] = v;
      const out = arr.filter((x): x is string => typeof x === "string");
      return !out.length && !keepEmpty ? [...fallback] : out;
    };

    this.settings = {
      defaultOwner: text(saved.defaultOwner, DEFAULT_SETTINGS.defaultOwner),
      cardFolder: text(saved.cardFolder, DEFAULT_SETTINGS.cardFolder),
      defaultCategory: text(saved.defaultCategory, DEFAULT_SETTINGS.defaultCategory),
      librarySort: text(saved.librarySort, DEFAULT_SETTINGS.librarySort),
      requiredAttrs: list(saved.requiredAttrs, DEFAULT_SETTINGS.requiredAttrs, false),
      optionalAttrs: list(saved.optionalAttrs, DEFAULT_SETTINGS.optionalAttrs, true),
      balanceFixed: list(saved.balanceFixed, DEFAULT_SETTINGS.balanceFixed, false),
      balancePool: list(saved.balancePool, DEFAULT_SETTINGS.balancePool, true),
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /* ---------------- 新建卡片 ---------------- */

  async newCard(): Promise<void> {
    const folder = normalizePath(this.settings.cardFolder || "卡片");
    await this.ensureFolder(folder);

    // 文件名先叫「未命名卡片」，标题改完会自动改名；ID 留空，等定稿再填
    const base = "未命名卡片";
    let title = base;
    let n = 2;
    while (this.app.vault.getAbstractFileByPath(normalizePath(`${folder}/${title}.md`))) {
      title = `${base} ${n++}`;
    }

    const data = emptyCard(this.settings);
    const content = "```gdcard\n" + serializeCard(data, this.settings) + "\n```\n";
    const path = normalizePath(`${folder}/${title}.md`);

    let file: TFile;
    try {
      file = await this.app.vault.create(path, content);
    } catch {
      new Notice("GDCard：创建失败，可能已存在同名文件（" + title + "）");
      return;
    }

    await this.app.workspace.getLeaf(false).openFile(file);
    new Notice("GDCard：已新建卡片 · 改名可用命令「按标题重命名当前卡片文件」");
    this.focusTitle();
  }

  private focusTitle(): void {
    window.setTimeout(() => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      const el = view?.containerEl.querySelector<HTMLElement>(".gdcard .gd-title");
      el?.focus();
    }, 420);
  }

  private async ensureFolder(path: string): Promise<void> {
    const parts = path.split("/");
    let cur = "";
    for (const p of parts) {
      cur = cur ? `${cur}/${p}` : p;
      if (!this.app.vault.getAbstractFileByPath(cur)) {
        try {
          await this.app.vault.createFolder(cur);
        } catch {
          /* 已存在或并发创建，忽略 */
        }
      }
    }
  }

  /* ---------------- 写回 ---------------- */

  /** 先按路径找；路径失效（文件刚被改名）就按内容在卡片目录里找回 */
  async resolveCardFile(path: string, body: string): Promise<TFile | null> {
    const direct = this.app.vault.getAbstractFileByPath(path);
    if (direct instanceof TFile) return direct;

    const folder = normalizePath(this.settings.cardFolder);
    const matches: TFile[] = [];
    for (const f of this.app.vault.getFiles()) {
      if (f.extension !== "md") continue;
      if (!(f.path === folder || f.path.startsWith(folder + "/"))) continue;
      if (f.path === path) continue;
      const text = await this.app.vault.cachedRead(f);
      const block = extractCardBlock(text);
      if (block && block.trim() === body.trim()) matches.push(f);
      if (matches.length > 1) break; // 有歧义就不要猜
    }
    return matches.length === 1 ? matches[0] : null;
  }

  async writeCard(path: string, oldBody: string, newBody: string): Promise<TFile> {
    const file = await this.resolveCardFile(path, oldBody);
    if (!file) throw new Error("找不到这张卡片的文件，可能刚被改名或删除，重新打开笔记后再改");
    await this.app.vault.process(file, (text) =>
      replaceCardBlock(text, oldBody, newBody));
    return file;
  }

  openLibrary(): void {
    new LibraryModal(this.app, this).open();
  }
}

/* ============================================================
   设置页
   ============================================================ */

type SettingKey =
  | "defaultOwner"
  | "cardFolder"
  | "defaultCategory"
  | "requiredAttrs"
  | "optionalAttrs"
  | "balanceFixed"
  | "balancePool";

/** 设置项清单：声明式 API 和旧版 display() 共用，避免两处文案写岔 */
const SETTING_ROWS: Array<{
  group: string;
  key: SettingKey;
  name: string;
  desc: string;
  placeholder?: string;
}> = [
  {
    group: "卡片", key: "defaultOwner", name: "默认负责人",
    desc: "新建卡片时，右下角 @ 后面填的名字；之后也可以在卡片上直接改。",
    placeholder: "user",
  },
  {
    group: "卡片", key: "cardFolder", name: "卡片存放目录",
    desc: "新建卡片会放在这个目录下，卡片库也只扫这里。",
    placeholder: "卡片",
  },
  {
    group: "卡片", key: "defaultCategory", name: "默认分类",
    desc: "卡片右上角的分类文字，例如「武器/投射物」。",
  },
  {
    group: "字段", key: "requiredAttrs", name: "必有属性",
    desc: "固定显示、不可删除的属性名，逗号分隔。",
  },
  {
    group: "字段", key: "optionalAttrs", name: "可选属性池",
    desc: "点属性区 ＋ 时列出来的候选，逗号分隔。",
  },
  {
    group: "字段", key: "balanceFixed", name: "平衡必有指标",
    desc: "固定显示、不可删除的指标名，逗号分隔。",
  },
  {
    group: "字段", key: "balancePool", name: "平衡指标池",
    desc: "点平衡区 ＋ 时列出来的候选，逗号分隔。",
  },
];

class GDCardSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: GDCardPlugin) {
    super(app, plugin);
  }

  /* ---- 声明式设置（1.13.0+ 的设置搜索靠它） ---- */

  getSettingDefinitions(): SettingDefinitionItem[] {
    const group = (heading: string): SettingDefinitionItem => ({
      type: "group",
      heading,
      items: SETTING_ROWS.filter(r => r.group === heading).map(row => ({
        name: row.name,
        desc: row.desc,
        control: { type: "text", key: row.key, placeholder: row.placeholder },
      })),
    });
    return [group("卡片"), group("字段")];
  }

  /* ---- 读写：两个入口共用同一套规范化逻辑 ---- */

  private valueText(key: SettingKey): string {
    const s = this.plugin.settings;
    switch (key) {
      case "defaultOwner": return s.defaultOwner;
      case "cardFolder": return s.cardFolder;
      case "defaultCategory": return s.defaultCategory;
      case "requiredAttrs": return joinList(s.requiredAttrs);
      case "optionalAttrs": return joinList(s.optionalAttrs);
      case "balanceFixed": return joinList(s.balanceFixed);
      case "balancePool": return joinList(s.balancePool);
    }
  }

  getControlValue(key: string): unknown {
    return this.valueText(key as SettingKey);
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    const raw = typeof value === "string" ? value : "";
    const trimmed = raw.trim();
    const s = this.plugin.settings;
    switch (key) {
      case "defaultOwner":
        s.defaultOwner = trimmed || DEFAULT_SETTINGS.defaultOwner;
        break;
      case "cardFolder":
        s.cardFolder = trimmed || DEFAULT_SETTINGS.cardFolder;
        break;
      case "defaultCategory":
        s.defaultCategory = trimmed;
        break;
      // 必有项不能清空，留空就保持原值
      case "requiredAttrs": {
        const l = splitList(raw);
        if (l.length) s.requiredAttrs = l;
        break;
      }
      case "optionalAttrs":
        s.optionalAttrs = splitList(raw);
        break;
      case "balanceFixed": {
        const l = splitList(raw);
        if (l.length) s.balanceFixed = l;
        break;
      }
      case "balancePool":
        s.balancePool = splitList(raw);
        break;
      default:
        break;
    }
    await this.plugin.saveSettings();
  }

  /* ---- 旧版本（< 1.13.0）的渲染入口 ---- */

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    let heading = "";
    for (const row of SETTING_ROWS) {
      if (row.group !== heading) {
        heading = row.group;
        new Setting(containerEl).setName(heading).setHeading();
      }
      new Setting(containerEl)
        .setName(row.name)
        .setDesc(row.desc)
        .addText(t => t
          .setPlaceholder(row.placeholder ?? "")
          .setValue(this.valueText(row.key))
          .onChange(v => void this.setControlValue(row.key, v)));
    }
  }
}
