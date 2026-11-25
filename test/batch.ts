import { buildRenamePlan } from "../src/batchRename";
import { DEFAULT_SETTINGS } from "../src/data";

const S = DEFAULT_SETTINGS;

/** 造一篇卡片笔记（直接写 YAML，不绕 serializeCard） */
function card(name: string) {
  return "```gdcard\n" + [
    "type: weapon",
    "id: ''",
    `name: ${JSON.stringify(name)}`,
    "cat: 武器/投射物",
    "rare: 1",
    "owner: user",
    "status: wip",
    "created: 2026-11-20 10:00",
    "attrs:",
    "  damage: 1",
    "  attack_interval: 1",
    "  projectile_speed: 1",
    "  max_range: 1",
    "optional: {}",
    "lore: ''",
    "vfx: ''",
    "gameplay:",
    "  role: ''",
    "  counter: ''",
    "  synergy: ''",
    "  balance:",
    "    期望DPS: ''",
    "    强度: ''",
    "note: ''",
  ].join("\n") + "\n```\n";
}

const FILES = [
  { path: "卡片/未命名卡片.md", basename: "未命名卡片", text: card("基本手枪") },
  { path: "卡片/Weapon-002.md", basename: "Weapon-002", text: card("连发短铳") },
  { path: "卡片/已经对了.md", basename: "已经对了", text: card("已经对了") },
  { path: "卡片/空标题.md", basename: "空标题", text: card("") },
  { path: "卡片/重名A.md", basename: "重名A", text: card("同名卡") },
  { path: "卡片/重名B.md", basename: "重名B", text: card("同名卡") },
  { path: "卡片/占位.md", basename: "占位", text: card("连发短铳") },
  // 以下都不应被列入
  { path: "卡片/普通笔记.md", basename: "普通笔记", text: "# 随手写的\n没有卡片块" },
  { path: "日记/2026-11-25.md", basename: "2026-11-25", text: card("不该被改") },
  { path: "根目录卡片.md", basename: "根目录卡片", text: card("也不该被改") },
];

function makeApp() {
  const files = FILES.map(f => {
    const file: any = {
      path: f.path,
      basename: f.basename,
      extension: "md",
      parent: { path: f.path.split("/").slice(0, -1).join("/") },
    };
    return { file, text: f.text };
  });
  const byPath = new Map(files.map(x => [x.file.path, x]));
  return {
    vault: {
      getFiles: () => files.map(x => x.file),
      cachedRead: async (f: any) => byPath.get(f.path)?.text ?? "",
      getAbstractFileByPath: (p: string) => byPath.get(p)?.file ?? null,
    },
  } as any;
}

const out: string[] = [];
const ok = (n: string, c: boolean, x?: unknown) =>
  out.push(`${c ? "PASS" : "FAIL"} | ${n}${x !== undefined ? " | " + x : ""}`);

const plan = await buildRenamePlan(makeApp(), S);
const find = (from: string) => plan.find(p => p.from === from);

ok("只扫卡片块", plan.length === 7, plan.length);
ok("目录外的卡不进来", !plan.some(p => p.from === "2026-11-25"));
ok("根目录的卡不进来", !plan.some(p => p.from === "根目录卡片"));
ok("普通笔记被跳过", !plan.some(p => p.from === "普通笔记"));

ok("未命名→基本手枪", find("未命名卡片")?.status === "rename" && find("未命名卡片")?.to === "基本手枪");
ok("Weapon-002→连发短铳", find("Weapon-002")?.status === "rename" && find("Weapon-002")?.to === "连发短铳");
ok("已是标题的标记 same", find("已经对了")?.status === "same");
ok("空标题跳过", find("空标题")?.status === "skip" && find("空标题")?.reason === "标题为空");
ok("重名 A 可改", find("重名A")?.status === "rename");
ok("重名 B 冲突", find("重名B")?.status === "conflict", find("重名B")?.reason);
ok("目标已存在则冲突", find("占位")?.status === "conflict", find("占位")?.reason);
ok("改名留在原目录", find("Weapon-002")?.targetPath === "卡片/连发短铳.md", find("Weapon-002")?.targetPath);

console.log(out.join("\n"));
console.log("---");
console.log("FAIL count:", out.filter(r => r.startsWith("FAIL")).length);
