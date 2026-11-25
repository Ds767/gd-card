import fs from "fs";
import { DEFAULT_SETTINGS, parseCard, serializeCard, emptyCard } from "../src/data";
import { cardHTML, refreshWeak } from "../src/card";

const S = DEFAULT_SETTINGS;

const full = `id: Weapon-001
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
    可通过叠加属性伤害道具、攻速、子弹数量等道具，实现伤害飞跃
  counter: ""
  synergy: 和[[火焰附魔]]最搭：叠到 3 层灼烧后，基础弹的直伤才追得上连发
  balance:
    期望DPS: 2-3
    强度: D
note: 战五渣DPS没有5很合理`;

const bare = serializeCard(emptyCard(S), S);

const cardA = cardHTML(parseCard(full, S), S, true);
const cardB = cardHTML(parseCard(bare, S), S, true);
const cardC = cardHTML(parseCard(full, S), S, false);

const css = fs.readFileSync("styles.css", "utf8");

const themeLight = `
.theme-light{
  --background-primary:#ffffff;
  --background-secondary:#f7f7f7;
  --text-normal:#2e3338; --text-muted:#7d8590; --text-faint:#b3b3b3;
  --background-modifier-border:#e3e3e3; --background-modifier-hover:rgba(0,0,0,.055);
  --interactive-accent:#7856ff; --text-error:#e93147;
  --color-orange:#e9973f; --color-green:#44915f; --color-purple:#8b6cf0;
  --font-text:"Inter","PingFang SC","Microsoft YaHei",system-ui,sans-serif;
  --font-monospace:"JetBrains Mono",Consolas,monospace;
  --font-text-size:16px;
  background:#f7f7f7; color:#2e3338;
}`;

const themeDark = `
.theme-dark{
  --background-primary:#1e1e1e;
  --background-secondary:#262626;
  --text-normal:#dadada; --text-muted:#a3a3a3; --text-faint:#666;
  --background-modifier-border:#3a3a3a; --background-modifier-hover:rgba(255,255,255,.07);
  --interactive-accent:#a68aff; --text-error:#fb464c;
  --color-orange:#e9973f; --color-green:#44cf6e; --color-purple:#b3a0f5;
  --font-text:"Inter","PingFang SC","Microsoft YaHei",system-ui,sans-serif;
  --font-monospace:"JetBrains Mono",Consolas,monospace;
  --font-text-size:16px;
  background:#1e1e1e; color:#dadada;
}`;

const page = (theme: string, body: string) => `<!doctype html><html><head><meta charset="utf-8">
<style>
${themeLight}
${themeDark}
body{ margin:0; padding:24px; font-family:var(--font-text); }
.row{display:flex; gap:28px; align-items:flex-start; flex-wrap:wrap; justify-content:center}
.col{width:640px; flex:0 0 auto}
.cap{font:11px monospace; color:#888; margin-bottom:8px}
${css}
</style></head>
<body class="${theme}">${body}</body></html>`;

fs.writeFileSync("test/preview-light.html", page("theme-light", `
<div class="row">
  <div class="col"><div class="cap">有内容的卡片（可编辑态）</div><div class="gdcard">${cardA}</div></div>
  <div class="col"><div class="cap">空卡片（可编辑态）</div><div class="gdcard">${cardB}</div></div>
</div>
<div class="row" style="margin-top:24px">
  <div class="col"><div class="cap">卡片库里的只读卡片</div><div class="gdcard gd-static">${cardC}</div></div>
</div>`));

fs.writeFileSync("test/preview-dark.html", page("theme-dark", `
<div class="row">
  <div class="col"><div class="cap">dark</div><div class="gdcard">${cardA}</div></div>
</div>`));

console.log("preview written");
