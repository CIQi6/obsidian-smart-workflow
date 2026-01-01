// WebSocket 服务器实现
// 处理语音输入相关的 WebSocket 消息

use tokio::net::TcpListener;
use tokio_tungstenite::{accept_async, tungstenite::Message};
use futures_util::{StreamExt, SinkExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex as TokioMutex;

use crate::config::ASRConfig;

/// 日志宏
macro_rules! log_info {
    ($($arg:tt)*) => {
        eprintln!("[INFO] {}", format!($($arg)*));
    };
}

macro_rules! log_error {
    ($($arg:tt)*) => {
        eprintln!("[ERROR] {}", format!($($arg)*));
    };
}

macro_rules! log_debug {
    ($($arg:tt)*) => {
        if cfg!(debug_assertions) {
            eprintln!("[DEBUG] {}", format!($($arg)*));
        }
    };
}

// ============================================================================
// 客户端 → 服务器 消息
// ============================================================================

/// 录音模式
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RecordingMode {
    Press,  // 按住录音
    Toggle, // 切换录音
}

/// WebSocket 命令消息
#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum ClientMessage {
    /// 开始录音
    #[serde(rename = "start_recording")]
    StartRecording {
        mode: RecordingMode,
        asr_config: ASRConfig,
    },
    
    /// 停止录音
    #[serde(rename = "stop_recording")]
    StopRecording,
    
    /// 取消录音
    #[serde(rename = "cancel_recording")]
    CancelRecording,
    
    /// 更新配置
    #[serde(rename = "update_config")]
    UpdateConfig {
        asr_config: ASRConfig,
    },
}

// ============================================================================
// 服务器 → 客户端 消息
// ============================================================================

/// 录音状态
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RecordingState {
    Started,
    Stopped,
    Cancelled,
}

/// 服务器消息
#[derive(Debug, Serialize)]
#[serde(tag = "type")]
pub enum ServerMessage {
    /// 录音状态变化
    #[serde(rename = "recording_state")]
    RecordingState {
        state: RecordingState,
    },
    
    /// 音频级别 (用于波形显示)
    #[serde(rename = "audio_level")]
    AudioLevel {
        level: f32,
        waveform: Vec<f32>,
    },
    
    /// 转录进度 (实时模式)
    #[serde(rename = "transcription_progress")]
    TranscriptionProgress {
        partial_text: String,
    },
    
    /// 转录完成
    #[serde(rename = "transcription_complete")]
    TranscriptionComplete {
        text: String,
        engine: String,
        used_fallback: bool,
        duration_ms: u64,
    },
    
    /// 错误
    #[serde(rename = "error")]
    Error {
        code: String,
        message: String,
    },
}

// ============================================================================
// 服务器实现
// ============================================================================

/// WebSocket 服务器配置
pub struct ServerConfig {
    pub port: u16,
}

/// WebSocket 服务器
pub struct Server {
    config: ServerConfig,
}

/// 连接状态
struct ConnectionState {
    /// 当前 ASR 配置
    asr_config: Option<ASRConfig>,
    /// 是否正在录音
    is_recording: bool,
    /// 录音模式
    recording_mode: Option<RecordingMode>,
}

impl ConnectionState {
    fn new() -> Self {
        Self {
            asr_config: None,
            is_recording: false,
            recording_mode: None,
        }
    }
}

impl Server {
    pub fn new(config: ServerConfig) -> Self {
        Self { config }
    }

    /// 启动服务器
    pub async fn start(&self) -> Result<u16, Box<dyn std::error::Error>> {
        let addr = format!("127.0.0.1:{}", self.config.port);
        let listener = TcpListener::bind(&addr).await?;
        let local_addr = listener.local_addr()?;
        let port = local_addr.port();

        log_info!("服务器绑定到 {}", local_addr);

        // 输出端口信息到 stdout (JSON 格式)
        // TypeScript 端会解析这个 JSON 来获取端口号
        println!(
            r#"{{"port": {}, "pid": {}}}"#,
            port,
            std::process::id()
        );

        // 主循环：接受 WebSocket 连接
        tokio::spawn(async move {
            log_info!("正在监听 WebSocket 连接...");
            while let Ok((stream, addr)) = listener.accept().await {
                log_debug!("接受来自 {} 的连接", addr);
                tokio::spawn(async move {
                    if let Err(e) = handle_connection(stream).await {
                        log_error!("连接处理错误: {}", e);
                    }
                });
            }
        });

        Ok(port)
    }
}

/// 处理单个 WebSocket 连接
async fn handle_connection(
    stream: tokio::net::TcpStream,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // 升级到 WebSocket
    let ws_stream = accept_async(stream).await?;
    
    log_info!("WebSocket 连接已建立");
    
    // 分离读写流
    let (ws_sender, mut ws_receiver) = ws_stream.split();
    let ws_sender = Arc::new(TokioMutex::new(ws_sender));
    
    // 连接状态
    let state = Arc::new(TokioMutex::new(ConnectionState::new()));
    
    // 消息处理循环
    while let Some(msg_result) = ws_receiver.next().await {
        match msg_result {
            Ok(msg) => {
                log_debug!("收到消息类型: {:?}", std::mem::discriminant(&msg));
                
                match msg {
                    Message::Text(text) => {
                        // 解析 JSON 命令
                        match serde_json::from_str::<ClientMessage>(&text) {
                            Ok(cmd) => {
                                log_debug!("解析命令: {:?}", cmd);
                                if let Err(e) = handle_command(
                                    cmd, 
                                    &state, 
                                    &ws_sender
                                ).await {
                                    log_error!("命令处理错误: {}", e);
                                    // 发送错误消息给客户端
                                    let error_msg = ServerMessage::Error {
                                        code: "COMMAND_ERROR".to_string(),
                                        message: e.to_string(),
                                    };
                                    if let Err(send_err) = send_message(&ws_sender, &error_msg).await {
                                        log_error!("发送错误消息失败: {}", send_err);
                                    }
                                }
                            }
                            Err(e) => {
                                log_error!("JSON 解析错误: {}", e);
                                let error_msg = ServerMessage::Error {
                                    code: "INVALID_MESSAGE".to_string(),
                                    message: format!("无效的消息格式: {}", e),
                                };
                                if let Err(send_err) = send_message(&ws_sender, &error_msg).await {
                                    log_error!("发送错误消息失败: {}", send_err);
                                }
                            }
                        }
                    }
                    Message::Binary(data) => {
                        // 二进制数据 (预留给音频流)
                        log_debug!("收到二进制数据: {} 字节", data.len());
                    }
                    Message::Close(_) => {
                        log_info!("客户端关闭连接");
                        break;
                    }
                    Message::Ping(data) => {
                        // 响应 Ping
                        let mut sender = ws_sender.lock().await;
                        sender.send(Message::Pong(data)).await?;
                    }
                    Message::Pong(_) => {
                        // 忽略 Pong
                    }
                    _ => {
                        log_debug!("忽略的消息类型");
                    }
                }
            }
            Err(e) => {
                log_error!("消息接收错误: {}", e);
                break;
            }
        }
    }
    
    log_info!("WebSocket 连接已关闭");
    
    // 清理：如果正在录音，取消录音
    let mut state_guard = state.lock().await;
    if state_guard.is_recording {
        state_guard.is_recording = false;
        state_guard.recording_mode = None;
        log_info!("连接关闭，取消录音");
    }
    
    Ok(())
}

/// 发送消息给客户端
async fn send_message<S>(
    ws_sender: &Arc<TokioMutex<S>>,
    msg: &ServerMessage,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>>
where
    S: futures_util::Sink<Message> + Unpin,
    S::Error: std::error::Error + Send + Sync + 'static,
{
    let json = serde_json::to_string(msg)?;
    let mut sender = ws_sender.lock().await;
    sender.send(Message::Text(json)).await?;
    Ok(())
}

/// 处理命令消息
async fn handle_command<S>(
    cmd: ClientMessage,
    state: &Arc<TokioMutex<ConnectionState>>,
    ws_sender: &Arc<TokioMutex<S>>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>>
where
    S: futures_util::Sink<Message> + Unpin,
    S::Error: std::error::Error + Send + Sync + 'static,
{
    match cmd {
        ClientMessage::StartRecording { mode, asr_config } => {
            log_info!("收到开始录音命令，模式: {:?}", mode);
            
            let mut state_guard = state.lock().await;
            
            // 检查是否已在录音
            if state_guard.is_recording {
                return Err("已在录音中".into());
            }
            
            // 更新状态
            state_guard.asr_config = Some(asr_config);
            state_guard.is_recording = true;
            state_guard.recording_mode = Some(mode);
            drop(state_guard);
            
            // TODO: 实际启动录音 (Phase 2 实现)
            
            // 发送录音开始状态
            let msg = ServerMessage::RecordingState {
                state: RecordingState::Started,
            };
            send_message(ws_sender, &msg).await?;
        }
        
        ClientMessage::StopRecording => {
            log_info!("收到停止录音命令");
            
            let mut state_guard = state.lock().await;
            
            // 检查是否在录音
            if !state_guard.is_recording {
                return Err("未在录音中".into());
            }
            
            // 更新状态
            state_guard.is_recording = false;
            state_guard.recording_mode = None;
            drop(state_guard);
            
            // TODO: 实际停止录音并进行 ASR 转录 (Phase 2-3 实现)
            
            // 发送录音停止状态
            let msg = ServerMessage::RecordingState {
                state: RecordingState::Stopped,
            };
            send_message(ws_sender, &msg).await?;
            
            // TODO: 发送转录结果 (Phase 3 实现)
            // 临时发送一个占位结果
            let result_msg = ServerMessage::TranscriptionComplete {
                text: "[转录功能待实现]".to_string(),
                engine: "none".to_string(),
                used_fallback: false,
                duration_ms: 0,
            };
            send_message(ws_sender, &result_msg).await?;
        }
        
        ClientMessage::CancelRecording => {
            log_info!("收到取消录音命令");
            
            let mut state_guard = state.lock().await;
            
            // 检查是否在录音
            if !state_guard.is_recording {
                return Err("未在录音中".into());
            }
            
            // 更新状态
            state_guard.is_recording = false;
            state_guard.recording_mode = None;
            drop(state_guard);
            
            // TODO: 实际取消录音 (Phase 2 实现)
            
            // 发送录音取消状态
            let msg = ServerMessage::RecordingState {
                state: RecordingState::Cancelled,
            };
            send_message(ws_sender, &msg).await?;
        }
        
        ClientMessage::UpdateConfig { asr_config } => {
            log_info!("收到更新配置命令");
            
            let mut state_guard = state.lock().await;
            state_guard.asr_config = Some(asr_config);
            
            log_debug!("ASR 配置已更新");
        }
    }
    
    Ok(())
}
