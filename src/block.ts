/** 在文件文本里定位 ```gdcard 代码块并做替换 / 提取 */

export interface BlockRange {
  openLine: number;
  closeLine: number;
  body: string;
}

export function findCardBlocks(text: string): BlockRange[] {
  const lines = text.split("\n");
  const out: BlockRange[] = [];
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(/^[ \t]*(`{3,}|~{3,})[ \t]*gdcard[ \t]*$/);
    if (!m) { i++; continue; }
    const fence = m[1];
    const close = new RegExp("^[ \\t]*" + fence[0] + "{" + fence.length + ",}[ \\t]*$");
    let j = i + 1;
    while (j < lines.length && !close.test(lines[j])) j++;
    if (j >= lines.length) break; // 没有闭合，放弃
    out.push({
      openLine: i,
      closeLine: j,
      body: lines.slice(i + 1, j).join("\n"),
    });
    i = j + 1;
  }
  return out;
}

export function extractCardBlock(text: string): string | null {
  const blocks = findCardBlocks(text);
  return blocks.length ? blocks[0].body : null;
}

/**
 * 用 newBody 替换其中一个块。
 * 优先替换正文与 oldBody 完全一致的那个块（防止一页多卡时改错），
 * 找不到就退回第一个块。
 */
export function replaceCardBlock(text: string, oldBody: string, newBody: string): string {
  const blocks = findCardBlocks(text);
  if (!blocks.length) return text;

  const target =
    blocks.find(b => b.body.trim() === oldBody.trim()) || blocks[0];

  const lines = text.split("\n");
  const head = lines.slice(0, target.openLine + 1);
  const tail = lines.slice(target.closeLine);
  return [...head, ...newBody.split("\n"), ...tail].join("\n");
}
