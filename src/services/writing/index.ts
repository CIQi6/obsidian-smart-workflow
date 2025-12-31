/**
 * 写作服务模块导出
 */

export { WritingService } from './writingService';
export type { StreamCallbacks, WritingServiceOptions } from './writingService';

// 错误类型从 ai 模块重新导出，保持向后兼容
export { AIError, AIErrorCode, isAIError, isRetryableError } from '../ai';
