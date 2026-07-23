import { Profile, GroupItem } from '../shared';

export interface DesktopVersions {
  appVersion: string;
  electronVersion: string;
  chromiumVersion: string;
  nodeVersion: string;
}

export interface DesktopStorageInfo {
  dataDirectory: string;
  dataFile: string;
  schemaVersion: number;
  profileCount: number;
  groupCount: number;
}

export interface DesktopBridgeAPI {
  getVersions: () => Promise<DesktopVersions>;
  getStorageInfo: () => Promise<DesktopStorageInfo>;

  // Profiles
  listProfiles: () => Promise<Profile[]>;
  createProfile: (profile: Partial<Profile>) => Promise<Profile>;
  updateProfile: (profileId: string, changes: Partial<Profile>) => Promise<Profile | null>;
  deleteProfile: (profileId: string) => Promise<boolean>;

  // Groups
  listGroups: () => Promise<GroupItem[]>;
  createGroup: (group: Partial<GroupItem>) => Promise<GroupItem>;
  updateGroup: (groupId: string, changes: Partial<GroupItem>) => Promise<GroupItem | null>;
  deleteGroup: (groupId: string) => Promise<boolean>;
}

declare global {
  interface Window {
    desktopBridge?: DesktopBridgeAPI;
  }
}
