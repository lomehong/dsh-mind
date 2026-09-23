import { type PromptBlocks } from './wake-prompt.ts';
export type PromptBlockKey = 'menu' | 'rules' | 'outputFormat' | 'style';
export type PromptOverrides = Partial<Record<PromptBlockKey, string>>;
export declare const PROMPT_BLOCK_KEYS: ReadonlyArray<PromptBlockKey>;
export declare const PROMPT_BLOCK_LABELS: Record<PromptBlockKey, string>;
export declare function promptsPath(): string;
/** 读取覆盖层（缺文件/解析失败/键非法 → 空覆盖；字符串截断 20000）。 */
export declare function loadPromptOverrides(): PromptOverrides;
export declare function savePromptOverrides(overrides: PromptOverrides): void;
/** 解析生效块：覆盖优先，缺席回落内置默认（纯函数，测试用）。 */
export declare function resolveWakePromptBlocks(overrides: PromptOverrides): PromptBlocks;
/** 当前生效四块（便捷封装：读覆盖层并解析）。 */
export declare function resolveCurrentBlocks(): PromptBlocks;
