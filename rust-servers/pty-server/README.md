# PTY Server

A cross-platform WebSocket PTY server based on Rust and portable-pty, providing terminal functionality for the Smart Workflow Obsidian plugin.

## Overview

PTY Server is a lightweight WebSocket server that manages pseudo-terminal (PTY) sessions. It supports multiple concurrent terminal sessions, automatic shell detection, and provides a cross-platform terminal experience.

## Project Structure

```
rust-servers/
├── Cargo.toml           # Workspace configuration
└── pty-server/
    ├── Cargo.toml       # Project configuration and dependencies
    └── src/
        ├── main.rs          # Main entry point, CLI argument parsing
        ├── server.rs        # WebSocket server implementation
        ├── pty_session.rs   # PTY session management
        └── shell.rs         # Shell detection and configuration
```

## Core Dependencies

- `portable-pty` 0.9 - Cross-platform PTY library for Windows/macOS/Linux
- `tokio` 1.x - Async runtime for high-performance concurrency
- `tokio-tungstenite` 0.21 - WebSocket server implementation
- `serde` + `serde_json` - JSON message serialization/deserialization

## Building

### Local Development Build

```bash
# From workspace root (rust-servers/)
cargo build

# Release build (optimized for size and performance)
cargo build --release

# Build only pty-server
cargo build -p pty-server --release

# Run tests
cargo test
```

### Cross-Platform Build

Use the project's build script:

```bash
# Build for current platform
pnpm build:rust
```

Build artifacts are output to the `binaries/` directory:
- `pty-server-win32-x64.exe` - Windows x64
- `pty-server-darwin-x64` - macOS Intel
- `pty-server-darwin-arm64` - macOS Apple Silicon
- `pty-server-linux-x64` - Linux x64

## Usage

### Command Line Arguments

```bash
# Start server (random port)
./pty-server

# Specify port
./pty-server --port 8080

# Show help
./pty-server --help
```

### Startup Flow

1. Server starts and binds to specified port (random by default)
2. Outputs actual listening port to stdout as JSON: `{"port": 12345, "pid": 67890}`
3. Waits for WebSocket connections
4. Creates independent PTY session for each connection

## Communication Protocol

### WebSocket Message Format

All messages use JSON format with a `type` field to identify message type.

#### Client → Server

**Init Session**
```json
{
  "type": "init",
  "shell_type": "powershell",
  "shell_args": ["-NoLogo"],
  "cwd": "/path/to/vault",
  "env": { "TERM": "xterm-256color" }
}
```

**Resize Terminal**
```json
{
  "type": "resize",
  "cols": 80,
  "rows": 24
}
```

**Text Input**: Send as plain text string
**Binary Input**: Send as binary message

#### Server → Client

**Output Data**: Binary message containing terminal output

## Architecture

### Async Concurrency Model

The server uses Tokio async runtime for efficient concurrent processing:

```
┌─────────────────────────────────────┐
│      WebSocket Server (Tokio)      │
└─────────────────┬───────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
   ┌────▼────┐         ┌────▼────┐
   │ Session │         │ Session │
   │    1    │   ...   │    N    │
   └────┬────┘         └────┬────┘
        │                   │
   ┌────▼────┐         ┌────▼────┐
   │  PTY 1  │         │  PTY N  │
   └─────────┘         └─────────┘
```

### Shell Detection Logic

The server auto-detects available shells by priority:

**Windows**:
1. PowerShell 7+ (`pwsh.exe`)
2. PowerShell 5.x (`powershell.exe`)
3. CMD (`cmd.exe`)

**Unix/Linux/macOS**:
1. User default shell (`$SHELL` environment variable)
2. Bash (`/bin/bash`)
3. Zsh (`/bin/zsh`)
4. Sh (`/bin/sh`)

## Security Considerations

- **Local Binding**: Default listens only on `127.0.0.1`, not exposed externally
- **No Authentication**: Assumes client is on same host, managed by Obsidian plugin
- **Process Isolation**: Each session runs in independent process
