import type {
  ProxyCreateInput,
  ProxyImportItem,
  ProxyItem,
  ProxyStorageInfo,
  ProxyTestResult,
  ProxyUpdateInput,
  ProfileProxyState,
  ProxyOneToOneAssignmentResult,
  ProfileWorkerStatus,
  WorkerSummary,
  WorkerStartResult,
  WorkerStopResult,
  WorkerStartOptions,
  BatchTask,
  LogEntry,
  ActivityConfig,
  GeneralAppSettings,
  SystemStats
} from '../shared';

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
  proxyCount?: number;
  batchCount?: number;
  logCount?: number;
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

export interface ProxyAssignmentResult {
  profiles: any[];
  states: ProfileProxyState[];
}

export interface DesktopBridgeAPI {
  getVersions: () => Promise<DesktopVersions>;
  getStorageInfo: () => Promise<DesktopStorageInfo>;

  listProfiles: () => Promise<any[]>;
  createProfile: (profile: Partial<any>) => Promise<any>;
  updateProfile: (profileId: string, changes: Partial<any>) => Promise<any | null>;
  deleteProfile: (profileId: string) => Promise<boolean>;

  listGroups: () => Promise<any[]>;
  createGroup: (group: Partial<any>) => Promise<any>;
  updateGroup: (groupId: string, changes: Partial<any>) => Promise<any | null>;
  deleteGroup: (groupId: string) => Promise<boolean>;

  openMiniBrowser: (profileId: string) => Promise<MiniBrowserStatus>;
  closeMiniBrowser: (profileId: string) => Promise<MiniBrowserStatus>;
  focusMiniBrowser: (profileId: string) => Promise<boolean>;
  reloadMiniBrowser: (profileId: string) => Promise<boolean>;
  getMiniBrowserStatus: (profileId: string) => Promise<MiniBrowserStatus>;
  listMiniBrowserStatuses: () => Promise<MiniBrowserStatus[]>;
  clearMiniBrowserSession: (profileId: string) => Promise<ClearSessionResult>;
  onMiniBrowserStatusChanged: (callback: (status: MiniBrowserStatus) => void) => () => void;

  listProxies: () => Promise<ProxyItem[]>;
  getProxy: (proxyId: string) => Promise<ProxyItem | null>;
  createProxy: (input: ProxyCreateInput) => Promise<ProxyItem>;
  updateProxy: (proxyId: string, changes: ProxyUpdateInput) => Promise<ProxyItem>;
  deleteProxy: (proxyId: string) => Promise<{ deleted: boolean; affectedProfileIds: string[] }>;
  importProxies: (items: ProxyImportItem[]) => Promise<ProxyItem[]>;
  testProxy: (proxyId: string) => Promise<ProxyTestResult>;
  testManyProxies: (proxyIds: string[]) => Promise<ProxyTestResult[]>;
  assignProxyToProfiles: (profileIds: string[], proxyId: string) => Promise<ProxyAssignmentResult>;
  assignProxiesOneToOne: (profileIds: string[], proxyIds: string[]) => Promise<ProxyOneToOneAssignmentResult>;
  replaceProfilesForProxy: (proxyId: string, profileIds: string[]) => Promise<ProxyAssignmentResult>;
  unassignProxyFromProfiles: (profileIds: string[]) => Promise<ProxyAssignmentResult>;
  getProfileProxyState: (profileId: string) => Promise<ProfileProxyState>;
  refreshProfileProxy: (profileId: string) => Promise<ProfileProxyState>;
  getProxyStorageInfo: () => Promise<ProxyStorageInfo>;
  onProxiesChanged: (callback: (proxies: ProxyItem[]) => void) => () => void;
  onProxyTestStatusChanged: (callback: (result: ProxyTestResult) => void) => () => void;
  onProfileProxyStateChanged: (callback: (state: ProfileProxyState) => void) => () => void;

  startWorkers: (profileIds: string[], options?: WorkerStartOptions) => Promise<WorkerStartResult>;
  stopWorkers: (profileIds: string[]) => Promise<WorkerStopResult>;
  getWorkerStatus: (profileId: string) => Promise<ProfileWorkerStatus>;
  listWorkerStatuses: () => Promise<ProfileWorkerStatus[]>;
  getWorkerSummary: () => Promise<WorkerSummary>;
  runWorkerGroup: (groupIdOrName: string) => Promise<WorkerStartResult>;
  stopWorkerGroup: (groupIdOrName: string) => Promise<WorkerStopResult>;
  onWorkerStatusChanged: (callback: (status: ProfileWorkerStatus) => void) => () => void;
  onWorkerSummaryChanged: (callback: (summary: WorkerSummary) => void) => () => void;
  onProfilesChanged: (callback: (profiles: any[]) => void) => () => void;

  listBatches: () => Promise<BatchTask[]>;
  createBatch: (input: any) => Promise<BatchTask>;
  updateBatch: (batchId: string, changes: Partial<BatchTask>) => Promise<BatchTask | null>;
  deleteBatch: (batchId: string) => Promise<boolean>;
  startBatch: (batchId: string) => Promise<boolean>;
  stopBatch: (batchId: string) => Promise<boolean>;
  resetBatch: (batchId: string) => Promise<boolean>;
  onBatchesChanged: (callback: (batches: BatchTask[]) => void) => () => void;

  listLogs: (limit?: number) => Promise<LogEntry[]>;
  clearWorkerLogs: () => Promise<boolean>;
  onLogsChanged: (callback: (logs: LogEntry[]) => void) => () => void;

  getActivityConfig: () => Promise<ActivityConfig>;
  saveActivityConfig: (config: ActivityConfig) => Promise<ActivityConfig>;
  getGeneralSettings: () => Promise<GeneralAppSettings>;
  saveGeneralSettings: (settings: GeneralAppSettings) => Promise<GeneralAppSettings>;
  getSystemStats: () => Promise<SystemStats>;
  onStatsChanged: (callback: (stats: SystemStats) => void) => () => void;
}

declare global {
  interface Window {
    desktopBridge?: DesktopBridgeAPI;
  }
}
