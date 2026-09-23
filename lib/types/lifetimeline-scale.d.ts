/**
 * P4 生命时间轴的语义缩放纯函数：
 * - levelForSpan：按可视跨度选粒度（年/月/周/日/时）
 * - bucketStart：把时刻归到该粒度的桶起点（本地时区）
 * - ticksForRange：可视范围内的刻度（含标签）
 *
 * 全部本地时区语义（用本地 Date 构造，不用 UTC 方法）——主人看到的时间
 * 永远是他自己的钟表时间。测试用本地 Date 构造断言，天然时区安全。
 */
export type ScaleLevel = 'year' | 'month' | 'week' | 'day' | 'hour';
/** 视口跨度 → 语义粒度。 */
export declare function levelForSpan(spanMs: number): ScaleLevel;
/** 时刻 → 该粒度的桶起点（epoch ms；本地时区）。 */
export declare function bucketStart(level: ScaleLevel, t: number): number;
/** 桶的下一边界（用于点击下钻的视口范围）。 */
export declare function nextBucketStart(level: ScaleLevel, bucketT: number): number;
export interface Tick {
    t: number;
    label: string;
    major?: boolean;
}
/** 可视范围内的刻度线（含标签；本地时区；粒度语义化）。
 *  包含覆盖可视起点的那个标签（左端第一段也要有名字——友好性）；
 *  跨天的小时粒度：首刻度与零点刻度带日期前缀，零点为主刻度。 */
export declare function ticksForRange(level: ScaleLevel, startMs: number, endMs: number): Tick[];
/** 单粒度桶超出多少条算「密集」（下钻而非直接展示明细）。 */
export declare const DENSE_BUCKET = 30;
