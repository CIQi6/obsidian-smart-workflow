import { ItemView, WorkspaceLeaf, Notice } from 'obsidian';
import { TerminalService } from '../../services/terminal/terminalService';
import { TerminalInstance } from '../../services/terminal/terminalInstance';

export const TERMINAL_VIEW_TYPE = 'terminal-view';

/**
 * 终端视图类
 * 每个视图实例管理一个终端实例，使用 Obsidian 原生标签页系统
 * 基于 Rust PTY 服务器和 WebSocket 通信
 */
export class TerminalView extends ItemView {
  private terminalService: TerminalService;
  private terminalInstance: TerminalInstance | null = null;
  private terminalContainer: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(leaf: WorkspaceLeaf, terminalService: TerminalService) {
    super(leaf);
    this.terminalService = terminalService;
  }

  /**
   * 获取视图类型
   */
  getViewType(): string {
    return TERMINAL_VIEW_TYPE;
  }

  /**
   * 获取显示文本
   */
  getDisplayText(): string {
    if (this.terminalInstance) {
      return this.terminalInstance.getTitle();
    }
    return '终端';
  }

  /**
   * 获取图标
   */
  getIcon(): string {
    return 'terminal';
  }

  /**
   * 视图打开时初始化
   */
  async onOpen(): Promise<void> {
    // 获取视图内容容器
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('terminal-view-container');
    
    // 移除默认的内边距，确保容器占满整个空间
    const containerEl = container as HTMLElement;
    containerEl.style.padding = '0';
    containerEl.style.margin = '0';
    containerEl.style.height = '100%';
    containerEl.style.width = '100%';
    containerEl.style.display = 'flex';
    containerEl.style.flexDirection = 'column';
    containerEl.style.overflow = 'hidden';

    // 创建终端容器
    this.terminalContainer = container.createDiv('terminal-container');
    this.terminalContainer.style.flex = '1';
    this.terminalContainer.style.minHeight = '0';
    this.terminalContainer.style.overflow = 'hidden';

    // 初始化终端实例
    await this.initializeTerminal();

    // 设置窗口大小调整监听
    this.setupResizeObserver();
  }

  /**
   * 视图关闭时清理资源
   */
  async onClose(): Promise<void> {
    console.log('[TerminalView] 开始清理视图资源');

    // 断开 ResizeObserver
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    // 销毁终端实例（会自动关闭 WebSocket 连接并清理资源）
    if (this.terminalInstance) {
      try {
        await this.terminalService.destroyTerminal(this.terminalInstance.id);
        console.log('[TerminalView] 终端实例已销毁');
      } catch (error) {
        console.error('[TerminalView] 销毁终端实例失败:', error);
      } finally {
        this.terminalInstance = null;
      }
    }

    // 清空容器
    this.containerEl.empty();
    console.log('[TerminalView] 视图清理完成');
  }

  /**
   * 初始化终端实例
   */
  private async initializeTerminal(): Promise<void> {
    try {
      // 创建新的终端实例（会自动连接到 PTY 服务器）
      this.terminalInstance = await this.terminalService.createTerminal();

      // 监听标题变化
      this.terminalInstance.onTitleChange(() => {
        // 触发视图更新以反映新标题
        this.leaf.view = this;
      });

      // 渲染终端
      this.renderTerminal();
      
      // 应用背景图片样式
      this.applyBackgroundImage();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[TerminalView] 初始化终端失败:', errorMessage);
      new Notice(`❌ 无法初始化终端: ${errorMessage}`);
      
      // 初始化失败时关闭视图
      this.leaf.detach();
    }
  }

  /**
   * 应用背景图片样式
   */
  private applyBackgroundImage(): void {
    if (!this.terminalContainer || !this.terminalInstance) {
      return;
    }

    const options = (this.terminalInstance as any).options;
    if (!options || !options.backgroundImage) {
      return;
    }

    const {
      backgroundImage,
      backgroundImageOpacity = 0.3,
      backgroundImageSize = 'cover',
      backgroundImagePosition = 'center',
      enableBlur = false,
      blurAmount = 10
    } = options;

    // 创建背景图片层
    const bgLayer = this.terminalContainer.createDiv('terminal-background-image');
    bgLayer.style.position = 'absolute';
    bgLayer.style.top = '0';
    bgLayer.style.left = '0';
    bgLayer.style.width = '100%';
    bgLayer.style.height = '100%';
    bgLayer.style.backgroundImage = `url(${backgroundImage})`;
    bgLayer.style.backgroundSize = backgroundImageSize;
    bgLayer.style.backgroundPosition = backgroundImagePosition;
    bgLayer.style.backgroundRepeat = 'no-repeat';
    bgLayer.style.opacity = String(backgroundImageOpacity);
    bgLayer.style.pointerEvents = 'none';
    bgLayer.style.zIndex = '0';

    // 应用毛玻璃效果
    if (enableBlur && blurAmount > 0) {
      bgLayer.style.filter = `blur(${blurAmount}px)`;
      // 扩大背景以避免边缘模糊后出现空白
      bgLayer.style.transform = 'scale(1.1)';
    }

    console.log('[TerminalView] 背景图片已应用:', backgroundImage, enableBlur ? `(模糊: ${blurAmount}px)` : '');
  }

  /**
   * 渲染终端
   */
  private renderTerminal(): void {
    if (!this.terminalContainer || !this.terminalInstance) {
      console.error('[TerminalView] 渲染失败：容器或实例为空', {
        hasContainer: !!this.terminalContainer,
        hasInstance: !!this.terminalInstance
      });
      return;
    }

    console.log('[TerminalView] 开始渲染终端');
    console.log('[TerminalView] 容器信息:', {
      clientWidth: this.terminalContainer.clientWidth,
      clientHeight: this.terminalContainer.clientHeight,
      offsetWidth: this.terminalContainer.offsetWidth,
      offsetHeight: this.terminalContainer.offsetHeight,
      scrollWidth: this.terminalContainer.scrollWidth,
      scrollHeight: this.terminalContainer.scrollHeight
    });

    // 清空容器
    this.terminalContainer.empty();

    // 附加终端实例到容器
    try {
      this.terminalInstance.attachToElement(this.terminalContainer);
      console.log('[TerminalView] 终端已附加到容器');
    } catch (error) {
      console.error('[TerminalView] 附加终端失败:', error);
      new Notice(`❌ 终端渲染失败: ${error}`);
      return;
    }
    
    // 延迟调整大小和聚焦，确保 DOM 已完全渲染
    setTimeout(() => {
      if (this.terminalInstance && this.terminalInstance.isAlive()) {
        console.log('[TerminalView] 延迟调整大小和聚焦');
        this.terminalInstance.fit();
        this.terminalInstance.focus();
      }
    }, 100);
  }

  /**
   * 设置窗口大小调整监听
   */
  private setupResizeObserver(): void {
    if (!this.terminalContainer) {
      return;
    }

    let resizeTimeout: NodeJS.Timeout | null = null;

    this.resizeObserver = new ResizeObserver((entries) => {
      // 使用节流避免频繁调整
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }

      resizeTimeout = setTimeout(() => {
        if (this.terminalInstance && this.terminalInstance.isAlive()) {
          try {
            const entry = entries[0];
            const { width, height } = entry.contentRect;
            
            console.log('[TerminalView] ResizeObserver 触发，容器尺寸:', { width, height });
            
            // 只有在容器有实际尺寸时才调整
            if (width > 0 && height > 0) {
              this.terminalInstance.fit();
            }
          } catch (error) {
            console.error('[TerminalView] 调整终端大小失败:', error);
          }
        }
      }, 100);
    });

    this.resizeObserver.observe(this.terminalContainer);
    console.log('[TerminalView] ResizeObserver 已设置');
  }
}
