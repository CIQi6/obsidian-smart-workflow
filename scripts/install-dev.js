/**
 * 开发环境安装脚本
 * 将插件文件复制到 Obsidian 插件目录进行测试
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT_DIR = path.join(__dirname, '..');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 创建 readline 接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  log('\n📦 Obsidian 插件开发安装工具\n', 'cyan');

  // 1. 检查必需文件
  log('🔍 检查必需文件...', 'cyan');
  const requiredFiles = [
    'main.js',
    'manifest.json',
    'styles.css',
    'binaries/pty-server-win32-x64.exe'
  ];

  const missingFiles = [];
  for (const file of requiredFiles) {
    const filePath = path.join(ROOT_DIR, file);
    if (!fs.existsSync(filePath)) {
      missingFiles.push(file);
      log(`  ❌ 缺少: ${file}`, 'red');
    } else {
      log(`  ✓ ${file}`, 'green');
    }
  }

  if (missingFiles.length > 0) {
    log('\n❌ 错误: 缺少必需文件', 'red');
    log('请先运行以下命令:', 'yellow');
    if (missingFiles.some(f => f.endsWith('.js') || f.endsWith('.json') || f.endsWith('.css'))) {
      log('  npm run build', 'yellow');
    }
    if (missingFiles.some(f => f.includes('binaries'))) {
      log('  npm run build:rust', 'yellow');
    }
    rl.close();
    process.exit(1);
  }

  log('\n✅ 所有必需文件存在\n', 'green');

  // 2. 获取 Obsidian 插件目录
  log('📁 请输入你的 Obsidian 插件目录路径:', 'cyan');
  log('   默认路径示例: C:\\Users\\<用户名>\\AppData\\Roaming\\Obsidian\\<库名>\\plugins', 'yellow');
  log('   或者在 Obsidian 中打开插件目录，复制路径\n', 'yellow');

  const pluginDir = await question('插件目录路径: ');

  if (!pluginDir || pluginDir.trim() === '') {
    log('\n❌ 未提供路径', 'red');
    rl.close();
    process.exit(1);
  }

  const pluginDirPath = pluginDir.trim().replace(/['"]/g, '');

  // 验证目录是否存在
  if (!fs.existsSync(pluginDirPath)) {
    log(`\n❌ 目录不存在: ${pluginDirPath}`, 'red');
    rl.close();
    process.exit(1);
  }

  // 3. 创建插件文件夹
  const targetDir = path.join(pluginDirPath, 'obsidian-smart-workflow');
  
  log(`\n📂 目标目录: ${targetDir}`, 'cyan');

  if (fs.existsSync(targetDir)) {
    const overwrite = await question('\n⚠️  目标目录已存在，是否覆盖? (y/n): ');
    if (overwrite.toLowerCase() !== 'y') {
      log('\n❌ 已取消', 'yellow');
      rl.close();
      process.exit(0);
    }
  } else {
    fs.mkdirSync(targetDir, { recursive: true });
    log('✓ 创建目标目录', 'green');
  }

  // 4. 复制文件
  log('\n📋 复制文件...', 'cyan');

  // 复制核心文件
  const coreFiles = ['main.js', 'manifest.json', 'styles.css'];
  for (const file of coreFiles) {
    const srcPath = path.join(ROOT_DIR, file);
    const destPath = path.join(targetDir, file);
    fs.copyFileSync(srcPath, destPath);
    log(`  ✓ ${file}`, 'green');
  }

  // 复制二进制文件
  const binariesDir = path.join(targetDir, 'binaries');
  if (!fs.existsSync(binariesDir)) {
    fs.mkdirSync(binariesDir, { recursive: true });
  }

  const binaryFiles = fs.readdirSync(path.join(ROOT_DIR, 'binaries'))
    .filter(f => f.startsWith('pty-server-') && !f.endsWith('.md'));

  for (const file of binaryFiles) {
    const srcPath = path.join(ROOT_DIR, 'binaries', file);
    const destPath = path.join(binariesDir, file);
    fs.copyFileSync(srcPath, destPath);
    log(`  ✓ binaries/${file}`, 'green');
  }

  // 5. 完成
  log('\n🎉 安装完成！', 'green');
  log('\n下一步:', 'cyan');
  log('  1. 打开 Obsidian', 'yellow');
  log('  2. 进入设置 → 第三方插件', 'yellow');
  log('  3. 关闭"安全模式"（如果启用）', 'yellow');
  log('  4. 在已安装插件列表中找到 "Smart Workflow"', 'yellow');
  log('  5. 启用插件', 'yellow');
  log('  6. 使用命令面板 (Ctrl+P) 输入 "Terminal" 测试终端功能\n', 'yellow');

  log('💡 提示:', 'cyan');
  log('  - 修改代码后运行 npm run build，然后在 Obsidian 中重新加载插件', 'yellow');
  log('  - 按 Ctrl+Shift+I 打开开发者工具查看日志', 'yellow');
  log('  - 查看 INSTALL_GUIDE.md 了解更多信息\n', 'yellow');

  rl.close();
}

main().catch(error => {
  log(`\n❌ 错误: ${error.message}`, 'red');
  rl.close();
  process.exit(1);
});
