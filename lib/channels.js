/**
 * 渠道注册表（设计 §6 渠道适配器契约的 mind 侧）：分身输出投递的出口。
 *
 * 渠道（im-channel 等）在自身插件面惰性调用 registerMindChannel 注册投递
 * 通路；心智唤醒产出 share/message_out 时经此投递到人。dsh-mind 不感知
 * 渠道差异（G2）——渠道自己决定投递给谁（如 master 绑定）。
 *
 * 进程内注册表：同宿主进程内的插件共享此模块实例（cordis 单例语义）；
 * 宿主重启后由渠道在自身 apply 时重新注册（无持久化需求）。
 */
const channels = new Map();
/** 注册投递通路（幂等：同 id 覆盖）。返回注销函数。 */
export function registerMindChannel(channel) {
    channels.set(channel.id, channel);
    return () => { channels.delete(channel.id); };
}
export function registeredChannels() {
    return [...channels.values()];
}
/** 向全部注册渠道投递（尽力而为：单渠道失败不影响其余，结果逐条上报）。 */
export async function deliverToChannels(payload) {
    const results = [];
    let delivered = 0;
    for (const ch of registeredChannels()) {
        try {
            const ok = await ch.deliver(payload);
            if (ok === true || ok === undefined)
                delivered += 1;
            results.push({ id: ch.id, ok: ok === true });
        }
        catch (e) {
            results.push({ id: ch.id, ok: false, error: e instanceof Error ? e.message : String(e) });
        }
    }
    return { delivered, results };
}
