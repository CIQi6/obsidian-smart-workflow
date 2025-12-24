/**
 * 快速安装脚本 - 直接安装到指定的 vault
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const TARGET_VAULT = 'D:\\OneDrive\\obsidian-zyphrzero\\.obsidian\\plugins\\obsidian-smart-workflow';

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

function main() {
  log('\n📦 快速安装到 Obsidian\n', 'cyan');

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
    process.exit(1);
  }

  log('\n✅ 所有必需文件存在\n', 'green');

  // 2. 创建目标目录
  log(`📂 目标目录: ${TARGET_VAULT}`, 'cyan');

  if (!fs.existsSync(TARGET_VAULT)) {
    fs.mkdirSync(TARGET_VAULT, { recursive: true });
    log('✓ 创建目标目录', 'green');
  }

  // 3. 复制文件
  log('\n📋 复制文件...', 'cyan');

  // 复制核心文件
  const coreFiles = ['main.js', 'manifest.json', 'styles.css'];
  for (const file of coreFiles) {
    const srcPath = path.join(ROOT_DIR, file);
    const destPath = path.join(TARGET_VAULT, file);
    fs.copyFileSync(srcPath, destPath);
    log(`  ✓ ${file}`, 'green');
  }

  // 复制二进制文件
  const binariesDir = path.join(TARGET_VAULT, 'binaries');
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

  // 4. 完成
  log('\n🎉 安装完成！', 'green');
  log('\n下一步:', 'cyan');
  log('  1. 在 Obsidian 中按 Ctrl+R 重新加载插件', 'yellow');
  log('  2. 或者重启 Obsidian', 'yellow');
  log('  3. 使用命令面板 (Ctrl+P) 输入 "打开终端" 测试\n', 'yellow');
}

try {
  main();
} catch (error) {
  log(`\n❌ 错误: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
}
