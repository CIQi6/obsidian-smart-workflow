/**
 * 自动归档设置渲染器
 * 负责渲染自动归档配置
 */

import { Setting, Notice } from 'obsidian';
import type { RendererContext } from '../types';
import { BaseSettingsRenderer } from './baseRenderer';
import { DEFAULT_AUTO_ARCHIVE_SETTINGS } from '../settings';

/**
 * 自动归档设置渲染器
 */
export class AutoArchiveSettingsRenderer extends BaseSettingsRenderer {
  /**
   * 渲染自动归档设置
   * @param context 渲染器上下文
   */
  render(context: RendererContext): void {
    this.context = context;
    const containerEl = context.containerEl;

    // 功能说明
    this.renderDescription(containerEl);

    // 主要设置
    this.renderMainSettings(containerEl);

    // 高级设置
    this.renderAdvancedSettings(containerEl);
  }

  /**
   * 渲染功能说明
   */
  private renderDescription(containerEl: HTMLElement): void {
    const descCard = containerEl.createDiv();
    descCard.style.padding = '16px';
    descCard.style.borderRadius = '8px';
    descCard.style.backgroundColor = 'var(--background-secondary)';
    descCard.style.marginBottom = '16px';

    descCard.createEl('h3', {
      text: '📦 自动归档功能',
      attr: { style: 'margin-top: 0; margin-bottom: 8px;' }
    });

    const desc = descCard.createEl('p', {
      attr: { style: 'margin: 0; color: var(--text-muted); line-height: 1.5;' }
    });
    desc.innerHTML = `
      当笔记的 frontmatter 中的状态字段变为指定值时，自动执行以下操作：
      <br>1. 🏷️ 自动生成 AI 标签（需先启用标签生成功能）
      <br>2. 📁 自动归档到智能匹配的分类（需先启用归档功能）
      <br><br><strong>⚠️ 提示：</strong>需要同时启用"标签生成"和"归档功能"才能完整使用。
    `;
  }

  /**
   * 渲染主要设置
   */
  private renderMainSettings(containerEl: HTMLElement): void {
    const card = containerEl.createDiv();
    card.style.padding = '16px';
    card.style.borderRadius = '8px';
    card.style.backgroundColor = 'var(--background-secondary)';
    card.style.marginBottom = '16px';

    new Setting(card)
      .setName('主要设置')
      .setHeading();

    // 启用/禁用自动归档
    new Setting(card)
      .setName('启用自动归档')
      .setDesc('开启后，当笔记状态变为指定值时自动执行归档流程。修改此设置后需要重新加载插件生效。')
      .addToggle(toggle => toggle
        .setValue(this.context.plugin.settings.autoArchive?.enabled ?? false)
        .onChange(async (value) => {
          this.context.plugin.settings.autoArchive = this.context.plugin.settings.autoArchive || { ...DEFAULT_AUTO_ARCHIVE_SETTINGS };
          this.context.plugin.settings.autoArchive.enabled = value;
          await this.context.plugin.saveSettings();

          // 提示用户重新加载插件
          new Notice('⚠️ 请重新加载插件使自动归档设置生效');
        })
      );

    // 触发字段名
    new Setting(card)
      .setName('触发字段名')
      .setDesc('frontmatter 中用于触发归档的字段名（默认：status）')
      .addText(text => text
        .setPlaceholder('status')
        .setValue(this.context.plugin.settings.autoArchive?.triggerField || 'status')
        .onChange(async (value) => {
          this.context.plugin.settings.autoArchive = this.context.plugin.settings.autoArchive || { ...DEFAULT_AUTO_ARCHIVE_SETTINGS };
          this.context.plugin.settings.autoArchive.triggerField = value || 'status';
          await this.context.plugin.saveSettings();
        })
      );

    // 触发状态值
    new Setting(card)
      .setName('触发状态值')
      .setDesc('当字段值变为此值时触发归档（默认：finish）')
      .addText(text => text
        .setPlaceholder('finish')
        .setValue(this.context.plugin.settings.autoArchive?.triggerStatus || 'finish')
        .onChange(async (value) => {
          this.context.plugin.settings.autoArchive = this.context.plugin.settings.autoArchive || { ...DEFAULT_AUTO_ARCHIVE_SETTINGS };
          this.context.plugin.settings.autoArchive.triggerStatus = value || 'finish';
          await this.context.plugin.saveSettings();
        })
      );

    // 自动生成标签
    new Setting(card)
      .setName('自动生成标签')
      .setDesc('归档前自动生成 AI 标签')
      .addToggle(toggle => toggle
        .setValue(this.context.plugin.settings.autoArchive?.generateTags ?? true)
        .onChange(async (value) => {
          this.context.plugin.settings.autoArchive = this.context.plugin.settings.autoArchive || { ...DEFAULT_AUTO_ARCHIVE_SETTINGS };
          this.context.plugin.settings.autoArchive.generateTags = value;
          await this.context.plugin.saveSettings();
        })
      );

    // 执行自动归档
    new Setting(card)
      .setName('执行自动归档')
      .setDesc('自动移动文件到智能匹配的分类文件夹')
      .addToggle(toggle => toggle
        .setValue(this.context.plugin.settings.autoArchive?.performArchive ?? true)
        .onChange(async (value) => {
          this.context.plugin.settings.autoArchive = this.context.plugin.settings.autoArchive || { ...DEFAULT_AUTO_ARCHIVE_SETTINGS };
          this.context.plugin.settings.autoArchive.performArchive = value;
          await this.context.plugin.saveSettings();
        })
      );
  }

  /**
   * 渲染高级设置
   */
  private renderAdvancedSettings(containerEl: HTMLElement): void {
    const card = containerEl.createDiv();
    card.style.padding = '16px';
    card.style.borderRadius = '8px';
    card.style.backgroundColor = 'var(--background-secondary)';
    card.style.marginBottom = '16px';

    new Setting(card)
      .setName('高级设置')
      .setHeading();

    // 去抖动延迟
    new Setting(card)
      .setName('去抖动延迟')
      .setDesc('避免频繁触发，延迟指定时间后执行（毫秒）')
      .addText(text => text
        .setPlaceholder('2000')
        .setValue(String(this.context.plugin.settings.autoArchive?.debounceDelay || 2000))
        .onChange(async (value) => {
          const delay = parseInt(value) || 2000;
          this.context.plugin.settings.autoArchive = this.context.plugin.settings.autoArchive || { ...DEFAULT_AUTO_ARCHIVE_SETTINGS };
          this.context.plugin.settings.autoArchive.debounceDelay = delay;
          await this.context.plugin.saveSettings();
        })
      );

    // 排除文件夹
    new Setting(card)
      .setName('排除文件夹')
      .setDesc('不会自动归档这些文件夹中的文件，每行一个路径')
      .addTextArea(text => {
        text.inputEl.style.width = '100%';
        text.inputEl.style.minHeight = '80px';
        text.inputEl.style.fontFamily = 'var(--font-monospace)';
        text
          .setPlaceholder('03-归档区\n99-资源库')
          .setValue((this.context.plugin.settings.autoArchive?.excludeFolders || []).join('\n'))
          .onChange(async (value) => {
            const folders = value.split('\n').map(f => f.trim()).filter(f => f.length > 0);
            this.context.plugin.settings.autoArchive = this.context.plugin.settings.autoArchive || { ...DEFAULT_AUTO_ARCHIVE_SETTINGS };
            this.context.plugin.settings.autoArchive.excludeFolders = folders;
            await this.context.plugin.saveSettings();
          });
      });

    // 使用示例
    const exampleCard = containerEl.createDiv();
    exampleCard.style.padding = '16px';
    exampleCard.style.borderRadius = '8px';
    exampleCard.style.backgroundColor = 'var(--background-modifier-border)';
    exampleCard.style.marginTop = '16px';

    exampleCard.createEl('h4', {
      text: '💡 使用示例',
      attr: { style: 'margin-top: 0; margin-bottom: 12px;' }
    });

    const example = exampleCard.createEl('pre', {
      attr: { style: 'margin: 0; padding: 12px; background: var(--background-primary); border-radius: 4px; overflow-x: auto; font-family: var(--font-monospace); font-size: 12px;' }
    });
    example.innerHTML = `<code>---
title: 我的学习笔记
status: finish  ← 当改为此值时触发自动归档
---

# 笔记内容...</code>`;

    const note = exampleCard.createEl('p', {
      attr: { style: 'margin-top: 12px; margin-bottom: 0; color: var(--text-muted); font-size: 13px;' }
    });
    note.innerHTML = `<strong>流程：</strong>修改 frontmatter 中的 <code>status</code> 字段为 <code>finish</code> → 等待 2 秒 → 自动生成标签 → 自动归档到合适的分类`;
  }
}
