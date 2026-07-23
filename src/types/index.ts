/**
 * HH3D Desktop Tool - Types & AppBridge Declarations
 */

import {
  Profile,
  ProxyItem,
  GroupItem,
  BatchTask,
  LogEntry,
  ActivityConfig,
  GeneralAppSettings,
  SystemStats,
  BatchStatus
} from '../shared';
import {
  MiniBrowserStatus,
  ClearSessionResult,
  DesktopStorageInfo,
  DesktopVersions
} from './electron';

export * from '../shared';
export * from './electron';

/**
 * AppBridge Interface
 * Decouples the React UI layer from IPC / Mock Data execution.
 */
export interface AppBridge {
  // Profiles Management
  listProfiles(): Promise<Profile[]>;
  createProfile(profile: Partial<Profile>): Promise<Profile>;
  updateProfile(id: string, data: Partial<Profile>): Promise<Profile>;
  deleteProfile(ids: string[]): Promise<boolean>;
  startProfile(ids: string[]): Promise<boolean>;
  stopProfile(ids: string[]): Promise<boolean>;
  openMiniBrowser(profileId: string): Promise<MiniBrowserStatus>;
  closeMiniBrowser?(profileId: string): Promise<MiniBrowserStatus>;
  focusMiniBrowser?(profileId: string): Promise<boolean>;
  reloadMiniBrowser?(profileId: string): Promise<boolean>;
  getMiniBrowserStatus?(profileId: string): Promise<MiniBrowserStatus>;
  listMiniBrowserStatuses?(): Promise<MiniBrowserStatus[]>;
  clearMiniBrowserSession?(profileId: string): Promise<ClearSessionResult>;
  assignGroupForProfiles?(ids: string[], groupName: string): Promise<boolean>;
  toggleModulesForProfiles?(ids: string[], enabledModules: string[]): Promise<boolean>;
  importProfiles?(importedProfiles: Partial<Profile>[]): Promise<boolean>;

  // Proxies Management
  listProxies(): Promise<ProxyItem[]>;
  testProxy(proxyId: string): Promise<ProxyItem>;
  testAllProxies?(): Promise<ProxyItem[]>;
  assignProxy(profileIds: string[], proxyId: string): Promise<boolean>;
  assignProfilesToProxy?(proxyId: string, profileIds: string[]): Promise<boolean>;
  addSingleProxy?(proxyData: Partial<ProxyItem>): Promise<ProxyItem>;
  addProxiesBatch?(lines: string[]): Promise<ProxyItem[]>;
  deleteProxies?(ids: string[]): Promise<boolean>;

  // Batch Tasks Management
  getBatches?(): Promise<BatchTask[]>;
  createBatch?(data: { name: string; profileIds: string[]; concurrency?: number; activityType?: string; groupTarget?: string; status?: BatchStatus }): Promise<BatchTask>;
  updateBatch?(batchId: string, data: Partial<BatchTask>): Promise<BatchTask | null>;
  deleteBatch?(batchId: string): Promise<boolean>;
  startBatch(batchId: string): Promise<boolean>;
  stopBatch(batchId: string): Promise<boolean>;
  resetBatch?(batchId: string): Promise<boolean>;

  // Logs Management
  getLogs(): Promise<LogEntry[]>;
  clearLogs?(): Promise<boolean>;

  // Groups Management
  listGroups?(): Promise<GroupItem[]>;
  createGroup?(group: { name: string; description: string; color: string }): Promise<GroupItem>;
  updateGroup?(groupId: string, changes: Partial<GroupItem>): Promise<GroupItem>;
  deleteGroup?(groupId: string): Promise<boolean>;
  runGroup?(groupName: string): Promise<boolean>;
  stopGroup?(groupName: string): Promise<boolean>;

  // System & Settings
  getActivityConfig?(): Promise<ActivityConfig>;
  saveActivityConfig?(config: ActivityConfig): Promise<boolean>;
  getGeneralSettings?(): Promise<GeneralAppSettings>;
  saveGeneralSettings?(settings: GeneralAppSettings): Promise<boolean>;
  getSystemStats?(): Promise<SystemStats>;
  getStorageInfo?(): Promise<DesktopStorageInfo | null>;
  getVersions?(): Promise<DesktopVersions | null>;

  // Event Listener Subscriptions
  onProfilesUpdated?(callback: (profiles: Profile[]) => void): () => void;
  onBatchesUpdated?(callback: (batches: BatchTask[]) => void): () => void;
  onLogsUpdated?(callback: (logs: LogEntry[]) => void): () => void;
  onStatsUpdated?(callback: (stats: SystemStats) => void): () => void;
  onMiniBrowserStatusChanged?(callback: (status: MiniBrowserStatus) => void): () => void;
}
