# 构建脚本使用指南

本目录包含用于构建、打包和开发 Smart Workflow Obsidian 插件的自动化脚本。

## 脚本概览

| 脚本 | 用途 | 使用场景 |
|------|------|----------|
| `build-rust.js` | 构建 Rust PTY 服务器二进制文件 | 发布前、本地开发 |
| `package-plugin.js` | 打包插件发布包 | 发布、分发 |
| `install-dev.js` | 安装插件到 Obsidian 进行测试 | 本地开发、调试 |

## 脚本详解

### 1. build-rust.js - Rust 二进制构建

构建 Rust PTY 服务器的跨平台二进制文件，支持 5 个平台的交叉编译。

#### 用法

```bash
# 构建所有平台（推荐用于发布）
node scripts/build-rust.js

# 构建特定平台（推荐用于本地开发）
node scripts/build-rust.js win32-x64
node scripts/build-rust.js darwin-x64
node scripts/build-rust.js darwin-arm64
node scripts/build-rust.js linux-x64
node scripts/build-rust.js linux-arm64

# 跳过 rustup target 安装（如果已安装）
node scripts/build-rust.js --skip-install

# 快捷命令（通过 npm）
npm run build:rust              # 构建所有平台
npm run build:rust -- win32-x64 # 构建特定平台
```

#### 支持的平台

| 平台标识 | 操作系统 | 架构 | Rust Target | 文件扩展名 |
|---------|---------|------|-------------|-----------|
| `win32-x64` | Windows | x64 | `x86_64-pc-windows-msvc` | `.exe` |
| `darwin-x64` | macOS | Intel | `x86_64-apple-darwin` | 无 |
| `darwin-arm64` | macOS | Apple Silicon | `aarch64-apple-darwin` | 无 |
| `linux-x64` | Linux | x64 | `x86_64-unknown-linux-gnu` | 无 |
| `linux-arm64` | Linux | ARM64 | `aarch64-unknown-linux-gnu` | 无 |

#### 输出文件

```
binaries/
├── pty-server-win32-x64.exe
├── pty-server-win32-x64.exe.sha256
├── pty-server-darwin-x64
├── pty-server-darwin-x64.sha256
├── pty-server-darwin-arm64
├── pty-server-darwin-arm64.sha256
├── pty-server-linux-x64
├── pty-server-linux-x64.sha256
├── pty-server-linux-arm64
└── pty-server-linux-arm64.sha256
```

#### 构建特性

- **自动安装编译目标**: 使用 `rustup target add` 自动安装所需的交叉编译目标
- **Release 优化**: 使用 `--release` 标志进行优化编译
- **SHA256 校验**: 自动生成 SHA256 校验和文件，用于二进制验证
- **体积监控**: 显示编译后的文件大小，提供 2MB 参考值提示
- **编译时间统计**: 显示每个平台的编译耗时

#### 前置要求

1. **Rust 工具链**: 
   ```bash
   # 检查是否已安装
   cargo --version
   
   # 安装 Rust（如果未安装）
   # Windows: 下载 rustup-init.exe
   # macOS/Linux: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **交叉编译工具链**:
   - **Windows**: 需要 Visual Studio Build Tools 或 MSVC
   - **macOS**: 需要 Xcode Command Line Tools
   - **Linux**: 需要 GCC 和相关开发库

---

### 2. package-plugin.js - 插件打包

打包插件并包含内置平台的二进制文件，生成可分发的插件包。

#### 用法

```bash
# 基本打包（仅创建目录）
node scripts/package-plugin.js

# 打包并创建 ZIP 文件
node scripts/package-plugin.js --zip

# 快捷命令（通过 npm）
npm run package        # 基本打包
npm run package -- --zip  # 打包 + ZIP
```

#### 内置平台策略

插件包仅包含 **3 个内置平台**，覆盖约 95% 的用户：

| 平台 | 原因 |
|------|------|
| `win32-x64` | Windows 主流平台 |
| `darwin-arm64` | macOS 新设备（M1/M2/M3） |
| `linux-x64` | Linux 主流平台 |

**其他平台** (`darwin-x64`, `linux-arm64`) 将在首次使用时通过 `BinaryManager` 自动下载。

#### 输出结构

```
dist/
└── obsidian-terminal-{version}/
    ├── main.js                    # 插件主代码
    ├── manifest.json              # 插件清单
    ├── styles.css                 # 样式文件
    ├── README.md                  # 说明文档
    ├── LICENSE                    # 许可证
    ├── src/                       # 源代码（可选）
    └── binaries/                  # 内置二进制文件
        ├── pty-server-win32-x64.exe
        ├── pty-server-win32-x64.exe.sha256
        ├── pty-server-darwin-arm64
        ├── pty-server-darwin-arm64.sha256
        ├── pty-server-linux-x64
        └── pty-server-linux-x64.sha256
```

#### 打包特性

- **体积监控**: 显示每个文件和总体积，提供 10MB 参考值提示
- **完整性检查**: 验证所有必需文件和内置平台二进制是否存在
- **版本管理**: 从 `manifest.json` 读取版本号，自动命名打包目录
- **ZIP 压缩**: 可选创建 ZIP 文件，方便分发
- **SHA256 包含**: 自动包含二进制文件的校验和

#### 前置要求

1. **构建插件代码**:
   ```bash
   npm run build
   ```

2. **构建内置平台二进制**:
   ```bash
   node scripts/build-rust.js win32-x64
   node scripts/build-rust.js darwin-arm64
   node scripts/build-rust.js linux-x64
   ```

3. **ZIP 工具**（可选，用于 `--zip` 选项）:
   - Linux/macOS: 通常已预装
   - Windows: 需要安装 `zip` 命令或使用 WSL

---

### 3. install-dev.js - 开发环境安装

将插件文件复制到 Obsidian 插件目录，用于本地开发和测试。

#### 用法

```bash
# 运行安装脚本
node scripts/install-dev.js

# 快捷命令（通过 npm）
npm run install:dev
```

#### 交互式流程

脚本会引导你完成以下步骤：

1. **检查必需文件**: 验证 `main.js`、`manifest.json`、`styles.css` 和二进制文件是否存在
2. **输入插件目录**: 提示输入 Obsidian 插件目录路径
3. **确认覆盖**: 如果目标目录已存在，询问是否覆盖
4. **复制文件**: 复制所有必需文件到目标目录
5. **显示后续步骤**: 提供在 Obsidian 中启用插件的指引

#### 典型插件目录路径

- **Windows**: `C:\Users\<用户名>\AppData\Roaming\Obsidian\<库名>\.obsidian\plugins`
- **macOS**: `/Users/<用户名>/Library/Application Support/obsidian/<库名>/.obsidian/plugins`
- **Linux**: `~/.config/obsidian/<库名>/.obsidian/plugins`

#### 开发工作流

```bash
# 1. 修改代码
# 编辑 src/ 目录下的文件

# 2. 构建插件
npm run build

# 3. 构建当前平台的二进制（如果修改了 Rust 代码）
npm run build:rust -- win32-x64  # Windows
npm run build:rust -- darwin-arm64  # macOS

# 4. 安装到 Obsidian
npm run install:dev

# 5. 在 Obsidian 中重新加载插件
# 方法 1: 关闭并重新启用插件
# 方法 2: 使用 Hot Reload 插件
# 方法 3: 重启 Obsidian
```

#### 调试技巧

- **开发者工具**: 按 `Ctrl+Shift+I` (Windows/Linux) 或 `Cmd+Option+I` (macOS) 打开
- **查看日志**: 在 Console 标签查看插件日志输出
- **检查错误**: 在 Console 标签查看错误信息
- **网络请求**: 在 Network 标签查看 WebSocket 连接

---

## 完整构建流程

### 本地开发流程

```bash
# 1. 克隆仓库并安装依赖
git clone <repository-url>
cd smart-workflow
npm install

# 2. 构建插件代码
npm run build

# 3. 构建当前平台的 PTY 服务器
# Windows
npm run build:rust -- win32-x64

# macOS Intel
npm run build:rust -- darwin-x64

# macOS Apple Silicon
npm run build:rust -- darwin-arm64

# Linux
npm run build:rust -- linux-x64

# 4. 安装到 Obsidian 进行测试
npm run install:dev

# 5. 在 Obsidian 中启用插件并测试
```

### 发布流程

```bash
# 1. 更新版本号
# 编辑 manifest.json 和 versions.json

# 2. 构建插件代码
npm run build

# 3. 构建所有平台的 PTY 服务器
npm run build:rust

# 4. 打包插件
npm run package -- --zip

# 5. 验证打包内容
# 检查 dist/ 目录下的文件

# 6. 创建 GitHub Release
# 上传 dist/obsidian-terminal-{version}.zip

# 7. 发布到 Obsidian 社区插件
# 提交 PR 到 obsidianmd/obsidian-releases
```

---

## CI/CD 集成

### GitHub Actions 示例

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Setup Rust
        uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
          profile: minimal
      
      - name: Install dependencies
        run: npm install
      
      - name: Build plugin
        run: npm run build
      
      - name: Build Rust binaries
        run: npm run build:rust
      
      - name: Package plugin
        run: npm run package -- --zip
      
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: dist/*.zip
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 多平台构建策略

由于交叉编译的限制，建议使用 GitHub Actions 的 matrix 策略在对应平台上构建：

```yaml
jobs:
  build-binaries:
    strategy:
      matrix:
        include:
          - os: windows-latest
            platform: win32-x64
          - os: macos-latest
            platform: darwin-arm64
          - os: ubuntu-latest
            platform: linux-x64
    
    runs-on: ${{ matrix.os }}
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Rust
        uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
      
      - name: Build binary
        run: node scripts/build-rust.js ${{ matrix.platform }}
      
      - name: Upload artifact
        uses: actions/upload-artifact@v3
        with:
          name: binaries
          path: binaries/*
```

---

## 故障排除

### Rust 编译失败

**问题**: `cargo build` 失败，提示找不到 Cargo

**解决方案**:
```bash
# 1. 检查 Rust 是否已安装
cargo --version

# 2. 如果未安装，安装 Rust
# Windows: 下载并运行 rustup-init.exe
# macOS/Linux: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 3. 重新打开终端，验证安装
cargo --version
```

---

### 交叉编译失败

**问题**: 无法为其他平台编译，提示缺少工具链

**解决方案**:

1. **Windows 平台**:
   ```bash
   # 安装 Visual Studio Build Tools
   # 下载: https://visualstudio.microsoft.com/downloads/
   # 选择 "C++ build tools" 工作负载
   ```

2. **macOS 平台**:
   ```bash
   # 安装 Xcode Command Line Tools
   xcode-select --install
   
   # 添加交叉编译目标
   rustup target add x86_64-apple-darwin
   rustup target add aarch64-apple-darwin
   ```

3. **Linux 平台**:
   ```bash
   # Ubuntu/Debian
   sudo apt-get install build-essential gcc-aarch64-linux-gnu
   
   # 添加交叉编译目标
   rustup target add x86_64-unknown-linux-gnu
   rustup target add aarch64-unknown-linux-gnu
   ```

4. **使用 GitHub Actions**:
   - 在对应平台上构建，避免交叉编译问题
   - 参考上面的 CI/CD 集成示例

---

### 包体积过大

**问题**: 打包后体积超过 10MB

**说明**:
- 脚本不再强制限制包体积
- 包含完整的二进制文件是正常的
- Rust 二进制文件通常在 1-3 MB 之间

**优化建议**:

1. **使用 UPX 压缩二进制文件**:
   ```bash
   # 安装 UPX
   # Windows: choco install upx
   # macOS: brew install upx
   # Linux: sudo apt-get install upx
   
   # 压缩二进制文件
   upx --best binaries/pty-server-*
   ```

2. **减少内置平台数量**:
   - 编辑 `scripts/package-plugin.js`
   - 修改 `BUILTIN_PLATFORMS` 数组
   - 注意：减少内置平台会增加首次使用时的下载时间

3. **优化 Cargo 配置**:
   ```toml
   # pty-server/Cargo.toml
   [profile.release]
   opt-level = "z"        # 优化体积
   lto = true             # 链接时优化
   codegen-units = 1      # 单个代码生成单元
   strip = true           # 剥离符号
   panic = "abort"        # 减少 panic 处理代码
   ```

---

### 安装到 Obsidian 失败

**问题**: `install-dev.js` 无法找到插件目录

**解决方案**:

1. **手动查找插件目录**:
   - 打开 Obsidian
   - 进入设置 → 第三方插件
   - 点击"打开插件文件夹"按钮
   - 复制地址栏中的路径

2. **验证路径格式**:
   - Windows: 使用反斜杠 `\` 或正斜杠 `/`
   - macOS/Linux: 使用正斜杠 `/`
   - 路径中不要包含引号

3. **手动复制文件**:
   ```bash
   # 创建插件目录
   mkdir -p "<插件目录>/obsidian-smart-workflow"
   
   # 复制文件
   cp main.js manifest.json styles.css "<插件目录>/obsidian-smart-workflow/"
   cp -r binaries "<插件目录>/obsidian-smart-workflow/"
   ```

---

### ZIP 创建失败

**问题**: `package-plugin.js --zip` 提示找不到 zip 命令

**解决方案**:

1. **Windows**:
   ```bash
   # 方法 1: 使用 WSL
   wsl
   cd /mnt/c/path/to/project
   node scripts/package-plugin.js --zip
   
   # 方法 2: 手动压缩
   # 使用 7-Zip 或 WinRAR 压缩 dist/ 目录
   ```

2. **macOS/Linux**:
   ```bash
   # 检查 zip 是否已安装
   which zip
   
   # 如果未安装
   # macOS: brew install zip
   # Ubuntu/Debian: sudo apt-get install zip
   ```

3. **手动创建 ZIP**:
   - 打开文件管理器
   - 导航到 `dist/` 目录
   - 右键点击 `obsidian-terminal-{version}` 文件夹
   - 选择"压缩"或"发送到 → 压缩文件夹"

---

## 开发建议

### 本地开发最佳实践

1. **只构建当前平台**: 开发时无需构建所有平台，只构建当前使用的平台即可
2. **使用 watch 模式**: 运行 `npm run dev` 自动监听文件变化并重新构建
3. **启用 Hot Reload**: 安装 Obsidian Hot Reload 插件，自动重新加载插件
4. **查看日志**: 始终打开开发者工具，及时发现错误

### 发布前检查清单

- [ ] 更新版本号（`manifest.json` 和 `versions.json`）
- [ ] 更新 CHANGELOG.md
- [ ] 运行 `npm run build` 构建插件代码
- [ ] 运行 `npm run build:rust` 构建所有平台二进制
- [ ] 验证所有二进制文件和 SHA256 文件已生成
- [ ] 运行 `npm run package -- --zip` 打包插件
- [ ] 手动测试内置平台（win32-x64, darwin-arm64, linux-x64）
- [ ] 验证打包内容完整性
- [ ] 创建 Git tag: `git tag v{version}`
- [ ] 推送 tag: `git push origin v{version}`
- [ ] 创建 GitHub Release 并上传 ZIP 文件

### 性能优化建议

1. **并行构建**: 使用 `npm run build:rust` 构建所有平台时，考虑使用并行构建工具
2. **缓存依赖**: 在 CI/CD 中缓存 Rust 编译产物和 npm 依赖
3. **增量构建**: 本地开发时只重新构建修改的部分

---

## 相关文档

- [PTY 服务器文档](../pty-server/README.md)
- [主 README](../README.md)

---

## 脚本维护

### 添加新平台

如果需要支持新平台，需要修改以下文件：

1. **`scripts/build-rust.js`**:
   ```javascript
   const PLATFORMS = [
     // ... 现有平台
     { 
       name: 'new-platform', 
       target: 'rust-target-triple',
       ext: '.exe', // 或 ''
       displayName: 'Platform Name'
     },
   ];
   ```

2. **`src/services/terminal/platformUtils.ts`**:
   ```typescript
   export function getPlatformIdentifier(): string {
     // 添加新平台检测逻辑
   }
   ```

3. **更新文档**: 在本 README 和相关文档中添加新平台说明

### 脚本依赖

所有脚本使用 Node.js 内置模块，无需额外依赖：
- `fs`: 文件系统操作
- `path`: 路径处理
- `child_process`: 执行外部命令
- `crypto`: SHA256 校验和生成
- `readline`: 交互式输入（仅 `install-dev.js`）

---

## 许可证

本项目遵循 MIT 许可证。详见 [LICENSE](../LICENSE) 文件。
