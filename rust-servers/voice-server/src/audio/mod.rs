// 音频模块
// 包含录音、流式处理、编码和工具函数

// TODO: Phase 2 实现以下子模块
// pub mod recorder;    // 音频录制 (cpal)
// pub mod streaming;   // 流式录音
// pub mod encoder;     // WAV/PCM 编码 (hound)
// pub mod utils;       // 音频工具 (VAD、RMS、波形)

/// 音频数据
#[derive(Debug, Clone)]
pub struct AudioData {
    /// 音频采样数据 (f32 格式)
    pub samples: Vec<f32>,
    /// 采样率
    pub sample_rate: u32,
    /// 声道数
    pub channels: u16,
    /// 时长 (毫秒)
    pub duration_ms: u64,
}

impl AudioData {
    /// 创建新的音频数据
    pub fn new(samples: Vec<f32>, sample_rate: u32, channels: u16) -> Self {
        let duration_ms = if sample_rate > 0 && channels > 0 {
            (samples.len() as u64 * 1000) / (sample_rate as u64 * channels as u64)
        } else {
            0
        };
        
        Self {
            samples,
            sample_rate,
            channels,
            duration_ms,
        }
    }
    
    /// 检查音频数据是否为空
    pub fn is_empty(&self) -> bool {
        self.samples.is_empty()
    }
    
    /// 获取采样数量
    pub fn sample_count(&self) -> usize {
        self.samples.len()
    }
}

/// 音频块 (用于流式传输)
#[derive(Debug, Clone)]
pub struct AudioChunk {
    /// 音频数据 (PCM 字节)
    pub data: Vec<u8>,
    /// 时间戳 (毫秒)
    pub timestamp: u64,
    /// 采样率
    pub sample_rate: u32,
}

/// 波形数据 (用于 UI 显示)
#[derive(Debug, Clone, serde::Serialize)]
pub struct WaveformData {
    /// 音量级别 (0-1 范围)
    pub levels: Vec<f32>,
    /// 时间戳 (毫秒)
    pub timestamp: u64,
}

impl WaveformData {
    /// 创建新的波形数据
    pub fn new(levels: Vec<f32>, timestamp: u64) -> Self {
        Self { levels, timestamp }
    }
    
    /// 创建空的波形数据
    pub fn empty() -> Self {
        Self {
            levels: vec![0.0; 9], // 9 条柱状图
            timestamp: 0,
        }
    }
}
