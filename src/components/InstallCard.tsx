import { useEffect, useState } from 'react';

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/**
 * 「安装到手机桌面」卡片：
 * - 安卓 Chrome 等支持 beforeinstallprompt 的浏览器 → 直接弹原生安装框，一键装
 * - iOS → 显示 Safari 手动步骤
 * - 已装（standalone 模式运行）→ 不显示
 */
export function InstallCard() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(
    () =>
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
  );
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onBip);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return null;

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 500, marginBottom: 8 }}>安装到手机桌面</div>
      {deferred ? (
        <>
          <div className="dim" style={{ fontSize: 12.5, lineHeight: 1.7, marginBottom: 12 }}>
            像装了 App 一样：桌面出现轻账图标，点开全屏、无地址栏。
          </div>
          <button
            className="btn btn-primary"
            onClick={async () => {
              try {
                await deferred.prompt();
                const { outcome } = await deferred.userChoice;
                if (outcome === 'accepted') setInstalled(true);
                else setMsg('已取消安装');
              } catch {
                setMsg('安装未完成，可稍后重试');
              }
            }}
          >
            一键安装
          </button>
        </>
      ) : isIOS ? (
        <div className="dim" style={{ fontSize: 12.5, lineHeight: 1.8 }}>
          用 <b>Safari</b> 打开本页 → 点底部<b>分享按钮</b>（方框 + 向上箭头）→ 选「添加到主屏幕」。
        </div>
      ) : (
        <div className="dim" style={{ fontSize: 12.5, lineHeight: 1.8 }}>
          用 <b>Chrome</b> 打开本页 → 点右上角 <b>⋮</b> → 选「安装应用 / 添加到主屏幕」。
        </div>
      )}
      {msg && (
        <div className="pill orange" style={{ marginTop: 10, display: 'inline-block' }}>
          {msg}
        </div>
      )}
    </div>
  );
}
