import { App, Modal, TextComponent, Setting } from "obsidian";

/** 输入一个字段名的小弹窗（自定义属性 / 自定义平衡指标的兜底） */
export class PromptModal extends Modal {
  constructor(app: App, private title: string, private onSubmit: (value: string) => void) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText(this.title);
    const wrap = this.contentEl.createDiv({ cls: "gd-prompt" });
    const input = new TextComponent(wrap);
    input.setPlaceholder("字段名").setValue("");
    input.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") { e.preventDefault(); this.submit(input.getValue()); }
      if (e.key === "Escape") this.close();
    });
    input.inputEl.addClass("gd-prompt-input");
    new Setting(this.contentEl).addButton(b =>
      b.setButtonText("添加").setCta().onClick(() => this.submit(input.getValue()))
    );
    window.setTimeout(() => input.inputEl.focus(), 30);
  }

  private submit(v: string): void {
    const value = (v || "").trim();
    if (!value) return;
    this.onSubmit(value);
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
