/**
 * Standardized TypeScript Models for HH3D Desktop Suite
 * Located in /src/shared/models.ts
 */

export type ProfileStatus = 'running' | 'waiting' | 'stopped' | 'proxy_error' | 'login_required';

export type ViewTab = 
  | 'dashboard'
  | 'profiles'
  | 'proxies'
  | 'batches'
  | 'activity_settings'
  | 'logs'
  | 'general_settings';

/**
 * Standardized Profile Model
 */
export interface Profile {
  id: string;
  uid: string;
  displayName: string;
  avatarUrl: string;
  groupId: string | null;
  status: ProfileStatus;
  profilePath: string;
  proxyId: string | null;
  expectedIp: string;
  currentIp: string;
  userAgent: string;
  lastLoginAt: string;
  lastRunAt: string;
  nextRunAt: string;
  enabledModules: string[];
  createdAt: string;
  updatedAt: string;

  // UI / Compatibility helper fields
  stt?: number;
  characterName?: string;
  group?: string;
  proxyAddress?: string;
  currentActivity?: string;
  nextRunTime?: string;
  level?: number;
  stamina?: number;
  lastActive?: string;
  notes?: string;
  isSelected?: boolean;
}


export type WorkerRuntimeState =
  | 'queued'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'error'
  | 'proxy_error'
  | 'login_required';

export interface ProfileWorkerStatus {
  profileId: string;
  state: WorkerRuntimeState;
  taskCode: 'session_check';
  batchId?: string;
  queuedAt?: string;
  startedAt?: string;
  lastHeartbeatAt?: string;
  stoppedAt?: string;
  requestCount: number;
  successCount: number;
  failureCount: number;
  retryCount: number;
  lastHttpStatus?: number;
  lastDurationMs?: number;
  error?: string;
  updatedAt: string;
}

export interface WorkerSummary {
  maxConcurrency: number;
  activeCount: number;
  queuedCount: number;
  runningCount: number;
  stoppedCount: number;
  errorCount: number;
  totalTracked: number;
  updatedAt: string;
}

export interface WorkerStartResult {
  requested: number;
  accepted: number;
  skipped: number;
  acceptedProfileIds: string[];
  summary: WorkerSummary;
}

export interface WorkerStopResult {
  stopped: number;
  profileIds: string[];
  summary: WorkerSummary;
}

export interface WorkerStartOptions {
  batchId?: string;
  activityType?: string;
  concurrency?: number;
}

/**
 * Real Proxy Manager public models. Secrets never enter these types.
 */
export type ProxyProtocol = 'http' | 'https' | 'socks4' | 'socks5';
export type ProxyTestState =
  | 'not_tested'
  | 'testing'
  | 'online'
  | 'offline'
  | 'timeout'
  | 'auth_error'
  | 'configuration_error';

export interface Proxy {
  id: string;
  name: string;
  protocol: ProxyProtocol;
  host: string;
  port: number;
  enabled: boolean;
  authRequired: boolean;
  hasCredentials: boolean;
  maskedUsername?: string;
  credentialState?: 'none' | 'saved' | 'decrypt_error';
  notes: string;
  createdAt: string;
  updatedAt: string;
  assignedProfileCount: number;
  testState: ProxyTestState;
  publicIp?: string;
  latencyMs?: number;
  resolvedRule?: string;
  lastCheckedAt?: string;
  testError?: string;

  // Compatibility helpers used by existing profile selectors.
  ipPort?: string;
  assignedProfilesCount?: number;
  activeRunningProfilesCount?: number;
  status?: 'online' | 'offline' | 'testing' | 'unknown';
  currentIp?: string;
  expectedIp?: string;
  ping?: number;
  lastChecked?: string;
  location?: string;
}

export type ProxyItem = Proxy;

export interface ProxyCreateInput {
  name: string;
  protocol: ProxyProtocol;
  host: string;
  port: number;
  enabled: boolean;
  authRequired: boolean;
  username?: string;
  password?: string;
  notes?: string;
}

export interface ProxyUpdateInput extends Partial<ProxyCreateInput> {
  clearCredentials?: boolean;
}

export interface ProxyTestResult {
  proxyId: string;
  testState: ProxyTestState;
  publicIp?: string;
  latencyMs?: number;
  resolvedRule?: string;
  testError?: string;
  checkedAt: string;
}

export interface ProfileProxyState {
  profileId: string;
  proxyId: string | null;
  mode: 'direct' | 'proxy';
  state: 'idle' | 'applying' | 'ready' | 'error';
  resolvedRule?: string;
  error?: string;
  updatedAt: string;
}

export interface ProxyStorageInfo {
  schemaVersion: number;
  proxyCount: number;
  assignedProfileCount: number;
  secretFileExists: boolean;
  encryptionAvailable: boolean;
}

export interface ProxyImportItem extends ProxyCreateInput {
  sourceLine?: number;
}

export interface ProxyOneToOneAssignment {
  profileId: string;
  proxyId: string;
}

export interface ProxyOneToOneAssignmentResult {
  assignments: ProxyOneToOneAssignment[];
  profiles: Profile[];
  states?: ProfileProxyState[];
}

/**
 * Standardized ModuleSetting Model
 */
export interface ModuleSetting {
  profileId: string;
  moduleCode: string;
  enabled: boolean;
  config: Record<string, any>;
  lastResult?: string;
  lastRunAt?: string;
  nextRunAt?: string;
}

/**
 * Standardized Batch Model
 */
export type BatchStatus = 'Preparing' | 'Ready' | 'Running' | 'Completed' | 'PartiallyFailed' | 'Cancelled';

export interface Batch {
  id: string;
  name: string;
  profileIds: string[];
  concurrency: number; // Default 40 (Range 1-50)
  status: BatchStatus;

  // Required display metrics
  totalProfiles: number;
  readyCount: number;
  runningCount: number;
  successCount: number;
  failedCount: number;
  failureCount?: number; // Alias for failedCount

  startedAt?: string;
  completedAt?: string;
  createdAt?: string;

  // UI / Compatibility helper fields
  title?: string;
  groupTarget?: string;
  activityType?: string;
  scheduleCron?: string;
  lastRun?: string;
  nextRun?: string;
  successRate?: number;
  executedProfiles?: number;
}

export type BatchTask = Batch;

/**
 * Standardized RunLog Model
 */
export interface RunLog {
  id: string;
  timestamp: string;
  profileId?: string;
  moduleCode?: string;
  level: 'info' | 'warn' | 'error' | 'success';
  action: string;
  message: string;
  httpStatus?: number;
  durationMs?: number;
  retryCount?: number;

  // UI / Compatibility helper fields
  profileUid?: string;
  profileName?: string;
  source?: string;
}

export type LogEntry = RunLog;

export interface GroupItem {
  id: string;
  name: string;
  description: string;
  profileCount: number;
  runningCount: number;
  waitingCount: number;
  stoppedCount: number;
  color: string;
}

export interface ActivityConfig {
  autoDailyQuest: boolean;
  autoDungeon: boolean;
  autoBossRaid: boolean;
  autoClearInventory: boolean;
  autoClaimMailReward: boolean;
  delayBetweenActions: number;
  maxConcurrentProfiles: number;
  autoReloginOnDisconnect: boolean;
  reloginAttempts: number;
  proxyFailover: boolean;
  scriptPreset: string;
}

export interface GeneralAppSettings {
  websiteBaseUrl: string;
  websiteAllowedHosts: string[];
  theme: 'dark' | 'midnight' | 'cyberpunk';
  maxThreads: number;
  minimizeToTray: boolean;
  autoStartWithSystem: boolean;
  ipcMode: 'mock' | 'electron_bridge';
  proxyTimeout: number;
  checkUpdateAuto: boolean;
  language: 'vi' | 'en';
}

export interface SystemStats {
  cpuUsage: number;
  ramUsageGb: number;
  ramTotalGb: number;
  activeConnections: number;
  networkSpeedMbps: number;
}
