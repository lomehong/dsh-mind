/**
 * 主人长期事项（missions.md）：主人想让分身长期关心/推进的事。
 * 纯文本（一行一件或一段叙述），每次唤醒注入上下文——分身的议程来源。
 * 与提示词调教面分开：这是「关心什么」（数据），不是「怎么想」（提示词）。
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { mindHome } from './config.ts'

export function missionsPath(): string {
  return join(mindHome(), 'missions.md')
}

/** 读主人长期事项（缺席/异常 → 空串）。 */
export function loadMissions(): string {
  const file = missionsPath()
  if (!existsSync(file)) return ''
  try {
    return readFileSync(file, 'utf8').slice(0, 4000).trim()
  } catch {
    return ''
  }
}

export function saveMissions(text: string): void {
  const file = missionsPath()
  mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.tmp-${process.pid}`
  writeFileSync(tmp, text, { encoding: 'utf8' })
  renameSync(tmp, file)
}
