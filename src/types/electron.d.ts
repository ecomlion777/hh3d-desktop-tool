export interface DesktopVersions {
  appVersion: string;
  electronVersion: string;
  chromiumVersion: string;
  nodeVersion: string;
}

export interface DesktopStorageInfo {
  dataDir?: string;
  dataDirectory?: string;
  filePath?: string;
  dataFile?: string;
  schemaVersion?: number;
  profileCount: number;
  groupCount: number;
}

export interface MiniBrowserStatus {
  profileId: string;
  isOpen: boolean;
  state: 'closed' | 'opening' | 'loading' | 'open' | 'error';
  partition?: string;
  currentUrl?: string;
  title?: string;
  openedAt?: string;
  error?: string;
}

export interface ClearSessionResult {
  success: boolean;
  profileId: string;
  message: string;
}

export interface DesktopBridgeAPI {
  getVersions: () => Promise<DesktopVersions>;
  getStorageInfo: () => Promise<DesktopStorageInfo>;

  // Profiles
  listProfiles: () => Promise<any[]>;
  createProfile: (profile: Partial<any>) => Promise<any>;
  updateProfile: (profileId: string, changes: Partial<any>) => Promise<any | null>;
  deleteProfile: (profileId: string) => Promise<boolean>;

  // Groups
  listGroups: () => Promise<any[]>;
  createGroup: (group: Partial<any>) => Promise<any>;
  updateGroup: (groupId: string, changes: Partial<any>) => Promise<any | null>;
  deleteGroup: (groupId: string) => Promise<boolean>;

  // Mini Browser
  openMiniBrowser: (profileId: string) => Promise<MiniBrowserStatus>;
  closeMiniBrowser: (profileId: string) => Promise<MiniBrowserStatus>;
  focusMiniBrowser: (profileId: string) => Promise<boolean>;
  reloadMiniBrowser: (profileId: string) => Promise<boolean>;
  getMiniBrowserStatus: (profileId: string) => Promise<MiniBrowserStatus>;
  listMiniBrowserStatuses: () => Promise<MiniBrowserStatus[]>;
  clearMiniBrowserSession: (profileId: string) => Promise<ClearSessionResult>;
  onMiniBrowserStatusChanged: (callback: (status: MiniBrowserStatus) => void) => () => void;
}

declare global {
  interface Window {
    desktopBridge?: DesktopBridgeAPI;
  }
}
