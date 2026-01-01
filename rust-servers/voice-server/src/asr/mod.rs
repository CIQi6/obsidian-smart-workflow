// ASR (自动语音识别) 模块
// 包含 ASR 引擎抽象层和各供应商实现

use async_trait::async_trait;
use crate::audio::AudioData;

// TODO: Phase 3 实现以下子模块
// pub mod http;       // HTTP 模式实现
// pub mod realtime;   // Realtime 模式实现
// pub mod fallback;   // 兜底策略

/// ASR 错误类型
#[derive(Debug, thiserror::Error)]
pub enum ASRError {
    #[error("网络错误: {0}")]
    NetworkError(String),
    
    #[error("认证失败 ({engine}): {message}")]
    AuthFailed {
        engine: String,
        message: String,
    },
    
    #[error("配额超限 ({engine})")]
    QuotaExceeded {
        engine: String,
    },
    
    #[error("无效的音频格式: {0}")]
    InvalidAudio(String),
    
    #[error("请求超时 ({timeout_ms}ms)")]
    Timeout {
        timeout_ms: u64,
    },
    
    #[error("WebSocket 错误: {0}")]
    WebSocketError(String),
    
    #[error("所有 ASR 引擎失败: 主引擎={primary_error}, 备用引擎={fallback_error:?}")]
    AllEnginesFailed {
        primary_error: String,
        fallback_error: Option<String>,
    },
    
    #[error("引擎未初始化")]
    NotInitialized,
    
    #[error("不支持的操作: {0}")]
    UnsupportedOperation(String),
}

/// ASR 模式
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ASRMode {
    /// WebSocket 实时模式
    Realtime,
    /// HTTP 上传模式
    Http,
}

/// 转录结果
#[derive(Debug, Clone, serde::Serialize)]
pub struct TranscriptionResult {
    /// 转录文本
    pub text: String,
    /// 使用的引擎名称
    pub engine: String,
    /// 是否使用了兜底引擎
    pub used_fallback: bool,
    /// 处理时长 (毫秒)
    pub duration_ms: u64,
}

impl TranscriptionResult {
    /// 创建新的转录结果
    pub fn new(text: String, engine: String, used_fallback: bool, duration_ms: u64) -> Self {
        Self {
            text,
            engine,
            used_fallback,
            duration_ms,
        }
    }
}

/// 部分转录结果 (实时模式)
#[derive(Debug, Clone, serde::Serialize)]
pub struct PartialTranscription {
    /// 部分转录文本
    pub text: String,
    /// 是否为最终结果
    pub is_final: bool,
}

/// ASR 引擎 trait
/// 
/// 所有 ASR 引擎实现都需要实现此 trait
#[async_trait]
pub trait ASREngine: Send + Sync {
    /// 获取引擎名称
    fn name(&self) -> &str;
    
    /// 获取支持的模式
    fn supported_modes(&self) -> Vec<ASRMode>;
    
    /// HTTP 模式转录
    /// 
    /// 将完整的音频数据上传并获取转录结果
    async fn transcribe(&self, audio: &AudioData) -> Result<String, ASRError>;
    
    /// 创建实时会话
    /// 
    /// 返回一个实时 ASR 会话，用于流式转录
    async fn create_realtime_session(&self) -> Result<Box<dyn RealtimeSession>, ASRError>;
}

/// 实时 ASR 会话 trait
/// 
/// 用于流式音频转录
#[async_trait]
pub trait RealtimeSession: Send {
    /// 发送音频块
    async fn send_chunk(&mut self, chunk: &[u8]) -> Result<(), ASRError>;
    
    /// 关闭会话并获取最终结果
    async fn close(&mut self) -> Result<String, ASRError>;
    
    /// 设置部分结果回调
    fn set_partial_callback(&mut self, callback: Box<dyn Fn(&str) + Send + 'static>);
}

/// 重试配置
#[derive(Debug, Clone)]
pub struct RetryConfig {
    /// 最大重试次数
    pub max_retries: u32,
    /// 基础延迟 (毫秒)
    pub base_delay_ms: u64,
    /// 请求超时 (毫秒)
    pub timeout_ms: u64,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_retries: 2,
            base_delay_ms: 500,
            timeout_ms: 6000,
        }
    }
}

// 需要添加 async_trait 依赖
// 由于 async_trait 是一个常用的 crate，我们在 Cargo.toml 中添加它
