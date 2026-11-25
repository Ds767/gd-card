import fs from "fs";
import path from "path";
import { DEFAULT_SETTINGS, parseCard, serializeCard } from "../src/data";

const S = { ...DEFAULT_SETTINGS, defaultOwner: "user" };

const cards = [
  {
    id: "Weapon-001", name: "基本手枪", rare: "1", owner: "user", status: "wip",
    created: "2026-11-20 15:30",
    attrs: { damage: "5", attack_interval: "2", projectile_speed: "5", max_range: "5" },
    optional: {},
    lore: "战5渣",
    vfx: "发射基础子弹，弹道直线",
    role: "初始默认武器\n教学使用\n可通过叠加属性伤害道具、攻速、子弹数量等道具，实现伤害飞跃",
    counter: "",
    synergy: "和[[火焰喷射器]]是同一套灼烧体系：叠到 3 层后，基础弹的直伤才追得上连发",
    balance: { "期望DPS": "2-3", "强度": "D" },
    note: "战五渣DPS没有5很合理",
  },
  {
    id: "Weapon-002", name: "连发短铳", rare: "2", owner: "lin", status: "done",
    created: "2026-11-21 10:12",
    attrs: { damage: "3", attack_interval: "0.4", projectile_speed: "9", max_range: "4" },
    optional: { spread: "12", projectile_count: "3" },
    lore: "三连发的贴脸火力",
    vfx: "枪口三连闪，带短促后坐",
    role: "中距离压制\n靠弹幕密度封走位",
    counter: "高护甲单位",
    synergy: "靠[[弹幕扩容]]撑密度；贴脸时换[[火焰喷射器]]补火",
    balance: { "期望DPS": "6-8", "强度": "B" },
    note: "",
  },
  {
    id: "Weapon-003", name: "火焰喷射器", rare: "3", owner: "user", status: "done",
    created: "2026-11-22 16:40",
    attrs: { damage: "2", attack_interval: "0.15", projectile_speed: "4", max_range: "2.5" },
    optional: { aoe_radius: "1.2", resource_cost: "4" },
    lore: "把整条走廊烧开的那三秒",
    vfx: "锥形火焰粒子，地面留余烬",
    role: "近距离清场\n持续灼烧叠加",
    counter: "远程风筝、水系免疫",
    synergy: "[[燃烧强化]]是它的核心乘区，没点火器就别带",
    balance: { "期望DPS": "9-11", "强度": "A" },
    note: "灼烧 DOT 与直伤需分两列记录",
  },
  {
    id: "Weapon-004", name: "蓄力长枪", rare: "2", owner: "user", status: "idea",
    created: "2026-11-23 09:05",
    attrs: { damage: "18", attack_interval: "1.6", projectile_speed: "12", max_range: "9" },
    optional: { pierce: "2", reload_time: "2.2" },
    lore: "按住越久，穿得越深",
    vfx: "蓄力时准星收缩、枪身发光",
    role: "远距离点杀\n蓄满可穿两人",
    counter: "",
    synergy: "",
    balance: { "期望DPS": "4-6", "强度": "B", "上限伤害": "18" },
    note: "未定：蓄力是否可中断",
  },
  {
    id: "Weapon-005", name: "老旧左轮", rare: "1", owner: "lin", status: "dropped",
    created: "2026-11-19 21:18",
    attrs: { damage: "7", attack_interval: "0.9", projectile_speed: "8", max_range: "5" },
    optional: { reload_time: "2.5" },
    lore: "第六发总是空着",
    vfx: "左轮转动特写",
    role: "早期替代方案",
    counter: "",
    synergy: "",
    balance: { "期望DPS": "5-6", "强度": "C" },
    note: "手感与基本手枪重叠，已废弃",
  },
];

const outDir = path.join("sample", "卡片");
fs.mkdirSync(outDir, { recursive: true });

for (const c of cards) {
  const data = parseCard(serializeCard({ ...c, type: "weapon", cat: "武器/投射物" } as any, S), S);
  const body = serializeCard(data, S);
  const content = "```gdcard\n" + body + "\n```\n";
  fs.writeFileSync(path.join(outDir, `${c.name}.md`), content, "utf8");
}

console.log("sample cards:", cards.length);
