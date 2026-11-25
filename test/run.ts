import { DEFAULT_SETTINGS, parseCard, serializeCard, emptyCard, attrOrder, balanceOrder, balanceIsEmpty, sanitizeFileName } from "../src/data";
import { cardHTML, refreshWeak, richHTML } from "../src/card";
import { replaceCardBlock, extractCardBlock, findCardBlocks } from "../src/block";

const S = DEFAULT_SETTINGS;
const results: string[] = [];
const ok = (name: string, cond: boolean, extra?: unknown) =>
  results.push(`${cond ? "PASS" : "FAIL"} | ${name}${extra !== undefined ? " | " + extra : ""}`);

const SRC = `id: Weapon-001
name: 基本手枪
cat: 武器/投射物
rare: 1
owner: user
status: wip
created: 2026-11-20 15:30
attrs:
  damage: 5
  attack_interval: 2
  projectile_speed: 5
  max_range: 5
optional:
  pierce: 2
lore: 战5渣
vfx: 发射基础子弹，弹道直线
gameplay:
  role: |-
    初始默认武器
    教学使用
  counter: ""
  synergy: 和[[火焰附魔]]最搭
  balance:
    期望DPS: 2-3
    强度: D
note: 战五渣DPS没有5很合理`;

const d = parseCard(SRC, S);
ok("parse id", d.id === "Weapon-001", d.id);
ok("parse name", d.name === "基本手枪");
ok("parse attrs order", attrOrder(d, S).join(",") === "damage,attack_interval,projectile_speed,max_range");
ok("parse optional", d.optional.pierce === "2");
ok("parse multiline role", d.role.includes("教学使用"), JSON.stringify(d.role));
ok("parse synergy", d.synergy === "和[[火焰附魔]]最搭");
ok("parse balance", d.balance["期望DPS"] === "2-3" && d.balance["强度"] === "D");
ok("balance order", balanceOrder(d, S).join(",") === "期望DPS,强度");
ok("balance not empty", !balanceIsEmpty(d, S));

// 往返
const out = serializeCard(d, S);
const d2 = parseCard(out, S);
ok("roundtrip equal", JSON.stringify(d2) === JSON.stringify(d), out.slice(0, 40));

// 空卡片
const e = emptyCard(S);
ok("empty id blank", e.id === "", JSON.stringify(e.id));
ok("empty has required keys", Object.keys(e.attrs).length === 4 && Object.values(e.attrs).every(v => v === ""));
ok("empty owner from settings", e.owner === "user");
ok("empty balance keys", Object.keys(e.balance).length === 2);
ok("empty balance weak", balanceIsEmpty(e, S));
ok("empty created stamp", /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(e.created), e.created);

// 设置里的默认负责人会生效
const S2 = { ...S, defaultOwner: "阿伟" };
const d3 = parseCard("id: Weapon-002\nname: 测试", S2);
ok("default owner applied", d3.owner === "阿伟", d3.owner);

// HTML
const html = cardHTML(d, S, true);
ok("html has 9 headings",
  ["属性", "Lore", "特效", "游戏性", "玩法定位", "反制", "联动", "平衡", "Note"]
    .every(t => html.includes(`>${t}<`)));
ok("html required keys", ["damage", "attack_interval", "projectile_speed", "max_range"].every(k => html.includes(`>${k}<`)));
ok("html fixed balance keys", html.includes("期望DPS") && html.includes("强度"));
ok("html status class", html.includes("gd-st-wip"));
ok("html editable", html.includes('contenteditable="true"'));
ok("html created", html.includes("2026-11-20 15:30"));
ok("html wiki link", html.includes('class="gd-wiki" data-href="火焰附魔"'));
ok("html plus buttons", (html.match(/gd-plus/g) || []).length >= 2);

const roHtml = cardHTML(d, S, false);
ok("readonly no editable", !roHtml.includes('contenteditable="true"'));
ok("readonly no plus", !roHtml.includes("gd-plus"));
ok("readonly no del", !roHtml.includes("gd-del"));

// XSS 转义
const x = parseCard('id: X\nname: "<img src=x onerror=1>"', S);
ok("escapes html", !cardHTML(x, S, true).includes("<img src=x"));

// 内链
ok("rich escapes + links", richHTML('a <b> [[卡片]]').includes("&lt;b&gt;") && richHTML("[[卡片]]").includes("data-href=\"卡片\""));

// 空标题弱化
ok("empty section class", cardHTML(e, S, true).includes("gd-sec-empty"));

// 代码块
const note = "前言\n\n```gdcard\n" + SRC + "\n```\n\n后记\n";
const blocks = findCardBlocks(note);
ok("find one block", blocks.length === 1, blocks.length);
ok("extract body", extractCardBlock(note)!.includes("Weapon-001"));
const replaced = replaceCardBlock(note, SRC, "id: Weapon-777");
ok("replace body", replaced.includes("id: Weapon-777") && !replaced.includes("Weapon-001"));
ok("replace keeps fences", (replaced.match(/```gdcard/g) || []).length === 1 && replaced.includes("后记"));

// 两个块时只改匹配的那个
const two = "```gdcard\nid: A\n```\n\n```gdcard\nid: B\n```\n";
const r2 = replaceCardBlock(two, "id: B", "id: B2");
ok("replace right block", r2.includes("id: A") && r2.includes("id: B2") && !r2.includes("id: B\n"));

// 波浪线围栏
const tilde = "~~~gdcard\nid: T\n~~~\n";
ok("tilde fence", (findCardBlocks(tilde)[0]?.body || "").trim() === "id: T");

ok("sanitize keeps cjk", sanitizeFileName("基本 手枪") === "基本 手枪");
ok("sanitize strips slash", sanitizeFileName("a/b:c*d?").indexOf("/") < 0 && sanitizeFileName("a/b:c*d?").indexOf(":") < 0, sanitizeFileName("a/b:c*d?"));
ok("sanitize strips brackets", sanitizeFileName("[[火焰附魔]]") === "火焰附魔", sanitizeFileName("[[火焰附魔]]"));
ok("sanitize trims dots", sanitizeFileName("名字...") === "名字", sanitizeFileName("名字..."));

console.log(results.join("\n"));
console.log("---");
console.log("FAIL count:", results.filter(r => r.startsWith("FAIL")).length);
