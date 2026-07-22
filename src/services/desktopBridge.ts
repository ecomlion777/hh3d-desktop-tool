/**
 * HH3D Desktop Tool - Desktop IPC Bridge Abstraction Layer
 * Supports seamless replacement of mock implementation with Electron IPC.
 */

import {
  Profile,
  ProxyItem,
  GroupItem,
  BatchTask,
  LogEntry,
  ActivityConfig,
  GeneralAppSettings,
  SystemStats
} from '../shared';
import {
  generateInitialProxies,
  generateInitialProfiles,
  generateInitialGroups,
  generateInitialBatches,
  generateInitialLogs,
  DEFAULT_ACTIVITY_CONFIG,
  DEFAULT_GENERAL_SETTINGS
} from '../mock';

export type EventListener<T> = (data: T) => void;

export interface IDesktopBridgeService {
  // Profiles
  getProfiles(): Promise<Profile[]>;
  updateProfile(id: string, updates: Partial<Profile>): Promise<Profile | null>;
  addProfile(profile: Partial<Profile>): Promise<Profile>;
  deleteProfiles(ids: string[]): Promise<boolean>;
  startProfiles(ids: string[]): Promise<boolean>;
  stopProfiles(ids: string[]): Promise<boolean>;
  
  // Groups
  getGroups(): Promise<GroupItem[]>;
  addGroup(group: { name: string; description: string; color: string }): Promise<GroupItem>;
  runGroup(groupName: string): Promise<boolean>;
  stopGroup(groupName: string): Promise<boolean>;

  // Proxies
  getProxies(): Promise<ProxyItem[]>;
  testProxy(id: string): Promise<ProxyItem>;
  testAllProxies(): Promise<ProxyItem[]>;
  addProxiesBatch(rawList: string[]): Promise<number>;
  deleteProxies(ids: string[]): Promise<boolean>;

  // Batches
  getBatches(): Promise<BatchTask[]>;
  toggleBatch(id: string): Promise<BatchTask | null>;

  // Logs
  getLogs(): Promise<LogEntry[]>;
  clearLogs(): Promise<boolean>;
  addLog(log: Omit<LogEntry, 'id' | 'timestamp'>): Promise<LogEntry>;

  // Settings
  getActivityConfig(): Promise<ActivityConfig>;
  saveActivityConfig(config: ActivityConfig): Promise<boolean>;
  getGeneralSettings(): Promise<GeneralAppSettings>;
  saveGeneralSettings(settings: GeneralAppSettings): Promise<boolean>;

  // System Stats
  getSystemStats(): Promise<SystemStats>;

  // Events & Subscriptions
  onProfilesUpdated(listener: EventListener<Profile[]>): () => void;
  onLogsUpdated(listener: EventListener<LogEntry[]>): () => void;
  onStatsUpdated(listener: EventListener<SystemStats>): () => void;
}

const STORAGE_KEYS = {
  PROFILES: 'hh3d_desktop_profiles_v1',
  PROXIES: 'hh3d_desktop_proxies_v1',
  GROUPS: 'hh3d_desktop_groups_v1',
  BATCHES: 'hh3d_desktop_batches_v1',
  LOGS: 'hh3d_desktop_logs_v1',
  ACTIVITY_CONFIG: 'hh3d_desktop_activity_config_v1',
  GENERAL_SETTINGS: 'hh3d_desktop_general_settings_v1',
};

class MockDesktopBridgeService implements IDesktopBridgeService {
  private profiles: Profile[] = [];
  private proxies: ProxyItem[] = [];
  private groups: GroupItem[] = [];
  private batches: BatchTask[] = [];
  private logs: LogEntry[] = [];
  private activityConfig: ActivityConfig = DEFAULT_ACTIVITY_CONFIG;
  private generalSettings: GeneralAppSettings = DEFAULT_GENERAL_SETTINGS;

  private profileListeners: EventListener<Profile[]>[] = [];
  private logListeners: EventListener<LogEntry[]>[] = [];
  private statsListeners: EventListener<SystemStats>[] = [];

  private simulationTimer: NodeJS.Timeout | null = null;
  private statsTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.initData();
    this.startBackgroundSimulation();
  }

  private initData() {
    try {
      const savedProxies = localStorage.getItem(STORAGE_KEYS.PROXIES);
      this.proxies = savedProxies ? JSON.parse(savedProxies) : generateInitialProxies();

      const savedProfiles = localStorage.getItem(STORAGE_KEYS.PROFILES);
      this.profiles = savedProfiles ? JSON.parse(savedProfiles) : generateInitialProfiles(this.proxies);

      const savedGroups = localStorage.getItem(STORAGE_KEYS.GROUPS);
      this.groups = savedGroups ? JSON.parse(savedGroups) : generateInitialGroups(this.profiles);

      const savedBatches = localStorage.getItem(STORAGE_KEYS.BATCHES);
      this.batches = savedBatches ? JSON.parse(savedBatches) : generateInitialBatches();

      const savedLogs = localStorage.getItem(STORAGE_KEYS.LOGS);
      this.logs = savedLogs ? JSON.parse(savedLogs) : generateInitialLogs(this.profiles);

      const savedActivity = localStorage.getItem(STORAGE_KEYS.ACTIVITY_CONFIG);
      this.activityConfig = savedActivity ? JSON.parse(savedActivity) : DEFAULT_ACTIVITY_CONFIG;

      const savedGeneral = localStorage.getItem(STORAGE_KEYS.GENERAL_SETTINGS);
      this.generalSettings = savedGeneral ? JSON.parse(savedGeneral) : DEFAULT_GENERAL_SETTINGS;

      // Save initial cache if empty
      if (!savedProfiles) this.saveLocal();
    } catch {
      this.proxies = generateInitialProxies();
      this.profiles = generateInitialProfiles(this.proxies);
      this.groups = generateInitialGroups(this.profiles);
      this.batches = generateInitialBatches();
      this.logs = generateInitialLogs(this.profiles);
    }
  }

  private saveLocal() {
    try {
      localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(this.profiles));
      localStorage.setItem(STORAGE_KEYS.PROXIES, JSON.stringify(this.proxies));
      localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(this.groups));
      localStorage.setItem(STORAGE_KEYS.BATCHES, JSON.stringify(this.batches));
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(this.logs));
      localStorage.setItem(STORAGE_KEYS.ACTIVITY_CONFIG, JSON.stringify(this.activityConfig));
      localStorage.setItem(STORAGE_KEYS.GENERAL_SETTINGS, JSON.stringify(this.generalSettings));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  }

  private notifyProfileListeners() {
    this.profileListeners.forEach(fn => fn([...this.profiles]));
  }

  private notifyLogListeners() {
    this.logListeners.forEach(fn => fn([...this.logs]));
  }

  private startBackgroundSimulation() {
    this.simulationTimer = setInterval(() => {
      let changed = false;

      const runningProfiles = this.profiles.filter(p => p.status === 'running');
      if (runningProfiles.length > 0 && Math.random() > 0.4) {
        const randIndex = Math.floor(Math.random() * runningProfiles.length);
        const target = runningProfiles[randIndex];
        
        if (target.stamina && target.stamina > 5) {
          target.stamina = Math.max(0, target.stamina - 1);
        } else {
          target.status = 'waiting';
          target.currentActivity = 'Chờ Hồi Thể Lực (Resting)';
          target.nextRunTime = 'Sau 15 phút';
          this.addLogInternal({
            level: 'warn',
            profileUid: target.uid,
            profileName: target.displayName || target.characterName,
            message: `Tài khoản ${target.displayName || target.characterName} cạn thể lực (0%). Chuyển sang Chờ Phục Hồi.`,
            source: 'GAME_ENGINE',
            action: 'STAMINA_DEPLETED'
          });
        }
        target.lastActive = new Date().toLocaleTimeString('vi-VN');
        target.updatedAt = new Date().toISOString();
        changed = true;
      }

      if (changed) {
        this.recalculateGroups();
        this.saveLocal();
        this.notifyProfileListeners();
      }
    }, 5000);

    this.statsTimer = setInterval(() => {
      const runningCount = this.profiles.filter(p => p.status === 'running').length;
      const stats: SystemStats = {
        cpuUsage: Math.min(99, Math.floor(18 + (runningCount * 0.35) + Math.random() * 8)),
        ramUsageGb: Number((3.2 + (runningCount * 0.04) + Math.random() * 0.3).toFixed(1)),
        ramTotalGb: 16.0,
        activeConnections: runningCount + Math.floor(Math.random() * 10),
        networkSpeedMbps: Number((12.5 + runningCount * 0.8 + Math.random() * 5).toFixed(1))
      };
      this.statsListeners.forEach(fn => fn(stats));
    }, 2000);
  }

  private recalculateGroups() {
    this.groups = this.groups.map(g => {
      const groupProfiles = this.profiles.filter(p => p.group === g.name || p.groupId === g.id);
      return {
        ...g,
        profileCount: groupProfiles.length,
        runningCount: groupProfiles.filter(p => p.status === 'running').length,
        waitingCount: groupProfiles.filter(p => p.status === 'waiting').length,
        stoppedCount: groupProfiles.filter(p => p.status !== 'running' && p.status !== 'waiting').length,
      };
    });
  }

  private addLogInternal(logData: Omit<LogEntry, 'id' | 'timestamp'>): LogEntry {
    const timeISO = new Date().toISOString();
    const timeStr = new Date().toLocaleTimeString('vi-VN');
    const newLog: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(5)}`,
      timestamp: timeStr,
      action: logData.action || 'LOG_EVENT',
      message: logData.message || '',
      level: logData.level || 'info',
      ...logData
    };
    this.logs.unshift(newLog);
    if (this.logs.length > 500) {
      this.logs = this.logs.slice(0, 500);
    }
    this.notifyLogListeners();
    return newLog;
  }

  // --- API METHODS ---

  async getProfiles(): Promise<Profile[]> {
    return [...this.profiles];
  }

  async updateProfile(id: string, updates: Partial<Profile>): Promise<Profile | null> {
    const idx = this.profiles.findIndex(p => p.id === id);
    if (idx === -1) return null;
    
    this.profiles[idx] = { 
      ...this.profiles[idx], 
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.recalculateGroups();
    this.saveLocal();
    this.notifyProfileListeners();
    return this.profiles[idx];
  }

  async addProfile(profileData: Partial<Profile>): Promise<Profile> {
    const newId = `profile_${Date.now()}`;
    const newStt = this.profiles.length + 1;
    const nowISO = new Date().toISOString();
    const nameVal = profileData.displayName || profileData.characterName || `Char_${newStt}`;
    const uidVal = profileData.uid || `HH3D-${90000 + newStt}`;

    const newProfile: Profile = {
      id: newId,
      uid: uidVal,
      displayName: nameVal,
      avatarUrl: profileData.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=HH3D_Char_${newStt}`,
      groupId: profileData.groupId || 'group_1',
      status: profileData.status || 'stopped',
      profilePath: profileData.profilePath || `C:\\HH3D_AppData\\Profiles\\${newId}`,
      proxyId: profileData.proxyId || 'proxy_1',
      expectedIp: profileData.expectedIp || profileData.currentIp || '103.142.10.100',
      currentIp: profileData.currentIp || '103.142.10.100',
      userAgent: profileData.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      lastLoginAt: nowISO,
      lastRunAt: nowISO,
      nextRunAt: nowISO,
      enabledModules: profileData.enabledModules || ['daily_quest', 'dungeon'],
      createdAt: nowISO,
      updatedAt: nowISO,

      // UI compatibility fields
      stt: newStt,
      characterName: nameVal,
      group: profileData.group || 'Nhóm Chính (Main)',
      proxyAddress: profileData.proxyAddress || '103.142.10.100:8080',
      currentActivity: profileData.currentActivity || 'Vừa khởi tạo',
      nextRunTime: '--:--',
      level: profileData.level || 70,
      stamina: profileData.stamina || 100,
      lastActive: new Date().toLocaleTimeString('vi-VN'),
      ...profileData
    };

    this.profiles.unshift(newProfile);
    this.recalculateGroups();
    this.saveLocal();
    this.notifyProfileListeners();

    this.addLogInternal({
      level: 'info',
      action: 'PROFILE_CREATED',
      profileUid: newProfile.uid,
      profileName: newProfile.displayName,
      message: `Đã thêm tài khoản mới: ${newProfile.displayName} (${newProfile.uid}) vào ${newProfile.group}.`,
      source: 'PROFILE_MANAGER'
    });

    return newProfile;
  }

  async deleteProfiles(ids: string[]): Promise<boolean> {
    const initialCount = this.profiles.length;
    this.profiles = this.profiles.filter(p => !ids.includes(p.id));
    
    // Re-index STT
    this.profiles.forEach((p, index) => {
      p.stt = index + 1;
    });

    this.recalculateGroups();
    this.saveLocal();
    this.notifyProfileListeners();

    this.addLogInternal({
      level: 'warn',
      action: 'PROFILES_DELETED',
      message: `Đã xóa ${initialCount - this.profiles.length} tài khoản khỏi danh sách.`,
      source: 'PROFILE_MANAGER'
    });

    return true;
  }

  async startProfiles(ids: string[]): Promise<boolean> {
    const activities = [
      'Nhiệm Vụ Hàng Ngày (1/10)',
      'Luyện Cấp (Leveling Map 85)',
      'Vượt Phụ Bản Ma Vương',
      'Ủy Thác Đào Khoáng'
    ];

    let startedCount = 0;
    this.profiles = this.profiles.map(p => {
      if (ids.includes(p.id) && p.status !== 'running') {
        startedCount++;
        return {
          ...p,
          status: 'running',
          currentActivity: activities[Math.floor(Math.random() * activities.length)],
          nextRunTime: 'Đang chạy',
          lastActive: new Date().toLocaleTimeString('vi-VN'),
          updatedAt: new Date().toISOString()
        };
      }
      return p;
    });

    if (startedCount > 0) {
      this.recalculateGroups();
      this.saveLocal();
      this.notifyProfileListeners();

      this.addLogInternal({
        level: 'success',
        action: 'PROFILES_STARTED',
        message: `Đã kích hoạt chạy hàng loạt ${startedCount} tài khoản.`,
        source: 'TASK_RUNNER'
      });
    }

    return true;
  }

  async stopProfiles(ids: string[]): Promise<boolean> {
    let stoppedCount = 0;
    this.profiles = this.profiles.map(p => {
      if (ids.includes(p.id) && p.status === 'running') {
        stoppedCount++;
        return {
          ...p,
          status: 'stopped',
          currentActivity: 'Đã Dừng',
          nextRunTime: '--:--',
          updatedAt: new Date().toISOString()
        };
      }
      return p;
    });

    if (stoppedCount > 0) {
      this.recalculateGroups();
      this.saveLocal();
      this.notifyProfileListeners();

      this.addLogInternal({
        level: 'info',
        action: 'PROFILES_STOPPED',
        message: `Đã dừng lệnh cho ${stoppedCount} tài khoản.`,
        source: 'TASK_RUNNER'
      });
    }

    return true;
  }

  async getGroups(): Promise<GroupItem[]> {
    return [...this.groups];
  }

  async addGroup(groupData: { name: string; description: string; color: string }): Promise<GroupItem> {
    const newGroup: GroupItem = {
      id: `group_${Date.now()}`,
      name: groupData.name,
      description: groupData.description,
      profileCount: 0,
      runningCount: 0,
      waitingCount: 0,
      stoppedCount: 0,
      color: groupData.color || '#3b82f6'
    };

    this.groups.push(newGroup);
    this.saveLocal();
    return newGroup;
  }

  async runGroup(groupName: string): Promise<boolean> {
    const groupProfiles = this.profiles.filter(p => p.group === groupName || p.groupId === groupName).map(p => p.id);
    await this.startProfiles(groupProfiles);
    
    this.addLogInternal({
      level: 'success',
      action: 'GROUP_STARTED',
      message: `Kích hoạt khởi chạy toàn bộ nhóm "${groupName}" (${groupProfiles.length} tài khoản).`,
      source: 'GROUP_MANAGER'
    });

    return true;
  }

  async stopGroup(groupName: string): Promise<boolean> {
    const groupProfiles = this.profiles.filter(p => p.group === groupName || p.groupId === groupName).map(p => p.id);
    await this.stopProfiles(groupProfiles);

    this.addLogInternal({
      level: 'warn',
      action: 'GROUP_STOPPED',
      message: `Đã dừng toàn bộ nhóm "${groupName}".`,
      source: 'GROUP_MANAGER'
    });

    return true;
  }

  async getProxies(): Promise<ProxyItem[]> {
    return [...this.proxies];
  }

  async testProxy(id: string): Promise<ProxyItem> {
    const idx = this.proxies.findIndex(px => px.id === id);
    if (idx === -1) throw new Error('Proxy not found');

    this.proxies[idx].status = 'testing';

    await new Promise(r => setTimeout(r, 600));

    const isSuccess = Math.random() > 0.15;
    const latency = isSuccess ? Math.floor(20 + Math.random() * 90) : 0;
    this.proxies[idx].status = isSuccess ? 'active' : 'error';
    this.proxies[idx].latencyMs = latency;
    this.proxies[idx].ping = latency;
    this.proxies[idx].lastCheckedAt = new Date().toISOString();
    this.proxies[idx].lastChecked = new Date().toLocaleTimeString('vi-VN');

    this.saveLocal();
    return this.proxies[idx];
  }

  async testAllProxies(): Promise<ProxyItem[]> {
    for (let i = 0; i < this.proxies.length; i++) {
      const isSuccess = Math.random() > 0.12;
      const latency = isSuccess ? Math.floor(20 + Math.random() * 120) : 0;
      this.proxies[i].status = isSuccess ? 'active' : 'error';
      this.proxies[i].latencyMs = latency;
      this.proxies[i].ping = latency;
      this.proxies[i].lastCheckedAt = new Date().toISOString();
      this.proxies[i].lastChecked = new Date().toLocaleTimeString('vi-VN');
    }

    this.saveLocal();
    this.addLogInternal({
      level: 'info',
      action: 'PROXY_TEST_ALL',
      message: `Kiểm tra tốc độ toàn bộ ${this.proxies.length} Proxy thành công.`,
      source: 'PROXY_MANAGER'
    });

    return [...this.proxies];
  }

  async addProxiesBatch(rawList: string[]): Promise<number> {
    let added = 0;
    rawList.forEach((line) => {
      const trimmed = line.trim();
      if (trimmed) {
        const parts = trimmed.split(':');
        const ip = parts[0] || '127.0.0.1';
        const port = Number(parts[1]) || 8080;
        const user = parts[2] || '';
        const pass = parts[3] || '';

        const latency = Math.floor(30 + Math.random() * 80);
        const newProxy: ProxyItem = {
          id: `proxy_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          protocol: 'SOCKS5',
          host: ip,
          port,
          username: user,
          passwordEncrypted: pass ? `enc_b64_${btoa(pass)}` : undefined,
          expectedIp: ip,
          currentIp: ip,
          latencyMs: latency,
          status: 'active',
          lastCheckedAt: new Date().toISOString(),

          // UI helper fields
          name: `Proxy Import ${this.proxies.length + 1}`,
          ipPort: `${ip}:${port}`,
          ping: latency,
          location: 'Việt Nam (Hà Nội)',
          assignedProfilesCount: 0,
          lastChecked: new Date().toLocaleTimeString('vi-VN')
        };
        this.proxies.unshift(newProxy);
        added++;
      }
    });

    this.saveLocal();
    this.addLogInternal({
      level: 'success',
      action: 'PROXIES_IMPORTED',
      message: `Thêm mới ${added} Proxy thành công vào danh sách.`,
      source: 'PROXY_MANAGER'
    });

    return added;
  }

  async deleteProxies(ids: string[]): Promise<boolean> {
    this.proxies = this.proxies.filter(px => !ids.includes(px.id));
    this.saveLocal();

    this.addLogInternal({
      level: 'warn',
      action: 'PROXIES_DELETED',
      message: `Đã xóa ${ids.length} Proxy khỏi hệ thống.`,
      source: 'PROXY_MANAGER'
    });

    return true;
  }

  async getBatches(): Promise<BatchTask[]> {
    return [...this.batches];
  }

  async toggleBatch(id: string): Promise<BatchTask | null> {
    const idx = this.batches.findIndex(b => b.id === id);
    if (idx === -1) return null;

    const currentStatus = this.batches[idx].status;
    this.batches[idx].status = currentStatus === 'Running' ? 'Cancelled' : 'Running';
    this.saveLocal();

    this.addLogInternal({
      level: 'info',
      action: 'BATCH_TOGGLE',
      message: `Đã ${this.batches[idx].status === 'Running' ? 'kích hoạt' : 'tạm dừng'} lịch chạy: ${this.batches[idx].name || this.batches[idx].title}`,
      source: 'BATCH_SCHEDULE'
    });

    return this.batches[idx];
  }

  async getLogs(): Promise<LogEntry[]> {
    return [...this.logs];
  }

  async clearLogs(): Promise<boolean> {
    this.logs = [];
    this.saveLocal();
    this.notifyLogListeners();
    return true;
  }

  async addLog(log: Omit<LogEntry, 'id' | 'timestamp'>): Promise<LogEntry> {
    return this.addLogInternal(log);
  }

  async getActivityConfig(): Promise<ActivityConfig> {
    return { ...this.activityConfig };
  }

  async saveActivityConfig(config: ActivityConfig): Promise<boolean> {
    this.activityConfig = { ...config };
    this.saveLocal();

    this.addLogInternal({
      level: 'info',
      action: 'SETTINGS_UPDATE',
      message: 'Cập nhật cấu hình kịch bản tự động thành công.',
      source: 'ACTIVITY_SETTINGS'
    });

    return true;
  }

  async getGeneralSettings(): Promise<GeneralAppSettings> {
    return { ...this.generalSettings };
  }

  async saveGeneralSettings(settings: GeneralAppSettings): Promise<boolean> {
    this.generalSettings = { ...settings };
    this.saveLocal();

    this.addLogInternal({
      level: 'info',
      action: 'SETTINGS_UPDATE',
      message: 'Lưu cài đặt ứng dụng tổng quan thành công.',
      source: 'GENERAL_SETTINGS'
    });

    return true;
  }

  async getSystemStats(): Promise<SystemStats> {
    const runningCount = this.profiles.filter(p => p.status === 'running').length;
    return {
      cpuUsage: Math.floor(18 + runningCount * 0.35),
      ramUsageGb: Number((3.2 + runningCount * 0.04).toFixed(1)),
      ramTotalGb: 16.0,
      activeConnections: runningCount + 12,
      networkSpeedMbps: Number((15.4 + runningCount * 0.6).toFixed(1))
    };
  }

  onProfilesUpdated(listener: EventListener<Profile[]>): () => void {
    this.profileListeners.push(listener);
    return () => {
      this.profileListeners = this.profileListeners.filter(l => l !== listener);
    };
  }

  onLogsUpdated(listener: EventListener<LogEntry[]>): () => void {
    this.logListeners.push(listener);
    return () => {
      this.logListeners = this.logListeners.filter(l => l !== listener);
    };
  }

  onStatsUpdated(listener: EventListener<SystemStats>): () => void {
    this.statsListeners.push(listener);
    return () => {
      this.statsListeners = this.statsListeners.filter(l => l !== listener);
    };
  }
}

// Export singleton desktopBridge instance
export const desktopBridge: IDesktopBridgeService = new MockDesktopBridgeService();
