export interface DesktopVersions {
  appVersion: string;
  electronVersion: string;
  chromiumVersion: string;
  nodeVersion: string;
}

export interface DesktopBridgeAPI {
  getVersions: () => Promise<DesktopVersions>;
}

declare global {
  interface Window {
    desktopBridge?: DesktopBridgeAPI;
  }
}
