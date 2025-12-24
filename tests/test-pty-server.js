// 测试 PTY 服务器的简单脚本
const WebSocket = require('ws');
const { spawn } = require('child_process');
const path = require('path');

async function testPtyServer() {
  console.log('=== 测试 PTY 服务器 ===\n');
  
  // 启动 PTY 服务器
  const binaryPath = path.join(__dirname, 'binaries', 'pty-server-win32-x64.exe');
  console.log('1. 启动 PTY 服务器:', binaryPath);
  
  const server = spawn(binaryPath, ['--port', '0'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true
  });
  
  // 等待端口信息
  const port = await new Promise((resolve, reject) => {
    let buffer = '';
    const timeout = setTimeout(() => reject(new Error('超时')), 5000);
    
    server.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      console.log('   stdout:', chunk.toString().trim());
      
      try {
        const match = buffer.match(/\{[^}]+\}/);
        if (match) {
          const info = JSON.parse(match[0]);
          if (info.port) {
            clearTimeout(timeout);
            resolve(info.port);
          }
        }
      } catch (e) {}
    });
    
    server.stderr.on('data', (chunk) => {
      console.log('   stderr:', chunk.toString().trim());
    });
    
    server.on('error', reject);
  });
  
  console.log(`\n2. 服务器已启动，端口: ${port}\n`);
  
  // 连接 WebSocket
  console.log('3. 连接 WebSocket...');
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  
  await new Promise((resolve, reject) => {
    ws.on('open', () => {
      console.log('   ✓ WebSocket 已连接\n');
      resolve();
    });
    ws.on('error', reject);
  });
  
  // 接收数据
  ws.on('message', (data) => {
    console.log('   << 收到:', data.toString().substring(0, 100));
  });
  
  // 发送测试命令
  console.log('4. 发送测试命令: echo hello');
  ws.send('echo hello\r\n');
  
  // 等待一段时间
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 清理
  console.log('\n5. 清理资源...');
  ws.close();
  server.kill();
  
  console.log('   ✓ 测试完成\n');
}

testPtyServer().catch(err => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
