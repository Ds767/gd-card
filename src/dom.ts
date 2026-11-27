/**
 * 把插件自己生成的 HTML 字符串挂到元素上。
 *
 * 这里不用 innerHTML：Obsidian 的插件审核禁止直接写 innerHTML（XSS 风险）。
 * 也不用 sanitizeHTMLToDom：它会把 contenteditable 这类可编辑属性洗掉，
 * 卡片就没法点开改了。
 *
 * card.ts 里所有动态值都过了 esc()，标签全部由本插件自己拼，所以这里只做
 * 「字符串 → DOM」的搬运，不做二次清洗。
 */
export function mountHTML(parent: HTMLElement, html: string): void {
  parent.empty();
  if (!html) return;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  for (const node of Array.from(doc.body.childNodes)) {
    parent.appendChild(document.importNode(node, true));
  }
}
