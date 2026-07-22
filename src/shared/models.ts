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
  groupId: string;
  status: ProfileStatus;
  profilePath: string;
  proxyId: string;
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

/**
 * Standardized Proxy Model
 */
export interface Proxy {
  id: string;
  protocol: 'HTTP' | 'HTTPS' | 'SOCKS5' | 'SOCKS4';
  host: string;
  port: number;
  username?: string;
  password?: string;
  passwordEncrypted?: string;
  expectedIp: string;
  currentIp: string;
  latencyMs: number;
  status: 'online' | 'slow' | 'offline' | 'checking' | 'unknown' | 'active' | 'error' | 'testing' | 'disabled';
  lastCheckedAt: string;

  // UI / Compatibility helper fields
  name?: string;
  ipPort?: string;
  ping?: number;
  location?: string;
  assignedProfilesCount?: number;
  activeRunningProfilesCount?: number;
  lastChecked?: string;
}

export type ProxyItem = Proxy;

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
