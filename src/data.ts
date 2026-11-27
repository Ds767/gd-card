import { parseYaml, stringifyYaml } from "obsidian";

export type Status = "wip" | "done" | "idea" | "dropped";

export const STATUS_LABEL: Record<Status, string> = {
  wip: "开发中",
  done: "已实装",
  idea: "仅创意",
  dropped: "废弃",
};

export const STATUS_ORDER: Status[] = ["wip", "done", "idea", "dropped"];

export interface CardData {
  type: string;
  id: string;
  name: string;
  cat: string;
  rare: string;
  owner: string;
  status: Status;
  created: string;
  /** 必有属性，按 settings.requiredAttrs 的顺序展示 */
  attrs: Record<string, string>;
  /** 可选属性，添加顺序即展示顺序 */
  optional: Record<string, string>;
  lore: string;
  vfx: string;
  role: string;
  counter: string;
  /** 联动：一段正文，[[卡片名]] 视为内链 */
  synergy: string;
  balance: Record<string, string>;
  note: string;
}

export interface GDSettings {
  /** 卡片右下角默认负责人 */
  defaultOwner: string;
  /** 卡片存放目录 */
  cardFolder: string;
  /** 新建卡片时的默认分类 */
  defaultCategory: string;
  /** 卡片库排序方式 */
  librarySort: string;
  requiredAttrs: string[];
  optionalAttrs: string[];
  balanceFixed: string[];
  balancePool: string[];
}

export const DEFAULT_SETTINGS: GDSettings = {
  defaultOwner: "user",
  cardFolder: "卡片",
  defaultCategory: "武器/投射物",
  librarySort: "mtime-desc",
  requiredAttrs: ["damage", "attack_interval", "projectile_speed", "max_range"],
  optionalAttrs: [
    "reload_time", "pierce", "resource_cost", "spread",
    "aoe_radius", "homing", "gravity", "projectile_count",
  ],
  balanceFixed: ["期望DPS", "强度"],
  balancePool: ["TTK", "容错率", "上手难度", "资源消耗", "成长性", "上限伤害"],
};

export const CARD_TYPE = "weapon";

/* ---------------- 小工具 ---------------- */

export function nowStamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function splitList(v: string): string[] {
  return v.split(/[,，;；\n]/).map(s => s.trim()).filter(Boolean);
}
export function joinList(v: string[]): string {
  return (v || []).join(", ");
}

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

function toStatus(v: unknown): Status {
  const s = str(v) as Status;
  return STATUS_ORDER.includes(s) ? s : "wip";
}

/* ---------------- 解析 / 序列化 ---------------- */

export function parseCard(src: string, s: GDSettings): CardData {
  let raw: Record<string, unknown> = {};
  try {
    raw = obj(parseYaml(src));
  } catch {
    raw = {};
  }

  const gp = obj(raw.gameplay);
  const rawAttrs = obj(raw.attrs);
  const rawOptional = obj(raw.optional);

  // 必有属性：按设置的顺序取，缺失的补空
  const attrs: Record<string, string> = {};
  for (const k of s.requiredAttrs) attrs[k] = str(rawAttrs[k]);
  // 数据里多出来的 attr 不丢，挪到可选属性
  const optional: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawOptional)) optional[k] = str(v);
  for (const [k, v] of Object.entries(rawAttrs)) {
    if (!(k in attrs)) optional[k] = str(v);
  }

  const balance: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj(gp.balance))) balance[k] = str(v);
  for (const k of s.balanceFixed) if (!(k in balance)) balance[k] = "";

  return {
    type: str(raw.type) || CARD_TYPE,
    id: str(raw.id),
    name: str(raw.name),
    cat: str(raw.cat) || s.defaultCategory,
    rare: str(raw.rare) || "1",
    owner: str(raw.owner) || s.defaultOwner,
    status: toStatus(raw.status),
    created: str(raw.created) || nowStamp(),
    attrs,
    optional,
    lore: str(raw.lore),
    vfx: str(raw.vfx),
    role: str(gp.role),
    counter: str(gp.counter),
    synergy: str(gp.synergy),
    balance,
    note: str(raw.note),
  };
}

const NUM_RE = /^-?\d+(\.\d+)?$/;

/** 纯数字的值写成数字，YAML 更干净（damage: 5 而不是 '5'） */
function coerce(v: string): string | number {
  const t = String(v ?? "").trim();
  return t !== "" && NUM_RE.test(t) ? Number(t) : v;
}

export function serializeCard(d: CardData, s: GDSettings): string {
  const attrs: Record<string, string | number> = {};
  for (const k of attrOrder(d, s)) attrs[k] = coerce(d.attrs[k] ?? "");
  for (const [k, v] of Object.entries(d.attrs)) if (!(k in attrs)) attrs[k] = coerce(v);

  const optional: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(d.optional ?? {})) optional[k] = coerce(v);

  const balance: Record<string, string | number> = {};
  for (const k of balanceOrder(d, s)) balance[k] = coerce(d.balance[k] ?? "");
  for (const [k, v] of Object.entries(d.balance)) if (!(k in balance)) balance[k] = coerce(v);

  const yaml = stringifyYaml({
    type: d.type || CARD_TYPE,
    id: d.id,
    name: d.name,
    cat: d.cat,
    rare: coerce(d.rare),
    owner: d.owner,
    status: d.status,
    created: d.created,
    attrs,
    optional,
    lore: d.lore,
    vfx: d.vfx,
    gameplay: {
      role: d.role,
      counter: d.counter,
      synergy: d.synergy,
      balance,
    },
    note: d.note,
  });
  return yaml.replace(/\n+$/, "");
}

export function emptyCard(s: GDSettings): CardData {
  const attrs: Record<string, string> = {};
  for (const k of s.requiredAttrs) attrs[k] = "";
  const balance: Record<string, string> = {};
  for (const k of s.balanceFixed) balance[k] = "";
  return {
    type: CARD_TYPE,
    id: "",
    name: "",
    cat: s.defaultCategory,
    rare: "1",
    owner: s.defaultOwner,
    status: "wip",
    created: nowStamp(),
    attrs,
    optional: {},
    lore: "",
    vfx: "",
    role: "",
    counter: "",
    synergy: "",
    balance,
    note: "",
  };
}

/** 文件名清洗：去掉会破坏路径和 [[双链]] 的字符 */
export function sanitizeFileName(name: string): string {
  return String(name || "")
    .replace(/[\\/:*?"<>|#^[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.+$/, "")
    .slice(0, 80)
    .trim();
}

/** 必有属性的展示顺序：设置里的顺序优先，数据里多出来的排后面 */
export function attrOrder(d: CardData, s: GDSettings): string[] {
  const keys = [...s.requiredAttrs];
  for (const k of Object.keys(d.attrs)) if (!keys.includes(k)) keys.push(k);
  return keys;
}

/** 平衡指标顺序：必有指标在前，其余按添加顺序 */
export function balanceOrder(d: CardData, s: GDSettings): string[] {
  const fixed = [...s.balanceFixed];
  const extra = Object.keys(d.balance).filter(k => !s.balanceFixed.includes(k));
  return [...fixed, ...extra];
}

/** 卡片是否“空”（平衡区全空用于标题弱化） */
export function balanceIsEmpty(d: CardData, s: GDSettings): boolean {
  return !balanceOrder(d, s).some(k => String(d.balance[k] ?? "").trim());
}
