/**
 * P4 生命时间轴的语义缩放纯函数：
 * - levelForSpan：按可视跨度选粒度（年/月/周/日/时）
 * - bucketStart：把时刻归到该粒度的桶起点（本地时区）
 * - ticksForRange：可视范围内的刻度（含标签）
 *
 * 全部本地时区语义（用本地 Date 构造，不用 UTC 方法）——主人看到的时间
 * 永远是他自己的钟表时间。测试用本地 Date 构造断言，天然时区安全。
 */
const DAY = 86_400_000;
const WEEK = 7 * DAY;
/** 视口跨度 → 语义粒度。 */
export function levelForSpan(spanMs) {
    if (spanMs > 550 * DAY)
        return 'year';
    if (spanMs > 45 * DAY)
        return 'month';
    if (spanMs > 7 * DAY)
        return 'week';
    if (spanMs > 36 * 3_600_000)
        return 'day';
    return 'hour';
}
/** 时刻 → 该粒度的桶起点（epoch ms；本地时区）。 */
export function bucketStart(level, t) {
    const d = new Date(t);
    switch (level) {
        case 'year': return new Date(d.getFullYear(), 0, 1).getTime();
        case 'month': return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
        case 'week': {
            const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            const dow = (day.getDay() + 6) % 7; // 周一=0
            return day.getTime() - dow * DAY;
        }
        case 'day': return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        case 'hour': return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()).getTime();
    }
}
/** 桶的下一边界（用于点击下钻的视口范围）。 */
export function nextBucketStart(level, bucketT) {
    const d = new Date(bucketT);
    switch (level) {
        case 'year': return new Date(d.getFullYear() + 1, 0, 1).getTime();
        case 'month': return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
        case 'week': return bucketT + WEEK;
        case 'day': return bucketT + DAY;
        case 'hour': return bucketT + 3_600_000;
    }
}
/** 可视范围内的刻度线（含标签；本地时区；粒度语义化）。
 *  包含覆盖可视起点的那个标签（左端第一段也要有名字——友好性）。 */
export function ticksForRange(level, startMs, endMs) {
    const out = [];
    const from = bucketStart(level, startMs);
    const push = (t, label) => { if (t >= from && t <= endMs)
        out.push({ t, label }); };
    if (level === 'year') {
        const y0 = new Date(startMs).getFullYear();
        const y1 = new Date(endMs).getFullYear();
        for (let y = y0; y <= y1; y++)
            push(new Date(y, 0, 1).getTime(), `${y}年`);
    }
    else if (level === 'month') {
        const cur = new Date(startMs);
        cur.setDate(1);
        cur.setHours(0, 0, 0, 0);
        while (cur.getTime() <= endMs) {
            const t = cur.getTime();
            push(t, `${cur.getMonth() + 1}月`);
            cur.setMonth(cur.getMonth() + 1);
        }
    }
    else if (level === 'week') {
        let t = bucketStart('week', startMs);
        while (t <= endMs) {
            const d = new Date(t);
            push(t, `${d.getMonth() + 1}/${d.getDate()} 周`);
            t += WEEK;
        }
    }
    else if (level === 'day') {
        const cur = new Date(startMs);
        cur.setHours(0, 0, 0, 0);
        while (cur.getTime() <= endMs) {
            const t = cur.getTime();
            push(t, `${cur.getMonth() + 1}/${cur.getDate()}`);
            cur.setDate(cur.getDate() + 1);
        }
    }
    else {
        const cur = new Date(startMs);
        cur.setMinutes(0, 0, 0);
        while (cur.getTime() <= endMs) {
            const t = cur.getTime();
            push(t, `${cur.getHours()}时`);
            cur.setHours(cur.getHours() + 1);
        }
    }
    return out;
}
/** 单粒度桶超出多少条算「密集」（下钻而非直接展示明细）。 */
export const DENSE_BUCKET = 30;
