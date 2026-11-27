import { parse, stringify } from "yaml";

/** 测试用桩：Obsidian 的 parseYaml / stringifyYaml 也是 YAML，行为足够接近 */

export function parseYaml(src: string) {
  return parse(src);
}

export function stringifyYaml(v: unknown) {
  // lineWidth: 0 —— 关掉自动折行，写出来的格式更接近 Obsidian
  return stringify(v, { lineWidth: 0 });
}

export function normalizePath(p: string): string {
  return String(p || "")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "");
}

/* 以下只有占位意义，测试里不会真正实例化 */
export class Modal {
  constructor(public app: unknown) {}
  open() {}
  close() {}
}
export class Notice {
  constructor(public message: string) {}
}
export class TFile {
  path = "";
  basename = "";
  extension = "md";
  parent: unknown = null;
  stat = { mtime: 0 };
}
