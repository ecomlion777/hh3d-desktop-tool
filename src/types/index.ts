/**
 * HH3D Desktop Tool - Types & AppBridge Declarations
 */

import {
  Profile,
  ProxyItem,
  ProxyCreateInput,
  ProxyUpdateInput,
  ProxyImportItem,
  ProxyTestResult,
  ProfileProxyState,
  ProxyStorageInfo,
  ProxyOneToOneAssignmentResult,
  GroupItem,
  BatchTask,
  LogEntry,
  ActivityConfig,
  GeneralAppSettings,
  SystemStats,
  BatchStatus,
  ProfileWorkerStatus,
  WorkerSummary,
  WorkerStartResult,
  WorkerStopResult,
  WorkerStartOptions
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
  startWorkers?(profileIds: string[], options?: WorkerStartOptions): Promise<WorkerStartResult>;
  stopWorkers?(profileIds: string[]): Promise<WorkerStopResult>;
  getWorkerStatus?(profileId: string): Promise<ProfileWorkerStatus>;
  listWorkerStatuses?(): Promise<ProfileWorkerStatus[]>;
  getWorkerSummary?(): Promise<WorkerSummary>;
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

  // Real Proxy Manager
  listProxies(): Promise<ProxyItem[]>;
  getProxy?(proxyId: string): Promise<ProxyItem | null>;
  createProxy?(input: ProxyCreateInput): Promise<ProxyItem>;
  updateProxy?(proxyId: string, changes: ProxyUpdateInput): Promise<ProxyItem>;
  deleteProxy?(proxyId: string): Promise<{ deleted: boolean; affectedProfileIds: string[] }>;
  importProxies?(items: ProxyImportItem[]): Promise<ProxyItem[]>;
  testProxy(proxyId: string): Promise<ProxyTestResult>;
  testManyProxies?(proxyIds: string[]): Promise<ProxyTestResult[]>;
  assignProxy(profileIds: string[], proxyId: string): Promise<boolean>;
  assignProxyToProfiles?(profileIds: string[], proxyId: string): Promise<boolean>;
  assignProxiesOneToOne?(profileIds: string[], proxyIds: string[]): Promise<ProxyOneToOneAssignmentResult | boolean>;
  assignProfilesToProxy?(proxyId: string, profileIds: string[]): Promise<boolean>;
  unassignProxyFromProfiles?(profileIds: string[]): Promise<boolean>;
  getProfileProxyState?(profileId: string): Promise<ProfileProxyState>;
  refreshProfileProxy?(profileId: string): Promise<ProfileProxyState>;
  getProxyStorageInfo?(): Promise<ProxyStorageInfo>;
  // Compatibility aliases used by existing modal wiring.
  addSingleProxy?(proxyData: ProxyCreateInput): Promise<ProxyItem>;
  addProxiesBatch?(items: ProxyImportItem[]): Promise<ProxyItem[]>;
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
  onProxiesChanged?(callback: (proxies: ProxyItem[]) => void): () => void;
  onProxyTestStatusChanged?(callback: (result: ProxyTestResult) => void): () => void;
  onProfileProxyStateChanged?(callback: (state: ProfileProxyState) => void): () => void;
  onWorkerStatusChanged?(callback: (status: ProfileWorkerStatus) => void): () => void;
  onWorkerSummaryChanged?(callback: (summary: WorkerSummary) => void): () => void;
}
