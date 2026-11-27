# GDCard

One note = one game-design card. GDCard gives weapons, items and characters a fixed
layout — attributes, lore, VFX, gameplay role / counter / synergy, balance numbers,
dev status — and makes every field editable in place. Empty sections fade but never
collapse, so you can see at a glance what is still missing.

Cards are plain Markdown with a fenced `gdcard` YAML block, so they stay readable,
diffable and grep-able without the plugin.

---

## Features

- **Card block** — a ```` ```gdcard ```` code block renders as a card in reading view.
- **Edit in place** — click any field and type; changes are written back to the note.
- **Attribute pools** — fixed attributes plus an optional pool you can add from with `＋`.
- **Wikilinks inside cards** — `[[Card name]]` in the synergy section becomes a clickable link.
- **Card library** — grid of all cards in your card folder, filter by status, sort by
  modified / created / rarity / name / status.
- **Batch rename** — rename card files from their card title, with a confirmation list.
- **Configurable fields** — required attributes, optional pool, balance metrics and
  default folder / owner / category live in the plugin settings.

## Installation

### Manual

1. Copy the `gd-card` folder into `<your vault>/.obsidian/plugins/gd-card/`.
2. Reload Obsidian.
3. Settings → Community plugins → enable **GDCard**.

The folder name must match the `id` in `manifest.json`.

### From source

```bash
npm install
npm run build     # outputs main.js
```

Then copy `main.js`, `manifest.json` and `styles.css` into
`<your vault>/.obsidian/plugins/gd-card/`.

## Usage

**New card**: ribbon `＋` icon, or the command `GDCard: New weapon card`.
A note named `未命名卡片.md` is created inside the card folder with the required
attribute keys already in place; the title is a grey placeholder — just start typing.

**File name and card ID are independent.** A new card is called "未命名卡片" and its
ID stays empty; changing the ID does not rename the file.

**Rename to match the title**: command `GDCard: Batch rename all cards by title`. It
lists every `current → new` pair first, you tick the ones to apply, and Obsidian
updates the `[[wikilinks]]` pointing at them. You can also rename by hand in the file
explorer.

**Editing**: almost every piece of text on the card can be edited in place.

| Where | What you can change |
| --- | --- |
| Top-left `Weapon-001` | card ID — free-form, may stay empty, does not affect the file name |
| Top-right `rare=1` | rarity value |
| Title / `武器/投射物` | name (= file name once renamed) / category |
| Attributes | required attributes: value only; `＋` adds one from the pool, hover to remove |
| Lore / VFX / Note | multi-line text |
| Role / Counter | multi-line text |
| Synergy | plain paragraph; `[[Card name]]` is highlighted as a link — click the paragraph to edit raw text, click outside to restore highlights |
| Balance | `期望DPS` and `强度` are fixed metrics; `＋` adds from the pool, removable |
| Bottom-right | status dropdown (in progress / shipped / idea / dropped) and `@owner` |
| Bottom-left | creation time, filled automatically, editable |

**Card library**: ribbon library icon, or the command `GDCard: Open card library`.
Shows every card in the card folder as a grid, filterable by status and sortable by
last modified / created / rarity / name / status.

## Settings

Settings → Community plugins → GDCard:

- **Default owner** — the name after `@` on new cards (default `user`)
- **Card folder** — default `卡片`; the library only scans this folder
- **Default category** — default `武器/投射物`
- **Required attributes** — fixed, non-removable attribute names
  (default `damage, attack_interval, projectile_speed, max_range`)
- **Optional attribute pool** — candidates listed by `＋` in the attributes section
- **Fixed balance metrics** — fixed, non-removable metrics (default `期望DPS, 强度`)
- **Balance metric pool** — candidates listed by `＋` in the balance section

Changing *required attributes* only affects cards created later; extra keys already
stored in existing cards are kept and shown as optional attributes.

Library sorting is not in the settings tab — pick it from the dropdown in the library
header, it is remembered.

## Data format

A card is one note whose body is a `gdcard` code block containing YAML:

````markdown
```gdcard
type: weapon
id: Weapon-001
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
  counter: ''
  synergy: 和[[火焰附魔]]最搭
  balance:
    期望DPS: 2-3
    强度: D
note: 战五渣DPS没有5很合理
```
````

You can edit the YAML directly — the card re-renders when you switch back to reading
view. `sample/卡片/` contains five example cards you can copy into a vault.

## Known limitations

- **Reading view is recommended.** It also works in live preview, but the editor
  occasionally steals focus; the card stops `mousedown` propagation, which covers
  most cases.
- **Save timing**: typing only changes memory; the note is written when focus leaves
  the whole card. That is deliberate — re-rendering mid-typing would drop the caret.
  Give Obsidian a moment (or click elsewhere) before force-quitting.
- **Renaming is manual**: use the batch rename command, or rename in the file
  explorer. Editing the card title does not rename the file.
- **Batch rename scope**: only notes inside the card folder whose body contains a
  ```` ```gdcard ```` block. Other notes are never touched.
- **Changing the ID does not rename the file**; the two are independent.
- **No Dataview / Bases support**: the data lives in a code block, not in frontmatter.

## Development

```bash
npm install
npm run dev      # watch src/, rebuild main.js
npm test         # logic tests (YAML round-trip, HTML generation, block replacement)
```

Tests run on Node with an `obsidian` stub, so Obsidian does not need to be running.

```
src/data.ts         data model, parse / serialize, field ordering
src/card.ts         card HTML generation
src/dom.ts          HTML string -> DOM mounting helper
src/block.ts        locate and replace the ```gdcard block
src/main.ts         plugin entry, card interaction, settings tab, new card
src/library.ts      card library modal
src/prompt.ts       small modal for custom field names
```

---

# 中文说明

Obsidian 插件：用「一张卡片」管理游戏设计里的武器、道具、角色。

一页笔记就是一张卡，字段固定、可点开就改；空着的栏目会变浅但不会消失，方便你一眼看出哪块还没填。

## 安装

### 方式一：直接复制（推荐）

1. 把整个 `gd-card` 文件夹复制到你的仓库：`<你的仓库>/.obsidian/plugins/gd-card/`
2. 重启 Obsidian
3. 设置 → 第三方插件 → 关闭「安全模式」→ 已安装插件里启用 **GDCard**

文件夹名必须是 `gd-card`，要和 `manifest.json` 里的 `id` 一致。

### 方式二：从源码构建

```bash
cd gd-card
npm install
npm run build     # 产出 main.js
```

然后把 `main.js`、`manifest.json`、`styles.css` 三个文件放进
`<仓库>/.obsidian/plugins/gd-card/`。

## 用法

**新建一张空卡**：左侧功能区的 ＋ 图标，或命令面板 `GDCard: 新建武器卡片`。

会在「卡片」目录下生成 `未命名卡片.md`，卡片内已经有 4 个必有属性的键，值为空，标题是灰字占位，直接打字就是命名。

**文件名和 ID 都不绑定**：新建时文件叫「未命名卡片」，ID 留空，改 ID 不会动文件名；等方案定稿再填。

改名用命令 `GDCard: 批量按标题重命名所有卡片`：它会先列出「现文件名 → 新文件名」给你确认，勾选后才真正改；改完 Obsidian 会顺带更新所有指向它的 `[[双链]]`。也可以直接在文件树里手动重命名。

**改内容**：卡片上几乎所有文字都能直接点开改。

| 位置               | 能改什么                                           |
| ---------------- | ---------------------------------------------- |
| 左上 `Weapon-001`  | 卡片 ID，可留空、可反复改，不影响文件名                          |
| 右上 `rare=1`      | 稀缺度数值                                          |
| 标题 / `武器/投射物`    | 名称（= 文件名）/ 分类                                  |
| 属性区              | 必有属性只能改值；点 `＋` 从可选属性池挑，加进来后可悬停删掉               |
| Lore / 特效 / Note | 多行正文，回车换行                                      |
| 玩法定位 / 反制        | 多行正文                                           |
| 联动               | 普通段落，写 `[[卡片名]]` 会高亮成可点击链接，点一下段落进入原文编辑，点外面恢复高亮 |
| 平衡               | `期望DPS`、`强度` 是固定指标只填值；点 `＋` 从指标池添加，可删          |
| 右下角              | 状态下拉（开发中 / 已实装 / 仅创意 / 废弃）、`@负责人`              |
| 左下角              | 创建时间，新建时自动写入，也能手动改                             |

**卡片库**：左侧功能区的卡片库图标，或命令面板 `GDCard: 打开卡片库`，会把卡片目录里的所有卡按网格铺开。可以按开发状态筛选，按「最近修改 / 创建时间 / 稀有度 / 名称 / 状态」排序。

## 设置

设置 → 第三方插件 → GDCard：

- **默认负责人** — 新建卡片时右下角 `@` 后面的名字（默认 `user`）
- **卡片存放目录** — 默认 `卡片`，卡片库也只扫这个目录
- **默认分类** — 默认 `武器/投射物`
- **必有属性** — 固定显示、不可删的属性名（默认 `damage, attack_interval, projectile_speed, max_range`）
- **可选属性池** — 点属性区 `＋` 列出来的候选
- **平衡必有指标** — 固定显示的指标（默认 `期望DPS, 强度`）
- **平衡指标池** — 点平衡区 `＋` 列出来的候选

改了「必有属性」只影响之后新建的卡；已有卡片里多出来的键不会丢，会挪到可选属性里显示。

卡片库的排序方式不在设置页，直接在卡片库右上角的下拉里选，选完会记住。

左侧功能区有两个按钮：**＋**（新建卡片）和 **▦**（卡片库）。

## 数据格式

一张卡就是一篇笔记，正文是一个 `gdcard` 代码块，内容是 YAML：

````markdown
```gdcard
type: weapon
id: Weapon-001
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
  counter: ''
  synergy: 和[[火焰附魔]]最搭
  balance:
    期望DPS: 2-3
    强度: D
note: 战五渣DPS没有5很合理
```
````

也可以直接在源码里手改，改完回到阅读视图就是新卡片。
`sample/卡片/` 里有 5 张示例卡，想先看看效果可以把这个文件夹复制进仓库。

## 已知限制

- **建议在阅读视图（Reading view）里用**。实时预览下虽然也能点，但 Obsidian 的编辑器偶尔会抢焦点；卡片内已经拦截了 mousedown 冒泡，多数情况正常。
- **保存时机**：输入时只改内存，**焦点离开整张卡片**才写回文件。这样做是为了不在打字途中重渲染、丢光标。所以改完别立刻强退 Obsidian，先点一下别处。
- **改名是手动的**：用命令 `GDCard: 批量按标题重命名所有卡片`（带确认列表），或在文件树里直接重命名。改卡片标题不会自动动文件。
- **批量改名的作用域**：只处理「卡片存放目录」里、并且正文含 ` ```gdcard ` 代码块的笔记。目录外的文档、目录里没有卡片块的普通笔记都会被跳过，不会误改。
- **改 ID 不会重命名文件**，两者是分开的，ID 可以留空。
- **不支持 Dataview / Bases 查询**：数据在代码块里，不在 frontmatter。如果以后要按稀有度、状态批量筛，可以再加一层 frontmatter 镜像，告诉我即可。

## 开发

```bash
npm install
npm run dev      # 监听 src/ 变更，输出 main.js
npm test         # 纯逻辑测试（YAML 往返、HTML 生成、代码块替换）
```

`test/` 里的测试跑在 Node 上，用一个 `obsidian` 桩替换 `parseYaml` / `stringifyYaml`，
不需要启动 Obsidian。

````
src/data.ts     数据结构、解析、序列化、字段顺序
src/card.ts     卡片 HTML 生成
src/dom.ts      HTML 字符串 → DOM 挂载（避开 innerHTML）
src/block.ts    定位并替换 ```gdcard 代码块
src/main.ts     插件入口、卡片交互、设置页、新建卡片
src/library.ts  卡片库弹窗
src/prompt.ts   自定义字段名的小弹窗
````
