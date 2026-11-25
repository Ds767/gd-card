import * as yaml from "js-yaml";

/** 测试用桩：Obsidian 内部用的也是 js-yaml，行为足够接近 */

export function parseYaml(src: string) {
  return (yaml as any).load(src);
}

export function stringifyYaml(v: unknown) {
  return (yaml as any).dump(v, { lineWidth: -1, noRefs: true });
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
