import { CardData, GDSettings, STATUS_LABEL, attrOrder, balanceOrder, balanceIsEmpty } from "./data";

const ESC: Record<string, string> = {
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
};

export function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, c => ESC[c]);
}

/** 联动段落：普通正文，[[卡片名]] 高亮成内链 */
export function richHTML(raw: string): string {
  return esc(raw).replace(/\[\[([^[\]]+)\]\]/g, (_m, label: string) =>
    `<a class="gd-wiki" data-href="${label}">${label}</a>`);
}

interface KVOpts {
  editable: boolean;
  /** 挂在哪：必有属性 data-attr，平衡 data-bal，可选属性 data-attr + data-del */
  vAttr?: string;
  del?: string;
  vPh?: string;
}

function kv(k: string, v: string, o: KVOpts): string {
  const ce = o.editable ? ' contenteditable="true" spellcheck="false"' : "";
  const ph = o.editable && o.vPh ? ` data-ph="${esc(o.vPh)}"` : "";
  const del = o.del ? `<button class="gd-del" ${o.del} title="移除">×</button>` : "";
  return `<div class="gd-kv">` +
    `<span class="gd-k">${esc(k)}</span>` +
    `<span class="gd-eq">=</span>` +
    `<span class="gd-v"${ce}${ph}${o.vAttr || ""}>${esc(v)}</span>` +
    del +
    `</div>`;
}

function addRow(act: string, cls: string, title: string, editable: boolean): string {
  if (!editable) return "";
  return `<div class="gd-addrow ${cls}">` +
    `<button class="gd-plus" data-act="${act}" aria-label="${esc(title)}" title="${esc(title)}">+</button>` +
    `</div>`;
}

export function cardHTML(d: CardData, s: GDSettings, editable: boolean): string {
  const ce = editable ? ' contenteditable="true" spellcheck="false"' : "";
  const ph = (t: string) => (editable ? ` data-ph="${esc(t)}"` : "");

  /* ---- 属性 ---- */
  const reqHTML = attrOrder(d, s).map(k =>
    kv(k, d.attrs[k] ?? "", { editable, vAttr: ` data-attr="${esc(k)}"`, vPh: "值" })
  ).join("");

  const optEntries = Object.entries(d.optional || {});
  const optHTML = optEntries.length
    ? `<div class="gd-grid gd-cols2 gd-optgrid">` + optEntries.map(([k, v]) =>
        kv(k, v, {
          editable,
          vAttr: ` data-attr="${esc(k)}"`,
          vPh: "值",
          del: editable ? `data-del="${esc(k)}"` : "",
        })
      ).join("") + `</div>`
    : "";

  /* ---- 文本段 ---- */
  const textSec = (title: string, field: keyof CardData) => {
    const val = String(d[field] ?? "");
    const cls = val.trim() ? "gd-sec" : "gd-sec gd-sec-empty";
    return `<section class="${cls}" data-sec="text"><h2 class="gd-h">${title}</h2>` +
      `<p class="gd-text"${ce} data-field="${field}"${ph("点击填写")}>${esc(val)}</p>` +
    `</section>`;
  };

  /* ---- 游戏性 ---- */
  const sub = (title: string, cls: string, body: string) =>
    `<div class="gd-sub ${cls}"><h3>${title}</h3>${body}</div>`;

  const roleHTML = `<div class="gd-p"${ce} data-field="role"${ph("点击填写")}>${esc(d.role)}</div>`;
  const counterHTML = `<div class="gd-p"${ce} data-field="counter"${ph("点击填写")}>${esc(d.counter)}</div>`;
  const synHTML =
    `<div class="gd-p gd-rich"${editable ? ' data-linkedit="1"' : ""} data-field="synergy"` +
      `${ph("写说明，[[卡片名]] 可跳转")}>${d.synergy ? richHTML(d.synergy) : ""}</div>`;

  const balKeys = balanceOrder(d, s);
  const balHTML = `<div class="gd-grid gd-cols2 gd-bal">` + balKeys.map(k => {
    const fixed = s.balanceFixed.includes(k);
    return kv(k, d.balance[k] ?? "", {
      editable,
      vAttr: ` data-bal="${esc(k)}"`,
      vPh: "值",
      del: editable && !fixed ? `data-delbal="${esc(k)}"` : "",
    });
  }).join("") + `</div>`;

  const gameplayEmpty = !d.role.trim() && !d.counter.trim() && !d.synergy.trim() && balanceIsEmpty(d, s);
  const gameplay =
    `<section class="gd-sec${gameplayEmpty ? " gd-sec-empty" : ""}" data-sec="gameplay">` +
      `<h2 class="gd-h gd-h-lg">游戏性</h2>` +
      sub("玩法定位", d.role ? "" : "gd-empty", roleHTML) +
      sub("反制", d.counter ? "" : "gd-empty", counterHTML) +
      sub("联动", d.synergy ? "" : "gd-empty", synHTML) +
      sub("平衡", balanceIsEmpty(d, s) ? "gd-empty" : "", balHTML + addRow("add-bal", "gd-addrow-bal", "添加平衡指标", editable)) +
    `</section>`;

  /* ---- 头部 / 页脚 ---- */
  const statusLabel = STATUS_LABEL[d.status] || STATUS_LABEL.wip;

  return (
    `<header class="gd-head">` +
      `<div class="gd-row1">` +
        `<span class="gd-id"${ce} data-field="id"${ph("未填 ID")}>${esc(d.id)}</span>` +
        `<span class="gd-rare">rare=<span class="gd-rare-v"${ce} data-field="rare">${esc(d.rare)}</span></span>` +
      `</div>` +
      `<div class="gd-row2">` +
        `<h1 class="gd-title"${ce} data-field="name"${ph("未命名卡片")}>${esc(d.name)}</h1>` +
        `<span class="gd-cat"${ce} data-field="cat">${esc(d.cat)}</span>` +
      `</div>` +
    `</header>` +

    `<section class="gd-sec"><h2 class="gd-h">属性</h2>` +
      `<div class="gd-grid gd-cols2">${reqHTML}</div>` +
      optHTML +
      addRow("add-opt", "", "添加可选属性", editable) +
    `</section>` +

    textSec("Lore", "lore") +
    textSec("特效", "vfx") +
    gameplay +
    textSec("Note", "note") +

    `<footer class="gd-foot">` +
      `<span class="gd-created"><i>创建</i>` +
        `<span class="gd-created-v"${ce} data-field="created"${ph("未记录")}>${esc(d.created)}</span></span>` +
      `<span class="gd-foot-right">` +
        (editable
          ? `<button class="gd-status gd-st-${d.status}" data-act="status"><span class="gd-dot"></span>` +
            `<span class="gd-st-label">${statusLabel}</span><span class="gd-car">▾</span></button>`
          : `<span class="gd-status gd-st-${d.status}"><span class="gd-dot"></span>` +
            `<span class="gd-st-label">${statusLabel}</span></span>`) +
        `<span class="gd-owner"${ce} data-field="owner">@${esc(d.owner)}</span>` +
      `</span>` +
    `</footer>`
  );
}

/** 空内容的标题变浅 */
export function refreshWeak(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>(".gd-sub").forEach(sub => {
    const hasText = Array.from(sub.querySelectorAll<HTMLElement>(".gd-p, .gd-text, [data-bal]"))
      .some(el => (el.textContent || "").trim().length > 0);
    sub.classList.toggle("gd-empty", !hasText);
  });

  root.querySelectorAll<HTMLElement>('.gd-sec[data-sec="text"]').forEach(sec => {
    const el = sec.querySelector<HTMLElement>(".gd-text");
    sec.classList.toggle("gd-sec-empty", !el || !(el.textContent || "").trim());
  });

  const gp = root.querySelector<HTMLElement>('.gd-sec[data-sec="gameplay"]');
  if (gp) {
    const subs = Array.from(gp.querySelectorAll<HTMLElement>(".gd-sub"));
    gp.classList.toggle("gd-sec-empty", subs.length > 0 && subs.every(s => s.classList.contains("gd-empty")));
  }
}
