/**
 * 提示词覆盖层（心智 Tab 调教面）：四个心智专属文本块（函数菜单/自治守则/
 * 输出格式/消息写作规范）的编辑数据。缺省键 = 内置默认（wake-prompt 常量），
 * 覆盖哪个块只写哪个键；prompts.json 解析失败 → 空覆盖（全默认，绝不抛）。
 *
 * 人格与守卫不在此层（人格走 dsh-twin 人格卡；守卫优先取 dsh-twin GUARD_TEXT，
 * 缺席用兜底）——避免同一文本两处编辑。
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { mindHome } from "./config.js";
import { DEFAULT_PROMPT_BLOCKS } from "./wake-prompt.js";
export const PROMPT_BLOCK_KEYS = ['menu', 'rules', 'outputFormat', 'style'];
export const PROMPT_BLOCK_LABELS = {
    menu: '函数菜单（每次唤醒选一件事的规则）',
    rules: '自治会话守则（无人值守行为约束）',
    outputFormat: '输出格式（FINAL 交接棒格式）',
    style: '消息写作规范（对人说人话）',
};
const MAX_BLOCK_CHARS = 20000;
export function promptsPath() {
    return join(mindHome(), 'prompts.json');
}
/** 读取覆盖层（缺文件/解析失败/键非法 → 空覆盖；字符串截断 20000）。 */
export function loadPromptOverrides() {
    const file = promptsPath();
    if (!existsSync(file))
        return {};
    try {
        const raw = JSON.parse(readFileSync(file, 'utf8'));
        const out = {};
        for (const key of PROMPT_BLOCK_KEYS) {
            const v = raw[key];
            if (typeof v === 'string' && v.trim() !== '')
                out[key] = v.slice(0, MAX_BLOCK_CHARS);
        }
        return out;
    }
    catch {
        return {};
    }
}
export function savePromptOverrides(overrides) {
    const file = promptsPath();
    mkdirSync(dirname(file), { recursive: true });
    const tmp = `${file}.tmp-${process.pid}`;
    writeFileSync(tmp, `${JSON.stringify(overrides, null, 1)}\n`, { encoding: 'utf8' });
    renameSync(tmp, file);
}
/** 解析生效块：覆盖优先，缺席回落内置默认（纯函数，测试用）。 */
export function resolveWakePromptBlocks(overrides) {
    return {
        menu: overrides.menu ?? DEFAULT_PROMPT_BLOCKS.menu,
        rules: overrides.rules ?? DEFAULT_PROMPT_BLOCKS.rules,
        outputFormat: overrides.outputFormat ?? DEFAULT_PROMPT_BLOCKS.outputFormat,
        style: overrides.style ?? DEFAULT_PROMPT_BLOCKS.style,
    };
}
/** 当前生效四块（便捷封装：读覆盖层并解析）。 */
export function resolveCurrentBlocks() {
    return resolveWakePromptBlocks(loadPromptOverrides());
}
