/**
 * AppBridge Implementation & Service Abstraction
 * 
 * Provides:
 * - MockAppBridge: Web Browser simulator implementation using localStorage
 * - ElectronPreloadBridge: Native Electron window.electron.ipcRenderer bridge template
 */

import {
  AppBridge,
  Profile,
  ProxyItem,
  GroupItem,
  BatchTask,
  LogEntry,
  ActivityConfig,
  GeneralAppSettings,
  SystemStats,
  MiniBrowserStatus,
  ClearSessionResult,
  ProxyCreateInput,
  ProxyUpdateInput,
  ProxyImportItem,
  ProxyTestResult,
  ProfileProxyState,
  ProxyStorageInfo,
  ProxyOneToOneAssignmentResult,
  ProfileWorkerStatus,
  WorkerSummary,
  WorkerStartResult,
  WorkerStopResult,
  WorkerStartOptions
} from '../types';

import { DesktopStorageInfo, DesktopVersions } from '../types/electron';

import {
  generateInitialProxies,
  generateInitialProfiles,
  generateInitialGroups,
  generateInitialBatches,
  generateInitialLogs,
  DEFAULT_ACTIVITY_CONFIG,
  DEFAULT_GENERAL_SETTINGS
} from '../mock';


const STORAGE_KEYS = {
  PROFILES: 'hh3d_desktop_profiles_v1',
  PROXIES: 'hh3d_desktop_proxies_v1',
  GROUPS: 'hh3d_desktop_groups_v1',
  BATCHES: 'hh3d_desktop_batches_v1',
  LOGS: 'hh3d_desktop_logs_v1',
  ACTIVITY_CONFIG: 'hh3d_desktop_activity_config_v1',
  GENERAL_SETTINGS: 'hh3d_desktop_general_settings_v1'
};

/**
 * MockAppBridge - In-memory & LocalStorage Bridge implementation for Web Preview
 */
export class MockAppBridge implements AppBridge {
  private profiles: Profile[] = [];
  private proxies: ProxyItem[] = [];
  private groups: GroupItem[] = [];
  private batches: BatchTask[] = [];
  private logs: LogEntry[] = [];
  private activityConfig: ActivityConfig = DEFAULT_ACTIVITY_CONFIG;
  private generalSettings: GeneralAppSettings = DEFAULT_GENERAL_SETTINGS;

  private profileSubscribers: ((profiles: Profile[]) => void)[] = [];
  private batchSubscribers: ((batches: BatchTask[]) => void)[] = [];
  private logSubscribers: ((logs: LogEntry[]) => void)[] = [];
  private statsSubscribers: ((stats: SystemStats) => void)[] = [];
  private activeBatchIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();

  private notifyBatchesUpdated() {
    localStorage.setItem(STORAGE_KEYS.BATCHES, JSON.stringify(this.batches));
    this.batchSubscribers.forEach(cb => cb([...this.batches]));
  }

  constructor() {
    this.initData();
    this.startBackgroundSimulations();
  }

  private initData() {
    try {
      const storedProxies = localStorage.getItem(STORAGE_KEYS.PROXIES);
      if (storedProxies) {
        this.proxies = JSON.parse(storedProxies);
      } else {
        this.proxies = generateInitialProxies();
        localStorage.setItem(STORAGE_KEYS.PROXIES, JSON.stringify(this.proxies));
      }

      const storedProfiles = localStorage.getItem(STORAGE_KEYS.PROFILES);
      if (storedProfiles) {
        this.profiles = JSON.parse(storedProfiles);
      } else {
        this.profiles = generateInitialProfiles(this.proxies);
        localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(this.profiles));
      }

      const storedGroups = localStorage.getItem(STORAGE_KEYS.GROUPS);
      if (storedGroups) {
        this.groups = JSON.parse(storedGroups);
      } else {
        this.groups = generateInitialGroups(this.profiles);
        localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(this.groups));
      }

      const storedBatches = localStorage.getItem(STORAGE_KEYS.BATCHES);
      if (storedBatches) {
        this.batches = JSON.parse(storedBatches);
      } else {
        this.batches = generateInitialBatches();
        localStorage.setItem(STORAGE_KEYS.BATCHES, JSON.stringify(this.batches));
      }

      const storedLogs = localStorage.getItem(STORAGE_KEYS.LOGS);
      if (storedLogs) {
        this.logs = JSON.parse(storedLogs);
      } else {
        this.logs = generateInitialLogs(this.profiles);
        localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(this.logs));
      }

      const storedAct = localStorage.getItem(STORAGE_KEYS.ACTIVITY_CONFIG);
      if (storedAct) {
        this.activityConfig = JSON.parse(storedAct);
      }

      const storedGen = localStorage.getItem(STORAGE_KEYS.GENERAL_SETTINGS);
      if (storedGen) {
        this.generalSettings = JSON.parse(storedGen);
      }
    } catch (err) {
      console.warn('MockAppBridge storage load warning:', err);
      this.proxies = generateInitialProxies();
      this.profiles = generateInitialProfiles(this.proxies);
      this.groups = generateInitialGroups(this.profiles);
      this.batches = generateInitialBatches();
      this.logs = generateInitialLogs(this.profiles);
    }
  }

  private persistProfiles() {
    try {
      localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(this.profiles));
      this.notifyProfileSubscribers();
    } catch (e) {
      console.error('Failed to persist profiles:', e);
    }
  }

  private persistProxies() {
    try {
      localStorage.setItem(STORAGE_KEYS.PROXIES, JSON.stringify(this.proxies));
    } catch (e) {
      console.error('Failed to persist proxies:', e);
    }
  }

  private notifyProfileSubscribers() {
    this.profileSubscribers.forEach(cb => cb([...this.profiles]));
  }

  private addLogMessage(level: 'info' | 'warn' | 'error' | 'success', source: string, message: string, profileUid?: string, profileName?: string) {
    const newLog: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: new Date().toLocaleTimeString('vi-VN'),
      level,
      action: source || 'LOG_EVENT',
      moduleCode: source,
      source,
      message,
      profileUid,
      profileName
    };
    this.logs.unshift(newLog);
    if (this.logs.length > 500) {
      this.logs = this.logs.slice(0, 500);
    }
    try {
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(this.logs));
    } catch (e) {}
    this.logSubscribers.forEach(cb => cb([...this.logs]));
  }

  private startBackgroundSimulations() {
    setInterval(() => {
      let updated = false;
      this.profiles.forEach(p => {
        if (p.status === 'running') {
          p.lastActive = new Date().toLocaleTimeString('vi-VN');
          p.updatedAt = new Date().toISOString();
          if (p.stamina && Math.random() < 0.15) {
            p.stamina = Math.max(5, p.stamina - 1);
            updated = true;
          }
        }
      });
      if (updated) {
        this.persistProfiles();
      }

      const runningCount = this.profiles.filter(p => p.status === 'running').length;
      const cpuUsage = Math.min(95, Math.floor(12 + runningCount * 0.45 + Math.random() * 8));
      const ramUsageGb = Number((2.4 + runningCount * 0.08 + Math.random() * 0.3).toFixed(1));
      
      this.statsSubscribers.forEach(cb => cb({
        cpuUsage,
        ramUsageGb,
        ramTotalGb: 16.0,
        activeConnections: runningCount * 2 + 12,
        networkSpeedMbps: Number((12.5 + runningCount * 0.3 + Math.random() * 5).toFixed(1))
      }));
    }, 4000);
  }

  // --- Required AppBridge Interface Methods ---

  async listProfiles(): Promise<Profile[]> {
    return [...this.profiles];
  }

  async createProfile(profileData: Partial<Profile>): Promise<Profile> {
    const uidVal = profileData.uid ? profileData.uid.trim() : '';
    if (!uidVal) {
      throw new Error('UID Game không được để trống!');
    }

    const idVal = profileData.id ? profileData.id.trim() : `profile_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const duplicateId = this.profiles.some(p => p.id === idVal);
    if (duplicateId) {
      throw new Error(`Internal ID "${idVal}" đã tồn tại trong hệ thống! Không cho phép hai profile có cùng internal ID.`);
    }

    const nowISO = new Date().toISOString();
    const sttVal = this.profiles.length + 1;
    const nameVal = profileData.displayName || profileData.characterName || 'NewCharacter';
    const groupVal = profileData.group || (this.groups[0]?.name || 'Nhóm Chính (Main)');
    const pxId = profileData.proxyId || (this.proxies[0]?.id || 'proxy_1');
    const pxAddress = profileData.proxyAddress || (this.proxies[0]?.ipPort || '103.142.10.100:8080');
    const currentIpVal = profileData.currentIp || (pxAddress.split(':')[0] || '103.142.10.100');

    const newProfile: Profile = {
      id: idVal,
      uid: uidVal,
      displayName: nameVal,
      avatarUrl: profileData.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${Date.now()}`,
      groupId: profileData.groupId || (this.groups[0]?.id || 'group_1'),
      status: profileData.status || 'stopped',
      profilePath: profileData.profilePath || `C:\\HH3D_AppData\\Profiles\\${idVal}`,
      proxyId: pxId,
      expectedIp: profileData.expectedIp || currentIpVal,
      currentIp: currentIpVal,
      userAgent: profileData.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      lastLoginAt: profileData.lastLoginAt || nowISO,
      lastRunAt: profileData.lastRunAt || nowISO,
      nextRunAt: profileData.nextRunAt || nowISO,
      enabledModules: profileData.enabledModules || ['daily_quest', 'dungeon'],
      createdAt: profileData.createdAt || nowISO,
      updatedAt: profileData.updatedAt || nowISO,

      // UI compatibility fields
      stt: sttVal,
      characterName: nameVal,
      group: groupVal,
      proxyAddress: pxAddress,
      currentActivity: profileData.currentActivity || 'Vừa khởi tạo',
      nextRunTime: '--:--',
      level: profileData.level || 70,
      stamina: profileData.stamina || 100,
      lastActive: new Date().toLocaleTimeString('vi-VN'),
      notes: profileData.notes || '',
      isSelected: false,
      ...profileData
    };

    this.profiles.unshift(newProfile);
    this.persistProfiles();
    this.addLogMessage('info', 'PROFILE_MANAGER', `Khởi tạo profile thành công: ${newProfile.displayName}`, newProfile.uid, newProfile.displayName);
    return newProfile;
  }

  async updateProfile(id: string, data: Partial<Profile>): Promise<Profile> {
    const idx = this.profiles.findIndex(p => p.id === id);
    if (idx === -1) {
      throw new Error(`Profile ID ${id} không tồn tại!`);
    }

    if (data.uid !== undefined && !data.uid.trim()) {
      throw new Error('UID Game không được để trống!');
    }

    if (data.id !== undefined && data.id !== id) {
      const duplicate = this.profiles.some(p => p.id === data.id);
      if (duplicate) {
        throw new Error(`Internal ID "${data.id}" đã tồn tại! Không cho phép hai profile có cùng internal ID.`);
      }
    }

    this.profiles[idx] = {
      ...this.profiles[idx],
      ...data,
      updatedAt: new Date().toISOString()
    };
    this.persistProfiles();
    this.addLogMessage('info', 'PROFILE_MANAGER', `Cập nhật profile thành công: ${this.profiles[idx].displayName || this.profiles[idx].uid}`);
    return this.profiles[idx];
  }

  async assignGroupForProfiles(ids: string[], groupName: string): Promise<boolean> {
    const g = this.groups.find(item => item.name === groupName || item.id === groupName);
    const gName = g ? g.name : groupName;
    const gId = g ? g.id : 'group_1';

    this.profiles = this.profiles.map(p => {
      if (ids.includes(p.id)) {
        return {
          ...p,
          group: gName,
          groupId: gId,
          updatedAt: new Date().toISOString()
        };
      }
      return p;
    });
    this.persistProfiles();
    this.addLogMessage('info', 'PROFILE_MANAGER', `Gán nhóm "${gName}" cho ${ids.length} profiles.`);
    return true;
  }

  async toggleModulesForProfiles(ids: string[], enabledModules: string[]): Promise<boolean> {
    this.profiles = this.profiles.map(p => {
      if (ids.includes(p.id)) {
        return {
          ...p,
          enabledModules: [...enabledModules],
          updatedAt: new Date().toISOString()
        };
      }
      return p;
    });
    this.persistProfiles();
    this.addLogMessage('info', 'PROFILE_MANAGER', `Cập nhật module kịch bản cho ${ids.length} profiles.`);
    return true;
  }

  async importProfiles(newProfiles: Partial<Profile>[]): Promise<boolean> {
    const existingIds = new Set(this.profiles.map(p => p.id));
    const createdProfiles: Profile[] = [];

    for (let i = 0; i < newProfiles.length; i++) {
      const pData = newProfiles[i];

      const uidVal = pData.uid ? pData.uid.trim() : '';
      if (!uidVal) {
        throw new Error(`Profile thứ ${i + 1}: UID không được để trống!`);
      }

      let idVal = pData.id ? pData.id.trim() : `profile_${Date.now()}_${i}_${Math.floor(Math.random() * 1000)}`;
      if (existingIds.has(idVal)) {
        throw new Error(`Profile thứ ${i + 1}: Internal ID "${idVal}" đã tồn tại! Không cho phép trùng internal ID.`);
      }
      existingIds.add(idVal);

      const nowISO = new Date().toISOString();
      const sttVal = this.profiles.length + createdProfiles.length + 1;
      const nameVal = pData.displayName || pData.characterName || `Char_${uidVal}`;
      const groupVal = pData.group || (this.groups[0]?.name || 'Nhóm Chính (Main)');
      const pxId = pData.proxyId || (this.proxies[0]?.id || 'proxy_1');
      const pxAddress = pData.proxyAddress || (this.proxies[0]?.ipPort || '103.142.10.100:8080');

      const created: Profile = {
        id: idVal,
        uid: uidVal,
        displayName: nameVal,
        characterName: nameVal,
        avatarUrl: pData.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${uidVal}`,
        groupId: pData.groupId || 'group_1',
        group: groupVal,
        status: pData.status || 'stopped',
        profilePath: pData.profilePath || `C:\\HH3D_AppData\\Profiles\\${idVal}`,
        proxyId: pxId,
        proxyAddress: pxAddress,
        expectedIp: pData.expectedIp || '103.142.10.100',
        currentIp: pData.currentIp || '103.142.10.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        lastLoginAt: nowISO,
        lastRunAt: nowISO,
        nextRunAt: nowISO,
        enabledModules: pData.enabledModules || ['daily_quest', 'dungeon'],
        createdAt: nowISO,
        updatedAt: nowISO,
        stt: sttVal,
        currentActivity: pData.currentActivity || 'Nhập từ JSON',
        nextRunTime: '--:--',
        level: pData.level || 70,
        stamina: pData.stamina || 100,
        lastActive: new Date().toLocaleTimeString('vi-VN'),
        notes: pData.notes || '',
        isSelected: false,
        ...pData
      };

      createdProfiles.push(created);
    }

    this.profiles = [...createdProfiles, ...this.profiles];
    this.persistProfiles();
    this.addLogMessage('success', 'PROFILE_MANAGER', `Đã import thành công ${createdProfiles.length} profiles mới.`);
    return true;
  }

  async deleteProfile(ids: string[]): Promise<boolean> {
    this.profiles = this.profiles.filter(p => !ids.includes(p.id));
    this.persistProfiles();
    this.addLogMessage('warn', 'PROFILE_MANAGER', `Đã xóa ${ids.length} profiles khỏi hệ thống.`);
    return true;
  }

  async startProfile(ids: string[]): Promise<boolean> {
    let count = 0;
    this.profiles = this.profiles.map(p => {
      if (ids.includes(p.id)) {
        count++;
        return {
          ...p,
          status: 'running',
          currentActivity: 'Nhiệm Vụ Hàng Ngày',
          nextRunTime: 'Đang chạy',
          lastActive: new Date().toLocaleTimeString('vi-VN'),
          updatedAt: new Date().toISOString()
        };
      }
      return p;
    });

    if (count > 0) {
      this.persistProfiles();
      this.addLogMessage('success', 'TASK_ENGINE', `Đã bật ${count} profile.`);
    }
    return true;
  }

  async stopProfile(ids: string[]): Promise<boolean> {
    let count = 0;
    this.profiles = this.profiles.map(p => {
      if (ids.includes(p.id)) {
        count++;
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

    if (count > 0) {
      this.persistProfiles();
      this.addLogMessage('info', 'TASK_ENGINE', `Đã tắt ${count} profile.`);
    }
    return true;
  }

  private mockMiniBrowserStatuses: Map<string, MiniBrowserStatus> = new Map();
  private miniBrowserSubscribers: ((status: MiniBrowserStatus) => void)[] = [];

  async openMiniBrowser(profileId: string): Promise<MiniBrowserStatus> {
    const target = this.profiles.find(p => p.id === profileId);

    if (!target) {
      throw new Error(`Profile ID "${profileId}" does not exist.`);
    }

    const result: MiniBrowserStatus = {
      profileId,
      isOpen: true,
      state: 'open',
      currentUrl: 'https://hoathinh3d.co/',
      title: `HH3D Mini Browser – ${target.displayName || target.characterName} – ${target.uid}`,
      openedAt: new Date().toISOString()
    };

    this.mockMiniBrowserStatuses.set(profileId, result);
    this.miniBrowserSubscribers.forEach(callback => callback({ ...result }));
    this.addLogMessage('info', 'MINI_BROWSER', `Mở Cửa Sổ Mini Browser cho Profile ID: ${profileId}`);

    return result;
  }

  async closeMiniBrowser(profileId: string): Promise<MiniBrowserStatus> {
    const existing = this.mockMiniBrowserStatuses.get(profileId);
    const target = this.profiles.find(p => p.id === profileId);

    const result: MiniBrowserStatus = {
      profileId,
      isOpen: false,
      state: 'closed',
      currentUrl: existing?.currentUrl || '',
      title: existing?.title || (target ? `HH3D Mini Browser – ${target.displayName || target.characterName} – ${target.uid}` : '')
    };

    this.mockMiniBrowserStatuses.set(profileId, result);
    this.miniBrowserSubscribers.forEach(cb => cb({ ...result }));
    this.addLogMessage('info', 'MINI_BROWSER', `Đóng Cửa Sổ Mini Browser của Profile ID: ${profileId}`);

    return result;
  }

  async focusMiniBrowser(profileId: string): Promise<boolean> {
    const existing = this.mockMiniBrowserStatuses.get(profileId);
    if (existing && existing.isOpen) {
      this.miniBrowserSubscribers.forEach(cb => cb({ ...existing }));
      return true;
    }
    return false;
  }

  async reloadMiniBrowser(profileId: string): Promise<boolean> {
    const existing = this.mockMiniBrowserStatuses.get(profileId);
    if (existing && existing.isOpen) {
      const loadingObj: MiniBrowserStatus = {
        ...existing,
        state: 'loading'
      };
      this.miniBrowserSubscribers.forEach(cb => cb({ ...loadingObj }));
      setTimeout(() => {
        const readyObj: MiniBrowserStatus = {
          ...existing,
          state: 'open'
        };
        this.mockMiniBrowserStatuses.set(profileId, readyObj);
        this.miniBrowserSubscribers.forEach(cb => cb({ ...readyObj }));
      }, 500);
      return true;
    }
    return false;
  }

  async getMiniBrowserStatus(profileId: string): Promise<MiniBrowserStatus> {
    return this.mockMiniBrowserStatuses.get(profileId) || {
      profileId,
      isOpen: false,
      state: 'closed',
      currentUrl: '',
      title: ''
    };
  }

  async listMiniBrowserStatuses(): Promise<MiniBrowserStatus[]> {
    return Array.from(this.mockMiniBrowserStatuses.values());
  }

  async clearMiniBrowserSession(profileId: string): Promise<ClearSessionResult> {
    await this.closeMiniBrowser(profileId);
    this.addLogMessage('warn', 'MINI_BROWSER', `Xóa toàn bộ Session Cookies & Cache cho Profile ID: ${profileId}`);
    return {
      success: true,
      profileId,
      message: `Session data was cleared for profile "${profileId}".`
    };
  }

  onMiniBrowserStatusChanged(callback: (status: MiniBrowserStatus) => void): () => void {
    this.miniBrowserSubscribers.push(callback);
    return () => {
      this.miniBrowserSubscribers = this.miniBrowserSubscribers.filter(cb => cb !== callback);
    };
  }

  private recalculateProxyStats() {
    const counts = new Map<string, number>();
    for (const profile of this.profiles) {
      if (profile.proxyId) {
        counts.set(profile.proxyId, (counts.get(profile.proxyId) || 0) + 1);
      }
    }
    this.proxies = this.proxies.map(proxy => ({
      ...proxy,
      assignedProfileCount: counts.get(proxy.id) || 0,
      assignedProfilesCount: counts.get(proxy.id) || 0
    }));
  }

  async listProxies(): Promise<ProxyItem[]> {
    this.recalculateProxyStats();
    return this.proxies.map(proxy => ({ ...proxy }));
  }

  async getProxy(proxyId: string): Promise<ProxyItem | null> {
    return this.proxies.find(proxy => proxy.id === proxyId) || null;
  }

  async createProxy(input: ProxyCreateInput): Promise<ProxyItem> {
    const duplicate = this.proxies.some(proxy => proxy.name.trim().toLowerCase() === input.name.trim().toLowerCase());
    if (duplicate) throw new Error(`Tên proxy "${input.name}" đã tồn tại.`);
    const now = new Date().toISOString();
    const proxy: ProxyItem = {
      id: `mock_proxy_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      name: input.name.trim(),
      protocol: input.protocol,
      host: input.host.trim(),
      port: Number(input.port),
      enabled: input.enabled !== false,
      authRequired: Boolean(input.authRequired),
      hasCredentials: Boolean(input.authRequired && input.username && input.password),
      maskedUsername: input.username ? `${input.username[0]}***` : undefined,
      credentialState: input.authRequired ? 'saved' : 'none',
      notes: input.notes || '',
      createdAt: now,
      updatedAt: now,
      assignedProfileCount: 0,
      testState: 'not_tested',
      ipPort: `${input.host}:${input.port}`,
      status: 'unknown'
    };
    this.proxies.unshift(proxy);
    this.persistProxies();
    return { ...proxy };
  }

  async updateProxy(proxyId: string, changes: ProxyUpdateInput): Promise<ProxyItem> {
    const index = this.proxies.findIndex(proxy => proxy.id === proxyId);
    if (index < 0) throw new Error('Proxy không tồn tại.');
    const existing = this.proxies[index];
    const nextHost = changes.host?.trim() || existing.host;
    const nextPort = changes.port !== undefined ? Number(changes.port) : existing.port;
    const credentialsUpdated = Boolean(changes.password);
    const updated: ProxyItem = {
      id: existing.id,
      name: changes.name?.trim() || existing.name,
      protocol: changes.protocol || existing.protocol,
      host: nextHost,
      port: nextPort,
      enabled: changes.enabled !== undefined ? changes.enabled : existing.enabled,
      authRequired: changes.clearCredentials ? false : (changes.authRequired ?? existing.authRequired),
      hasCredentials: changes.clearCredentials ? false : (credentialsUpdated ? true : existing.hasCredentials),
      maskedUsername: changes.clearCredentials
        ? undefined
        : (changes.username ? `${changes.username[0]}***` : existing.maskedUsername),
      credentialState: changes.clearCredentials ? 'none' : (credentialsUpdated ? 'saved' : existing.credentialState),
      notes: changes.notes !== undefined ? changes.notes : existing.notes,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
      assignedProfileCount: existing.assignedProfileCount,
      testState: existing.testState,
      publicIp: existing.publicIp,
      latencyMs: existing.latencyMs,
      resolvedRule: existing.resolvedRule,
      lastCheckedAt: existing.lastCheckedAt,
      testError: existing.testError,
      ipPort: `${nextHost}:${nextPort}`,
      assignedProfilesCount: existing.assignedProfilesCount,
      activeRunningProfilesCount: existing.activeRunningProfilesCount,
      status: existing.status,
      currentIp: existing.currentIp,
      expectedIp: existing.expectedIp,
      ping: existing.ping,
      lastChecked: existing.lastChecked,
      location: existing.location
    };
    this.proxies[index] = updated;
    this.persistProxies();
    return { ...updated };
  }

  async deleteProxy(proxyId: string): Promise<{ deleted: boolean; affectedProfileIds: string[] }> {
    const affectedProfileIds = this.profiles.filter(profile => profile.proxyId === proxyId).map(profile => profile.id);
    this.proxies = this.proxies.filter(proxy => proxy.id !== proxyId);
    this.profiles = this.profiles.map(profile => affectedProfileIds.includes(profile.id) ? {
      ...profile,
      proxyId: null,
      proxyAddress: 'Không dùng Proxy'
    } : profile);
    this.persistProxies();
    this.persistProfiles();
    return { deleted: true, affectedProfileIds };
  }

  async importProxies(items: ProxyImportItem[]): Promise<ProxyItem[]> {
    const created: ProxyItem[] = [];
    for (const item of items) {
      created.push(await this.createProxy(item));
    }
    return created;
  }

  async testProxy(proxyId: string): Promise<ProxyTestResult> {
    const proxy = this.proxies.find(item => item.id === proxyId);
    if (!proxy) throw new Error('Proxy không tồn tại.');

    const result: ProxyTestResult = {
      proxyId,
      testState: 'configuration_error',
      resolvedRule: 'WEB_PREVIEW_MOCK_ONLY',
      testError: 'Web Preview không thể thay đổi hoặc kiểm tra proxy Electron thật.',
      checkedAt: new Date().toISOString()
    };

    this.proxies = this.proxies.map(item => item.id === proxyId ? {
      ...item,
      testState: result.testState,
      publicIp: undefined,
      latencyMs: undefined,
      lastCheckedAt: result.checkedAt,
      testError: result.testError,
      status: 'unknown'
    } : item);
    this.persistProxies();
    return result;
  }

  async testManyProxies(proxyIds: string[]): Promise<ProxyTestResult[]> {
    const results: ProxyTestResult[] = [];
    for (const proxyId of proxyIds) results.push(await this.testProxy(proxyId));
    return results;
  }

  async assignProxy(profileIds: string[], proxyId: string): Promise<boolean> {
    const proxy = this.proxies.find(item => item.id === proxyId);
    if (!proxy || !proxy.enabled) return false;
    this.profiles = this.profiles.map(profile => profileIds.includes(profile.id) ? {
      ...profile,
      proxyId,
      proxyAddress: `${proxy.host}:${proxy.port}`,
      updatedAt: new Date().toISOString()
    } : profile);
    this.persistProfiles();
    this.recalculateProxyStats();
    this.persistProxies();
    return true;
  }

  async assignProxyToProfiles(profileIds: string[], proxyId: string): Promise<boolean> {
    return this.assignProxy(profileIds, proxyId);
  }


  async assignProxiesOneToOne(
    profileIds: string[],
    proxyIds: string[]
  ): Promise<ProxyOneToOneAssignmentResult> {
    if (profileIds.length === 0 || profileIds.length !== proxyIds.length) {
      throw new Error('Số profile phải bằng số proxy khi gán 1-1.');
    }
    if (new Set(profileIds).size !== profileIds.length) {
      throw new Error('Danh sách profile bị trùng.');
    }
    if (new Set(proxyIds).size !== proxyIds.length) {
      throw new Error('Mỗi profile phải dùng một proxy khác nhau.');
    }

    const profileSet = new Set(profileIds);
    const proxyMap = new Map(this.proxies.map(proxy => [proxy.id, proxy]));
    const missingProfile = profileIds.find(id => !this.profiles.some(profile => profile.id === id));
    if (missingProfile) throw new Error(`Profile ID "${missingProfile}" không tồn tại.`);

    const invalidProxy = proxyIds.find(id => !proxyMap.get(id)?.enabled);
    if (invalidProxy) throw new Error(`Proxy ID "${invalidProxy}" không tồn tại hoặc đang tắt.`);

    const assignmentMap = new Map(profileIds.map((profileId, index) => [profileId, proxyIds[index]]));
    this.profiles = this.profiles.map(profile => {
      if (!profileSet.has(profile.id)) return profile;
      const proxyId = assignmentMap.get(profile.id)!;
      const proxy = proxyMap.get(proxyId)!;
      return {
        ...profile,
        proxyId,
        proxyAddress: `${proxy.host}:${proxy.port}`,
        currentIp: '',
        expectedIp: '',
        updatedAt: new Date().toISOString()
      };
    });
    this.persistProfiles();
    this.recalculateProxyStats();
    this.persistProxies();

    return {
      assignments: profileIds.map((profileId, index) => ({ profileId, proxyId: proxyIds[index] })),
      profiles: profileIds
        .map(profileId => this.profiles.find(profile => profile.id === profileId))
        .filter((profile): profile is Profile => Boolean(profile)),
      states: profileIds.map((profileId, index) => ({
        profileId,
        proxyId: proxyIds[index],
        mode: 'proxy' as const,
        state: 'idle' as const,
        updatedAt: new Date().toISOString()
      }))
    };
  }

  async assignProfilesToProxy(proxyId: string, profileIds: string[]): Promise<boolean> {
    const proxy = this.proxies.find(item => item.id === proxyId);
    if (!proxy || !proxy.enabled) return false;
    this.profiles = this.profiles.map(profile => {
      if (profileIds.includes(profile.id)) {
        return { ...profile, proxyId, proxyAddress: `${proxy.host}:${proxy.port}`, updatedAt: new Date().toISOString() };
      }
      if (profile.proxyId === proxyId) {
        return { ...profile, proxyId: null, proxyAddress: 'Không dùng Proxy', updatedAt: new Date().toISOString() };
      }
      return profile;
    });
    this.persistProfiles();
    this.recalculateProxyStats();
    this.persistProxies();
    return true;
  }

  async unassignProxyFromProfiles(profileIds: string[]): Promise<boolean> {
    this.profiles = this.profiles.map(profile => profileIds.includes(profile.id) ? {
      ...profile,
      proxyId: null,
      proxyAddress: 'Không dùng Proxy',
      updatedAt: new Date().toISOString()
    } : profile);
    this.persistProfiles();
    this.recalculateProxyStats();
    this.persistProxies();
    return true;
  }

  async getProfileProxyState(profileId: string): Promise<ProfileProxyState> {
    const profile = this.profiles.find(item => item.id === profileId);
    return {
      profileId,
      proxyId: profile?.proxyId || null,
      mode: profile?.proxyId ? 'proxy' : 'direct',
      state: 'ready',
      resolvedRule: profile?.proxyId ? 'MOCK PROXY' : 'DIRECT',
      updatedAt: new Date().toISOString()
    };
  }

  async refreshProfileProxy(profileId: string): Promise<ProfileProxyState> {
    return this.getProfileProxyState(profileId);
  }

  async getProxyStorageInfo(): Promise<ProxyStorageInfo> {
    return {
      schemaVersion: 2,
      proxyCount: this.proxies.length,
      assignedProfileCount: this.profiles.filter(profile => Boolean(profile.proxyId)).length,
      secretFileExists: false,
      encryptionAvailable: false
    };
  }

  async addSingleProxy(proxyData: ProxyCreateInput): Promise<ProxyItem> {
    return this.createProxy(proxyData);
  }

  async addProxiesBatch(items: ProxyImportItem[]): Promise<ProxyItem[]> {
    return this.importProxies(items);
  }

  async deleteProxies(ids: string[]): Promise<boolean> {
    for (const id of ids) await this.deleteProxy(id);
    return true;
  }

  async getBatches(): Promise<BatchTask[]> {
    return [...this.batches];
  }

  async createBatch(data: {
    name: string;
    profileIds: string[];
    concurrency?: number;
    activityType?: string;
    groupTarget?: string;
    status?: import('../shared').BatchStatus;
  }): Promise<BatchTask> {
    const concurrency = Math.min(Math.max(data.concurrency || 40, 1), 50);
    const totalProfiles = data.profileIds.length;
    const initialStatus = data.status || 'Ready';

    const newBatch: BatchTask = {
      id: `batch_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: data.name.trim() || `Batch Run (${totalProfiles} profiles)`,
      title: data.name.trim() || `Batch Run (${totalProfiles} profiles)`,
      profileIds: data.profileIds,
      concurrency,
      status: initialStatus,
      totalProfiles,
      readyCount: totalProfiles,
      runningCount: 0,
      successCount: 0,
      failedCount: 0,
      failureCount: 0,
      activityType: data.activityType || 'Nhiệm Vụ Hàng Ngày',
      groupTarget: data.groupTarget || 'Tất Cả Profiles',
      createdAt: new Date().toISOString()
    };

    this.batches.unshift(newBatch);
    this.notifyBatchesUpdated();
    this.addLogMessage('info', 'BATCH_MANAGER', `Tạo mới Batch Task "${newBatch.name}" với ${totalProfiles} profiles (Concurrency: ${concurrency}).`);
    return newBatch;
  }

  async updateBatch(batchId: string, data: Partial<BatchTask>): Promise<BatchTask | null> {
    const idx = this.batches.findIndex(b => b.id === batchId);
    if (idx === -1) return null;

    let concurrency = this.batches[idx].concurrency;
    if (data.concurrency !== undefined) {
      concurrency = Math.min(Math.max(data.concurrency, 1), 50);
    }

    this.batches[idx] = {
      ...this.batches[idx],
      ...data,
      concurrency
    };

    this.notifyBatchesUpdated();
    this.addLogMessage('info', 'BATCH_MANAGER', `Cập nhật cấu hình Batch "${this.batches[idx].name}".`);
    return this.batches[idx];
  }

  async deleteBatch(batchId: string): Promise<boolean> {
    if (this.activeBatchIntervals.has(batchId)) {
      clearInterval(this.activeBatchIntervals.get(batchId)!);
      this.activeBatchIntervals.delete(batchId);
    }
    this.batches = this.batches.filter(b => b.id !== batchId);
    this.notifyBatchesUpdated();
    this.addLogMessage('warn', 'BATCH_MANAGER', `Xóa Batch Task ID: ${batchId}`);
    return true;
  }

  async startBatch(batchId: string): Promise<boolean> {
    const target = this.batches.find(b => b.id === batchId);
    if (!target) return false;

    // If starting from finished/cancelled state or empty run, reset progress counters
    if (
      target.status === 'Completed' ||
      target.status === 'PartiallyFailed' ||
      target.status === 'Cancelled' ||
      target.readyCount + target.runningCount === 0
    ) {
      target.readyCount = target.totalProfiles;
      target.runningCount = 0;
      target.successCount = 0;
      target.failedCount = 0;
      target.failureCount = 0;
    }

    target.status = 'Running';
    target.startedAt = new Date().toISOString();
    this.addLogMessage('info', 'BATCH_MANAGER', `[MÔ PHỎNG BẮT ĐẦU] Batch "${target.name}" với Concurrency = ${target.concurrency}`);
    this.notifyBatchesUpdated();

    // Clear existing timer if running
    if (this.activeBatchIntervals.has(batchId)) {
      clearInterval(this.activeBatchIntervals.get(batchId)!);
      this.activeBatchIntervals.delete(batchId);
    }

    // Interval tick for step-by-step simulation
    const interval = setInterval(() => {
      const b = this.batches.find(item => item.id === batchId);
      if (!b || b.status !== 'Running') {
        clearInterval(interval);
        this.activeBatchIntervals.delete(batchId);
        return;
      }

      const limit = Math.min(Math.max(b.concurrency || 40, 1), 50);

      // Move profiles from ready to running up to limit
      if (b.runningCount < limit && b.readyCount > 0) {
        const availableSlots = limit - b.runningCount;
        const toMove = Math.min(availableSlots, b.readyCount, Math.max(1, Math.ceil(limit / 2)));
        b.readyCount -= toMove;
        b.runningCount += toMove;
      }

      // Finish some running profiles
      if (b.runningCount > 0) {
        const finishing = Math.min(b.runningCount, Math.floor(Math.random() * 4) + 1);
        for (let i = 0; i < finishing; i++) {
          b.runningCount--;
          const isSuccess = Math.random() > 0.08; // ~92% success rate
          if (isSuccess) {
            b.successCount = (b.successCount || 0) + 1;
          } else {
            b.failedCount = (b.failedCount || 0) + 1;
            b.failureCount = b.failedCount;
          }
        }
      }

      // Check if completely processed
      if (b.readyCount === 0 && b.runningCount === 0) {
        b.completedAt = new Date().toISOString();
        if (b.failedCount > 0) {
          b.status = 'PartiallyFailed';
        } else {
          b.status = 'Completed';
        }
        clearInterval(interval);
        this.activeBatchIntervals.delete(batchId);
        this.addLogMessage(
          b.failedCount > 0 ? 'warn' : 'success',
          'BATCH_MANAGER',
          `[MÔ PHỎNG HOÀN THÀNH] Batch "${b.name}". Thành công: ${b.successCount}, Thất bại: ${b.failedCount}`
        );
      }

      this.notifyBatchesUpdated();
    }, 600);

    this.activeBatchIntervals.set(batchId, interval);
    return true;
  }

  async stopBatch(batchId: string): Promise<boolean> {
    const target = this.batches.find(b => b.id === batchId);
    if (!target) return false;

    if (this.activeBatchIntervals.has(batchId)) {
      clearInterval(this.activeBatchIntervals.get(batchId)!);
      this.activeBatchIntervals.delete(batchId);
    }

    target.status = 'Cancelled';
    this.addLogMessage('warn', 'BATCH_MANAGER', `[MÔ PHỎNG DỪNG] Đã dừng Batch Task "${target.name}".`);
    this.notifyBatchesUpdated();
    return true;
  }

  async resetBatch(batchId: string): Promise<boolean> {
    const target = this.batches.find(b => b.id === batchId);
    if (!target) return false;

    if (this.activeBatchIntervals.has(batchId)) {
      clearInterval(this.activeBatchIntervals.get(batchId)!);
      this.activeBatchIntervals.delete(batchId);
    }

    target.status = 'Ready';
    target.readyCount = target.totalProfiles;
    target.runningCount = 0;
    target.successCount = 0;
    target.failedCount = 0;
    target.failureCount = 0;
    target.startedAt = '';
    target.completedAt = '';

    this.notifyBatchesUpdated();
    this.addLogMessage('info', 'BATCH_MANAGER', `[RESET] Đã đặt lại trạng thái Batch "${target.name}" về Ready.`);
    return true;
  }

  async getLogs(): Promise<LogEntry[]> {
    return [...this.logs];
  }

  async clearLogs(): Promise<boolean> {
    this.logs = [];
    localStorage.removeItem(STORAGE_KEYS.LOGS);
    this.logSubscribers.forEach(cb => cb([]));
    return true;
  }

  async listGroups(): Promise<GroupItem[]> {
    return [...this.groups];
  }

  async createGroup(group: { name: string; description: string; color: string }): Promise<GroupItem> {
    const newGroup: GroupItem = {
      id: `group_${Date.now()}`,
      name: group.name,
      description: group.description,
      profileCount: 0,
      runningCount: 0,
      waitingCount: 0,
      stoppedCount: 0,
      color: group.color || '#10b981'
    };
    this.groups.push(newGroup);
    localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(this.groups));
    this.addLogMessage('info', 'GROUP_MANAGER', `Tạo nhóm mới: ${newGroup.name}`);
    return newGroup;
  }

  async updateGroup(groupId: string, changes: Partial<GroupItem>): Promise<GroupItem> {
    const index = this.groups.findIndex(g => g.id === groupId);
    if (index === -1) throw new Error(`Group ${groupId} not found`);
    const updated = { ...this.groups[index], ...changes };
    this.groups[index] = updated;
    if (changes.name) {
      this.profiles = this.profiles.map(p => p.groupId === groupId ? { ...p, group: changes.name } : p);
      this.persistProfiles();
    }
    try {
      localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(this.groups));
    } catch (e) {}
    this.addLogMessage('info', 'GROUP_MANAGER', `Cập nhật nhóm: ${updated.name}`);
    return updated;
  }

  async deleteGroup(groupId: string): Promise<boolean> {
    const groupToDelete = this.groups.find(g => g.id === groupId);
    this.groups = this.groups.filter(g => g.id !== groupId);
    this.profiles = this.profiles.map(p => p.groupId === groupId ? { ...p, groupId: null as any, group: 'Chưa Phân Nhóm' } : p);
    this.persistProfiles();
    try {
      localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(this.groups));
    } catch (e) {}
    if (groupToDelete) {
      this.addLogMessage('info', 'GROUP_MANAGER', `Xóa nhóm: ${groupToDelete.name}`);
    }
    return true;
  }

  async runGroup(groupName: string): Promise<boolean> {
    const targets = this.profiles.filter(p => p.group === groupName || p.groupId === groupName).map(p => p.id);
    return this.startProfile(targets);
  }

  async stopGroup(groupName: string): Promise<boolean> {
    const targets = this.profiles.filter(p => p.group === groupName || p.groupId === groupName).map(p => p.id);
    return this.stopProfile(targets);
  }

  async getActivityConfig(): Promise<ActivityConfig> {
    return { ...this.activityConfig };
  }

  async saveActivityConfig(config: ActivityConfig): Promise<boolean> {
    this.activityConfig = { ...config };
    localStorage.setItem(STORAGE_KEYS.ACTIVITY_CONFIG, JSON.stringify(this.activityConfig));
    this.addLogMessage('info', 'ACTIVITY_SETTINGS', 'Cập nhật cài đặt kịch bản.');
    return true;
  }

  async getGeneralSettings(): Promise<GeneralAppSettings> {
    return { ...this.generalSettings };
  }

  async saveGeneralSettings(settings: GeneralAppSettings): Promise<boolean> {
    this.generalSettings = { ...settings };
    localStorage.setItem(STORAGE_KEYS.GENERAL_SETTINGS, JSON.stringify(this.generalSettings));
    this.addLogMessage('info', 'GENERAL_SETTINGS', 'Cập nhật cài đặt chung.');
    return true;
  }

  async getSystemStats(): Promise<SystemStats> {
    const runningCount = this.profiles.filter(p => p.status === 'running').length;
    return {
      cpuUsage: Math.floor(12 + runningCount * 0.45),
      ramUsageGb: Number((2.4 + runningCount * 0.08).toFixed(1)),
      ramTotalGb: 16.0,
      activeConnections: runningCount * 2 + 12,
      networkSpeedMbps: 15.2
    };
  }

  async getStorageInfo(): Promise<DesktopStorageInfo | null> {
    return {
      dataDirectory: 'Web LocalStorage (Browser Simulator)',
      dataFile: STORAGE_KEYS.PROFILES,
      schemaVersion: 1,
      profileCount: this.profiles.length,
      groupCount: this.groups.length
    };
  }

  async getVersions(): Promise<DesktopVersions | null> {
    return {
      appVersion: '2.5.0',
      electronVersion: '39.8.10 (Simulated)',
      chromiumVersion: '132.0.0.0 (Browser)',
      nodeVersion: '22.0.0 (Web)'
    };
  }

  onProfilesUpdated(callback: (profiles: Profile[]) => void): () => void {
    this.profileSubscribers.push(callback);
    return () => {
      this.profileSubscribers = this.profileSubscribers.filter(cb => cb !== callback);
    };
  }

  onBatchesUpdated(callback: (batches: BatchTask[]) => void): () => void {
    this.batchSubscribers.push(callback);
    return () => {
      this.batchSubscribers = this.batchSubscribers.filter(cb => cb !== callback);
    };
  }

  onLogsUpdated(callback: (logs: LogEntry[]) => void): () => void {
    this.logSubscribers.push(callback);
    return () => {
      this.logSubscribers = this.logSubscribers.filter(cb => cb !== callback);
    };
  }

  onStatsUpdated(callback: (stats: SystemStats) => void): () => void {
    this.statsSubscribers.push(callback);
    return () => {
      this.statsSubscribers = this.statsSubscribers.filter(cb => cb !== callback);
    };
  }
}

/**
 * ElectronPreloadBridge - Native Electron Bridge using window.desktopBridge contextBridge
 */
export class ElectronPreloadBridge implements AppBridge {
  private mockFallbackInstance: MockAppBridge | null = null;

  private get mockFallback(): MockAppBridge {
    if (!this.mockFallbackInstance) {
      this.mockFallbackInstance = new MockAppBridge();
    }
    return this.mockFallbackInstance;
  }

  private get bridge() {
    return typeof window !== 'undefined' ? window.desktopBridge : undefined;
  }

  // Profiles (Native Electron JSON Storage only)
  async listProfiles(): Promise<Profile[]> {
    if (this.bridge?.listProfiles) {
      return await this.bridge.listProfiles();
    }
    throw new Error('API desktopBridge.listProfiles() không khả dụng trong môi trường Electron.');
  }

  async createProfile(data: Partial<Profile>): Promise<Profile> {
    if (this.bridge?.createProfile) {
      return await this.bridge.createProfile(data);
    }
    throw new Error('API desktopBridge.createProfile() không khả dụng trong môi trường Electron.');
  }

  async updateProfile(id: string, data: Partial<Profile>): Promise<Profile> {
    if (this.bridge?.updateProfile) {
      const updated = await this.bridge.updateProfile(id, data);
      if (updated) return updated;
      throw new Error(`Cập nhật profile ${id} thất bại.`);
    }
    throw new Error('API desktopBridge.updateProfile() không khả dụng trong môi trường Electron.');
  }

  async deleteProfile(ids: string[]): Promise<boolean> {
    if (this.bridge?.deleteProfile) {
      for (const id of ids) {
        await this.bridge.deleteProfile(id);
      }
      return true;
    }
    throw new Error('API desktopBridge.deleteProfile() không khả dụng trong môi trường Electron.');
  }

  private requireWorkerBridge() {
    const bridge = this.bridge;
    if (!bridge?.startWorkers || !bridge?.stopWorkers) {
      throw new Error('Electron Worker Core IPC không khả dụng.');
    }
    return bridge;
  }

  async startProfile(ids: string[]): Promise<boolean> {
    await this.requireWorkerBridge().startWorkers(ids);
    return true;
  }

  async stopProfile(ids: string[]): Promise<boolean> {
    await this.requireWorkerBridge().stopWorkers(ids);
    return true;
  }

  async startWorkers(profileIds: string[], options?: WorkerStartOptions): Promise<WorkerStartResult> {
    return this.requireWorkerBridge().startWorkers(profileIds, options);
  }

  async stopWorkers(profileIds: string[]): Promise<WorkerStopResult> {
    return this.requireWorkerBridge().stopWorkers(profileIds);
  }

  async getWorkerStatus(profileId: string): Promise<ProfileWorkerStatus> {
    return this.requireWorkerBridge().getWorkerStatus(profileId);
  }

  async listWorkerStatuses(): Promise<ProfileWorkerStatus[]> {
    return this.requireWorkerBridge().listWorkerStatuses();
  }

  async getWorkerSummary(): Promise<WorkerSummary> {
    return this.requireWorkerBridge().getWorkerSummary();
  }

  private requireMiniBrowserBridge() {
    if (!this.bridge) {
      throw new Error(
        'Electron Mini Browser IPC is unavailable.'
      );
    }

    return this.bridge;
  }

  async openMiniBrowser(profileId: string): Promise<MiniBrowserStatus> {
    return await this.requireMiniBrowserBridge().openMiniBrowser(profileId);
  }

  async closeMiniBrowser(profileId: string): Promise<MiniBrowserStatus> {
    return await this.requireMiniBrowserBridge().closeMiniBrowser(profileId);
  }

  async focusMiniBrowser(profileId: string): Promise<boolean> {
    return await this.requireMiniBrowserBridge().focusMiniBrowser(profileId);
  }

  async reloadMiniBrowser(profileId: string): Promise<boolean> {
    return await this.requireMiniBrowserBridge().reloadMiniBrowser(profileId);
  }

  async getMiniBrowserStatus(profileId: string): Promise<MiniBrowserStatus> {
    return await this.requireMiniBrowserBridge().getMiniBrowserStatus(profileId);
  }

  async listMiniBrowserStatuses(): Promise<MiniBrowserStatus[]> {
    return await this.requireMiniBrowserBridge().listMiniBrowserStatuses();
  }

  async clearMiniBrowserSession(profileId: string): Promise<ClearSessionResult> {
    return await this.requireMiniBrowserBridge().clearMiniBrowserSession(profileId);
  }

  async assignGroupForProfiles(ids: string[], groupName: string): Promise<boolean> {
    if (this.bridge?.updateProfile && this.bridge?.listGroups) {
      const groups = await this.bridge.listGroups();
      const targetGroup = groups.find(g => g.name === groupName);
      for (const id of ids) {
        await this.bridge.updateProfile(id, {
          group: targetGroup ? targetGroup.name : 'Chưa Phân Nhóm',
          groupId: targetGroup ? targetGroup.id : null as any
        });
      }
      return true;
    }
    throw new Error('API desktopBridge không khả dụng trong môi trường Electron.');
  }

  async toggleModulesForProfiles(ids: string[], enabledModules: string[]): Promise<boolean> {
    if (this.bridge?.updateProfile) {
      for (const id of ids) {
        await this.bridge.updateProfile(id, { enabledModules });
      }
      return true;
    }
    throw new Error('API desktopBridge.updateProfile() không khả dụng trong môi trường Electron.');
  }

  async importProfiles(importedProfiles: Partial<Profile>[]): Promise<boolean> {
    if (this.bridge?.createProfile) {
      for (const item of importedProfiles) {
        await this.bridge.createProfile(item);
      }
      return true;
    }
    throw new Error('API desktopBridge.createProfile() không khả dụng trong môi trường Electron.');
  }

  // Groups (Native Electron JSON Storage only)
  async listGroups(): Promise<GroupItem[]> {
    if (this.bridge?.listGroups) {
      return await this.bridge.listGroups();
    }
    throw new Error('API desktopBridge.listGroups() không khả dụng trong môi trường Electron.');
  }

  async createGroup(group: { name: string; description: string; color: string }): Promise<GroupItem> {
    if (this.bridge?.createGroup) {
      return await this.bridge.createGroup(group);
    }
    throw new Error('API desktopBridge.createGroup() không khả dụng trong môi trường Electron.');
  }

  async updateGroup(groupId: string, changes: Partial<GroupItem>): Promise<GroupItem> {
    if (this.bridge?.updateGroup) {
      const res = await this.bridge.updateGroup(groupId, changes);
      if (res) return res;
      throw new Error(`Cập nhật nhóm ${groupId} thất bại.`);
    }
    throw new Error('API desktopBridge.updateGroup() không khả dụng trong môi trường Electron.');
  }

  async deleteGroup(groupId: string): Promise<boolean> {
    if (this.bridge?.deleteGroup) {
      return await this.bridge.deleteGroup(groupId);
    }
    throw new Error('API desktopBridge.deleteGroup() không khả dụng trong môi trường Electron.');
  }

  async runGroup(groupName: string): Promise<boolean> {
    await this.requireWorkerBridge().runWorkerGroup(groupName);
    return true;
  }

  async stopGroup(groupName: string): Promise<boolean> {
    await this.requireWorkerBridge().stopWorkerGroup(groupName);
    return true;
  }

  // Storage & System Info
  async getStorageInfo(): Promise<DesktopStorageInfo | null> {
    if (this.bridge?.getStorageInfo) {
      return await this.bridge.getStorageInfo();
    }
    return null;
  }

  async getVersions(): Promise<DesktopVersions | null> {
    if (this.bridge?.getVersions) {
      return await this.bridge.getVersions();
    }
    return null;
  }

  // Real Proxy Manager - native Electron bridge only
  private requireProxyBridge() {
    const bridge = this.bridge;
    if (!bridge?.listProxies) {
      throw new Error('Electron Proxy Manager IPC không khả dụng.');
    }
    return bridge;
  }

  async listProxies(): Promise<ProxyItem[]> {
    return this.requireProxyBridge().listProxies();
  }
  async getProxy(proxyId: string): Promise<ProxyItem | null> {
    return this.requireProxyBridge().getProxy(proxyId);
  }
  async createProxy(input: ProxyCreateInput): Promise<ProxyItem> {
    return this.requireProxyBridge().createProxy(input);
  }
  async updateProxy(proxyId: string, changes: ProxyUpdateInput): Promise<ProxyItem> {
    return this.requireProxyBridge().updateProxy(proxyId, changes);
  }
  async deleteProxy(proxyId: string): Promise<{ deleted: boolean; affectedProfileIds: string[] }> {
    return this.requireProxyBridge().deleteProxy(proxyId);
  }
  async importProxies(items: ProxyImportItem[]): Promise<ProxyItem[]> {
    return this.requireProxyBridge().importProxies(items);
  }
  async testProxy(proxyId: string): Promise<ProxyTestResult> {
    return this.requireProxyBridge().testProxy(proxyId);
  }
  async testManyProxies(proxyIds: string[]): Promise<ProxyTestResult[]> {
    return this.requireProxyBridge().testManyProxies(proxyIds);
  }
  private ensureProxyAssignmentApplied(result: { states?: ProfileProxyState[] }) {
    const failures = (result.states || []).filter(state => state.state === 'error');
    if (failures.length > 0) {
      const firstMessage = failures[0].error || 'Không thể áp dụng cấu hình proxy vào session profile.';
      throw new Error(
        `Đã lưu gán proxy nhưng ${failures.length} profile chưa áp dụng được cấu hình mạng: ${firstMessage}`
      );
    }
  }

  async assignProxy(profileIds: string[], proxyId: string): Promise<boolean> {
    const result = await this.requireProxyBridge().assignProxyToProfiles(profileIds, proxyId);
    this.ensureProxyAssignmentApplied(result);
    return true;
  }
  async assignProxyToProfiles(profileIds: string[], proxyId: string): Promise<boolean> {
    const result = await this.requireProxyBridge().assignProxyToProfiles(profileIds, proxyId);
    this.ensureProxyAssignmentApplied(result);
    return true;
  }

  async assignProxiesOneToOne(
    profileIds: string[],
    proxyIds: string[]
  ): Promise<ProxyOneToOneAssignmentResult> {
    return this.requireProxyBridge().assignProxiesOneToOne(profileIds, proxyIds);
  }
  async assignProfilesToProxy(proxyId: string, profileIds: string[]): Promise<boolean> {
    const result = await this.requireProxyBridge().replaceProfilesForProxy(proxyId, profileIds);
    this.ensureProxyAssignmentApplied(result);
    return true;
  }
  async unassignProxyFromProfiles(profileIds: string[]): Promise<boolean> {
    const result = await this.requireProxyBridge().unassignProxyFromProfiles(profileIds);
    this.ensureProxyAssignmentApplied(result);
    return true;
  }
  async getProfileProxyState(profileId: string): Promise<ProfileProxyState> {
    return this.requireProxyBridge().getProfileProxyState(profileId);
  }
  async refreshProfileProxy(profileId: string): Promise<ProfileProxyState> {
    return this.requireProxyBridge().refreshProfileProxy(profileId);
  }
  async getProxyStorageInfo(): Promise<ProxyStorageInfo> {
    return this.requireProxyBridge().getProxyStorageInfo();
  }
  async addSingleProxy(input: ProxyCreateInput): Promise<ProxyItem> {
    return this.createProxy(input);
  }
  async addProxiesBatch(items: ProxyImportItem[]): Promise<ProxyItem[]> {
    return this.importProxies(items);
  }
  async deleteProxies(ids: string[]): Promise<boolean> {
    for (const id of ids) await this.deleteProxy(id);
    return true;
  }

  async getBatches(): Promise<BatchTask[]> {
    return this.requireWorkerBridge().listBatches();
  }
  async createBatch(data: any): Promise<BatchTask> {
    return this.requireWorkerBridge().createBatch(data);
  }
  async updateBatch(batchId: string, data: Partial<BatchTask>): Promise<BatchTask | null> {
    return this.requireWorkerBridge().updateBatch(batchId, data);
  }
  async deleteBatch(batchId: string): Promise<boolean> {
    return this.requireWorkerBridge().deleteBatch(batchId);
  }
  async startBatch(batchId: string): Promise<boolean> {
    return this.requireWorkerBridge().startBatch(batchId);
  }
  async stopBatch(batchId: string): Promise<boolean> {
    return this.requireWorkerBridge().stopBatch(batchId);
  }
  async resetBatch(batchId: string): Promise<boolean> {
    return this.requireWorkerBridge().resetBatch(batchId);
  }

  async getLogs(): Promise<LogEntry[]> {
    return this.requireWorkerBridge().listLogs(1000);
  }
  async clearLogs(): Promise<boolean> {
    return this.requireWorkerBridge().clearWorkerLogs();
  }
  async getActivityConfig(): Promise<ActivityConfig> {
    return this.requireWorkerBridge().getActivityConfig();
  }
  async saveActivityConfig(config: ActivityConfig): Promise<boolean> {
    await this.requireWorkerBridge().saveActivityConfig(config);
    return true;
  }
  async getGeneralSettings(): Promise<GeneralAppSettings> {
    return this.requireWorkerBridge().getGeneralSettings();
  }
  async saveGeneralSettings(settings: GeneralAppSettings): Promise<boolean> {
    await this.requireWorkerBridge().saveGeneralSettings(settings);
    return true;
  }
  async getSystemStats(): Promise<SystemStats> {
    return this.requireWorkerBridge().getSystemStats();
  }

  onProfilesUpdated(callback: (profiles: Profile[]) => void): () => void {
    return this.requireWorkerBridge().onProfilesChanged(callback);
  }
  onBatchesUpdated(callback: (batches: BatchTask[]) => void): () => void {
    return this.requireWorkerBridge().onBatchesChanged(callback);
  }
  onLogsUpdated(callback: (logs: LogEntry[]) => void): () => void {
    return this.requireWorkerBridge().onLogsChanged(callback);
  }
  onStatsUpdated(callback: (stats: SystemStats) => void): () => void {
    return this.requireWorkerBridge().onStatsChanged(callback);
  }
  onMiniBrowserStatusChanged(callback: (status: MiniBrowserStatus) => void): () => void {
    return this.requireMiniBrowserBridge().onMiniBrowserStatusChanged(callback);
  }
  onProxiesChanged(callback: (proxies: ProxyItem[]) => void): () => void {
    return this.requireProxyBridge().onProxiesChanged(callback);
  }
  onProxyTestStatusChanged(callback: (result: ProxyTestResult) => void): () => void {
    return this.requireProxyBridge().onProxyTestStatusChanged(callback);
  }
  onProfileProxyStateChanged(callback: (state: ProfileProxyState) => void): () => void {
    return this.requireProxyBridge().onProfileProxyStateChanged(callback);
  }
  onWorkerStatusChanged(callback: (status: ProfileWorkerStatus) => void): () => void {
    return this.requireWorkerBridge().onWorkerStatusChanged(callback);
  }
  onWorkerSummaryChanged(callback: (summary: WorkerSummary) => void): () => void {
    return this.requireWorkerBridge().onWorkerSummaryChanged(callback);
  }
}

