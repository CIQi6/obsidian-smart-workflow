/**
 * Rust Servers Build Script (Cargo Workspace)
 * Auto-detect current platform and build the corresponding binaries
 * Supports building individual members or all members in the workspace
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Supported platform configurations
const PLATFORMS = {
  'win32-x64': { 
    target: 'x86_64-pc-windows-msvc',
    ext: '.exe',
    displayName: 'Windows x64'
  },
  'darwin-x64': { 
    target: 'x86_64-apple-darwin',
    ext: '',
    displayName: 'macOS Intel'
  },
  'darwin-arm64': { 
    target: 'aarch64-apple-darwin',
    ext: '',
    displayName: 'macOS Apple Silicon'
  },
  'linux-x64': { 
    target: 'x86_64-unknown-linux-gnu',
    ext: '',
    displayName: 'Linux x64'
  },
  'linux-arm64': { 
    target: 'aarch64-unknown-linux-gnu',
    ext: '',
    displayName: 'Linux ARM64'
  },
};

// Workspace members configuration
const WORKSPACE_MEMBERS = {
  'pty-server': {
    name: 'pty-server',
    displayName: 'PTY Server',
    binaryName: 'pty-server'
  },
  'voice-server': {
    name: 'voice-server',
    displayName: 'Voice Server',
    binaryName: 'voice-server'
  }
};

// Reference binary size (for hints only)
const REFERENCE_BINARY_SIZE = 2 * 1024 * 1024;

// Project paths
const WORKSPACE_DIR = path.join(__dirname, '..', 'rust-servers');
const BINARIES_DIR = path.join(__dirname, '..', 'binaries');

/**
 * Get current platform identifier
 */
function getCurrentPlatform() {
  return `${process.platform}-${process.arch}`;
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    members: [],      // Which members to build (empty = all available)
    skipInstall: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--skip-install') {
      options.skipInstall = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--member' || arg === '-m') {
      if (i + 1 < args.length) {
        options.members.push(args[++i]);
      }
    } else if (arg.startsWith('--member=')) {
      options.members.push(arg.substring('--member='.length));
    }
  }

  return options;
}

/**
 * Show help message
 */
function showHelp() {
  console.log('Rust Servers Build Script (Cargo Workspace)');
  console.log('');
  console.log('Usage: node build-rust.js [OPTIONS]');
  console.log('');
  console.log('Options:');
  console.log('  -m, --member <name>  Build specific member (can be used multiple times)');
  console.log('                       Available members: pty-server, voice-server');
  console.log('  --skip-install       Skip rustup target installation');
  console.log('  -h, --help           Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  node build-rust.js                    # Build all available members');
  console.log('  node build-rust.js -m pty-server      # Build only pty-server');
  console.log('  node build-rust.js -m pty-server -m voice-server  # Build both');
}

/**
 * Get available workspace members (those that exist on disk)
 */
function getAvailableMembers() {
  const available = [];
  for (const [key, config] of Object.entries(WORKSPACE_MEMBERS)) {
    const memberPath = path.join(WORKSPACE_DIR, key);
    if (fs.existsSync(memberPath) && fs.existsSync(path.join(memberPath, 'Cargo.toml'))) {
      available.push({ key, ...config });
    }
  }
  return available;
}

/**
 * Build a single workspace member
 */
function buildMember(member, platformName, config) {
  const binaryName = `${member.binaryName}-${platformName}${config.ext}`;
  const outputPath = path.join(BINARIES_DIR, binaryName);
  
  console.log(`  📦 Building ${member.displayName}...`);
  
  // 1. Clean cache for this member
  console.log('    🧹 Cleaning cache...');
  try {
    execSync(
      `cargo clean -p ${member.name} --release --target ${config.target}`,
      {
        cwd: WORKSPACE_DIR,
        stdio: 'pipe',
        encoding: 'utf8'
      }
    );
  } catch (error) {
    console.log('    ⚠️  Cache clean skipped (may be first build)');
  }
  
  // 2. Compile
  console.log('    📦 Compiling...');
  const startTime = Date.now();
  
  try {
    execSync(
      `cargo build -p ${member.name} --release --target ${config.target}`,
      {
        cwd: WORKSPACE_DIR,
        stdio: 'pipe',
        encoding: 'utf8'
      }
    );
  } catch (error) {
    throw new Error(`Compilation failed for ${member.name}: ${error.stderr || error.message}`);
  }
  
  const buildTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`    ⏱️  Build time: ${buildTime}s`);
  
  // 3. Find build artifact
  const targetDir = path.join(WORKSPACE_DIR, 'target', config.target, 'release');
  const sourceBinary = path.join(targetDir, `${member.binaryName}${config.ext}`);
  
  if (!fs.existsSync(sourceBinary)) {
    throw new Error(`Build artifact not found: ${sourceBinary}`);
  }
  
  // 4. Copy to binaries directory
  console.log('    📋 Copying binary...');
  fs.copyFileSync(sourceBinary, outputPath);
  
  // 5. Verify file size
  const stats = fs.statSync(outputPath);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
  const sizeKB = (stats.size / 1024).toFixed(0);
  
  console.log(`    📊 File size: ${sizeMB} MB (${sizeKB} KB)`);
  
  if (stats.size > REFERENCE_BINARY_SIZE) {
    console.log(`    💡 Note: File size exceeds 2MB reference, this is normal`);
  }
  
  // 6. Generate SHA256 checksum
  console.log('    🔐 Generating SHA256 checksum...');
  const checksum = generateChecksum(outputPath);
  const checksumPath = `${outputPath}.sha256`;
  fs.writeFileSync(checksumPath, `${checksum}  ${binaryName}\n`);
  console.log(`    ✓ SHA256: ${checksum}`);
  
  return { binaryName, outputPath, checksum };
}

/**
 * Generate SHA256 checksum for a file
 */
function generateChecksum(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha256');
  hash.update(fileBuffer);
  return hash.digest('hex');
}

// Main execution
const options = parseArgs();

if (options.help) {
  showHelp();
  process.exit(0);
}

console.log('🦀 Rust Servers Build Script (Cargo Workspace)');
console.log('');

// Detect current platform
const currentPlatform = getCurrentPlatform();
const platformConfig = PLATFORMS[currentPlatform];

if (!platformConfig) {
  console.error(`❌ Error: Current platform "${currentPlatform}" is not supported`);
  console.error(`Supported platforms: ${Object.keys(PLATFORMS).join(', ')}`);
  process.exit(1);
}

console.log(`🔍 Current platform: ${platformConfig.displayName} (${currentPlatform})`);
console.log('');

// Check if Rust is installed
try {
  const rustVersion = execSync('cargo --version', { encoding: 'utf8' });
  console.log(`✅ Rust installed: ${rustVersion.trim()}`);
} catch (error) {
  console.error('❌ Error: Cargo not found');
  console.error('Please install Rust first: https://rustup.rs/');
  process.exit(1);
}

// Check workspace directory
if (!fs.existsSync(WORKSPACE_DIR)) {
  console.error(`❌ Error: Workspace directory not found: ${WORKSPACE_DIR}`);
  process.exit(1);
}

// Create binaries directory
if (!fs.existsSync(BINARIES_DIR)) {
  fs.mkdirSync(BINARIES_DIR, { recursive: true });
  console.log(`📁 Created binaries directory: ${BINARIES_DIR}`);
}

console.log('');

// Get available members
const availableMembers = getAvailableMembers();

if (availableMembers.length === 0) {
  console.error('❌ Error: No workspace members found');
  process.exit(1);
}

console.log(`📦 Available workspace members: ${availableMembers.map(m => m.name).join(', ')}`);

// Determine which members to build
let membersToBuild = availableMembers;

if (options.members.length > 0) {
  // Filter to only requested members
  membersToBuild = [];
  for (const requestedMember of options.members) {
    const found = availableMembers.find(m => m.key === requestedMember || m.name === requestedMember);
    if (found) {
      membersToBuild.push(found);
    } else {
      console.warn(`⚠️  Warning: Member "${requestedMember}" not found or not available`);
    }
  }
  
  if (membersToBuild.length === 0) {
    console.error('❌ Error: No valid members to build');
    process.exit(1);
  }
}

console.log(`🔨 Members to build: ${membersToBuild.map(m => m.name).join(', ')}`);
console.log('');

// Install build target
if (!options.skipInstall) {
  console.log('📦 Installing Rust build target...');
  try {
    console.log(`  - ${platformConfig.target}`);
    execSync(`rustup target add ${platformConfig.target}`, { 
      stdio: 'pipe',
      cwd: WORKSPACE_DIR 
    });
  } catch (error) {
    console.warn(`  ⚠️  Cannot install ${platformConfig.target}, may already be installed`);
  }
  console.log('');
}

// Build each member
console.log(`🔨 Building for ${platformConfig.displayName}...`);
console.log('');

const results = [];
let hasError = false;

for (const member of membersToBuild) {
  try {
    const result = buildMember(member, currentPlatform, platformConfig);
    results.push({ member: member.name, success: true, ...result });
    console.log(`  ✅ ${member.displayName} built successfully`);
    console.log('');
  } catch (error) {
    console.error(`  ❌ ${member.displayName} build failed: ${error.message}`);
    results.push({ member: member.name, success: false, error: error.message });
    hasError = true;
    console.log('');
  }
}

// Summary
console.log('');
console.log('📊 Build Summary:');
for (const result of results) {
  if (result.success) {
    console.log(`  ✅ ${result.member}: ${result.binaryName}`);
  } else {
    console.log(`  ❌ ${result.member}: ${result.error}`);
  }
}

console.log('');
if (hasError) {
  console.log('⚠️  Build completed with errors');
  process.exit(1);
} else {
  console.log('🎉 Build complete!');
  console.log(`📁 Binary location: ${BINARIES_DIR}`);
}
