/** electron/preload.cjs가 노출하는 데스크톱 전용 브릿지. 웹에서는 undefined. */
interface DabarDesktop {
  version(): Promise<string>;
  checkUpdate(): Promise<{ current: string; latest: string; hasUpdate: boolean }>;
  installUpdate(): Promise<boolean>;
  onUpdateProgress(cb: (progress: number) => void): void;
}

interface Window {
  dabarDesktop?: DabarDesktop;
}
