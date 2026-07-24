/**
 * Custom React Hook: useAppBridge
 * Encapsulates app state synchronization with AppBridge instance
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Profile,
  GroupItem,
  ProxyItem,
  BatchTask,
  LogEntry,
  ActivityConfig,
  GeneralAppSettings,
  SystemStats,
  ProxyCreateInput,
  ProxyUpdateInput,
  ProxyImportItem,
  ProxyTestResult,
  ProfileProxyState,
  ProxyOneToOneAssignmentResult,
  ProfileWorkerStatus,
  WorkerSummary
} from '../types';
import { MiniBrowserStatus } from '../types/electron';
import { appBridge } from '../services/appBridgeService';

export function useAppBridge() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [proxies, setProxies] = useState<ProxyItem[]>([]);
  const [batches, setBatches] = useState<BatchTask[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activityConfig, setActivityConfig] = useState<ActivityConfig | null>(null);
  const [generalSettings, setGeneralSettings] = useState<GeneralAppSettings | null>(null);
  const [miniBrowserStatuses, setMiniBrowserStatuses] = useState<Record<string, MiniBrowserStatus>>({});
  const [profileProxyStates, setProfileProxyStates] = useState<Record<string, ProfileProxyState>>({});
  const [workerStatuses, setWorkerStatuses] = useState<Record<string, ProfileWorkerStatus>>({});
  const [workerSummary, setWorkerSummary] = useState<WorkerSummary | null>(null);
  const [systemStats, setSystemStats] = useState<SystemStats>({
    cpuUsage: 20,
    ramUsageGb: 4.2,
    ramTotalGb: 16.0,
    activeConnections: 52,
    networkSpeedMbps: 18.5
  });

  const refreshData = useCallback(async () => {
    try {
      const [pList, pxList, gList, bList, lList, acConfig, genSettings, stats, mbStatuses, wkStatuses, wkSummary] = await Promise.all([
        appBridge.listProfiles(),
        appBridge.listProxies(),
        appBridge.listGroups ? appBridge.listGroups() : Promise.resolve([]),
        appBridge.getBatches ? appBridge.getBatches() : Promise.resolve([]),
        appBridge.getLogs(),
        appBridge.getActivityConfig ? appBridge.getActivityConfig() : Promise.resolve(null),
        appBridge.getGeneralSettings ? appBridge.getGeneralSettings() : Promise.resolve(null),
        appBridge.getSystemStats ? appBridge.getSystemStats() : Promise.resolve({ cpuUsage: 0, ramUsageGb: 0, ramTotalGb: 16, activeConnections: 0, networkSpeedMbps: 0 }),
        appBridge.listMiniBrowserStatuses ? appBridge.listMiniBrowserStatuses() : Promise.resolve([]),
        appBridge.listWorkerStatuses ? appBridge.listWorkerStatuses() : Promise.resolve([]),
        appBridge.getWorkerSummary ? appBridge.getWorkerSummary() : Promise.resolve(null)
      ]);

      setProfiles(pList);
      setProxies(pxList);
      setGroups(gList);
      setBatches(bList);
      setLogs(lList);
      setActivityConfig(acConfig);
      setGeneralSettings(genSettings);
      setSystemStats(stats);

      if (mbStatuses) {
        const mbMap: Record<string, MiniBrowserStatus> = {};
        for (const statusObj of mbStatuses) {
          mbMap[statusObj.profileId] = statusObj;
        }
        setMiniBrowserStatuses(mbMap);
      }

      if (wkStatuses) {
        const workerMap: Record<string, ProfileWorkerStatus> = {};
        for (const statusObj of wkStatuses) {
          workerMap[statusObj.profileId] = statusObj;
        }
        setWorkerStatuses(workerMap);
      }
      setWorkerSummary(wkSummary);
    } catch (err) {
      console.error('Error fetching bridge data:', err);
    }
  }, []);

  useEffect(() => {
    refreshData();

    const unsubProfiles = appBridge.onProfilesUpdated ? appBridge.onProfilesUpdated(updatedProfiles => {
      setProfiles(updatedProfiles);
      if (appBridge.listGroups) {
        appBridge.listGroups().then(setGroups);
      }
    }) : undefined;

    const unsubBatches = appBridge.onBatchesUpdated ? appBridge.onBatchesUpdated(updatedBatches => {
      setBatches(updatedBatches);
    }) : undefined;

    const unsubLogs = appBridge.onLogsUpdated ? appBridge.onLogsUpdated(updatedLogs => {
      setLogs(updatedLogs);
    }) : undefined;

    const unsubStats = appBridge.onStatsUpdated ? appBridge.onStatsUpdated(updatedStats => {
      setSystemStats(updatedStats);
    }) : undefined;

    const unsubMiniBrowser = appBridge.onMiniBrowserStatusChanged ? appBridge.onMiniBrowserStatusChanged(statusObj => {
      setMiniBrowserStatuses(prev => ({
        ...prev,
        [statusObj.profileId]: statusObj
      }));
    }) : undefined;

    const unsubProxies = appBridge.onProxiesChanged ? appBridge.onProxiesChanged(updatedProxies => {
      setProxies(updatedProxies);
    }) : undefined;

    const unsubProxyTest = appBridge.onProxyTestStatusChanged ? appBridge.onProxyTestStatusChanged(result => {
      setProxies(prev => prev.map(proxy => proxy.id === result.proxyId ? {
        ...proxy,
        testState: result.testState,
        publicIp: result.publicIp,
        latencyMs: result.latencyMs,
        resolvedRule: result.resolvedRule,
        lastCheckedAt: result.checkedAt,
        testError: result.testError
      } : proxy));
    }) : undefined;

    const unsubProfileProxy = appBridge.onProfileProxyStateChanged ? appBridge.onProfileProxyStateChanged(state => {
      setProfileProxyStates(prev => ({ ...prev, [state.profileId]: state }));
    }) : undefined;

    const unsubWorkerStatus = appBridge.onWorkerStatusChanged ? appBridge.onWorkerStatusChanged(status => {
      setWorkerStatuses(prev => ({ ...prev, [status.profileId]: status }));
    }) : undefined;

    const unsubWorkerSummary = appBridge.onWorkerSummaryChanged ? appBridge.onWorkerSummaryChanged(summary => {
      setWorkerSummary(summary);
    }) : undefined;

    return () => {
      if (unsubProfiles) unsubProfiles();
      if (unsubBatches) unsubBatches();
      if (unsubLogs) unsubLogs();
      if (unsubStats) unsubStats();
      if (unsubMiniBrowser) unsubMiniBrowser();
      if (unsubProxies) unsubProxies();
      if (unsubProxyTest) unsubProxyTest();
      if (unsubProfileProxy) unsubProfileProxy();
      if (unsubWorkerStatus) unsubWorkerStatus();
      if (unsubWorkerSummary) unsubWorkerSummary();
    };
  }, [refreshData]);

  // Action helper methods
  const createProfile = async (data: Partial<Profile>) => {
    const p = await appBridge.createProfile(data);
    await refreshData();
    return p;
  };

  const updateProfile = async (id: string, data: Partial<Profile>) => {
    const p = await appBridge.updateProfile(id, data);
    await refreshData();
    return p;
  };

  const deleteProfiles = async (ids: string[]) => {
    const res = await appBridge.deleteProfile(ids);
    await refreshData();
    return res;
  };

  const assignGroupForProfiles = async (ids: string[], groupName: string) => {
    if (appBridge.assignGroupForProfiles) {
      await appBridge.assignGroupForProfiles(ids, groupName);
      await refreshData();
    }
  };

  const toggleModulesForProfiles = async (ids: string[], enabledModules: string[]) => {
    if (appBridge.toggleModulesForProfiles) {
      await appBridge.toggleModulesForProfiles(ids, enabledModules);
      await refreshData();
    }
  };

  const importProfiles = async (importedProfiles: Partial<Profile>[]) => {
    if (appBridge.importProfiles) {
      await appBridge.importProfiles(importedProfiles);
      await refreshData();
    }
  };

  const startProfiles = async (ids: string[]) => {
    const res = await appBridge.startProfile(ids);
    await refreshData();
    return res;
  };

  const stopProfiles = async (ids: string[]) => {
    const res = await appBridge.stopProfile(ids);
    await refreshData();
    return res;
  };

  const testProxy = async (proxyId: string): Promise<ProxyTestResult> => {
    const result = await appBridge.testProxy(proxyId);
    setProxies(prev => prev.map(proxy => proxy.id === proxyId ? {
      ...proxy,
      testState: result.testState,
      publicIp: result.publicIp,
      latencyMs: result.latencyMs,
      resolvedRule: result.resolvedRule,
      lastCheckedAt: result.checkedAt,
      testError: result.testError
    } : proxy));
    return result;
  };

  const testAllProxies = async () => {
    if (!appBridge.testManyProxies) return [];
    const results = await appBridge.testManyProxies(proxies.map(proxy => proxy.id));
    const updated = await appBridge.listProxies();
    setProxies(updated);
    return results;
  };

  const createProxy = async (input: ProxyCreateInput) => {
    if (!appBridge.createProxy) throw new Error('API tạo proxy không khả dụng.');
    const created = await appBridge.createProxy(input);
    setProxies(await appBridge.listProxies());
    return created;
  };

  const updateProxy = async (proxyId: string, changes: ProxyUpdateInput) => {
    if (!appBridge.updateProxy) throw new Error('API cập nhật proxy không khả dụng.');
    const updated = await appBridge.updateProxy(proxyId, changes);
    await refreshData();
    return updated;
  };

  const importProxyItems = async (items: ProxyImportItem[]) => {
    if (!appBridge.importProxies) throw new Error('API import proxy không khả dụng.');
    const created = await appBridge.importProxies(items);
    setProxies(await appBridge.listProxies());
    return created;
  };

  const addSingleProxy = async (input: ProxyCreateInput) => createProxy(input);
  const addProxiesBatch = async (items: ProxyImportItem[]) => importProxyItems(items);

  const assignProxiesOneToOne = async (
    profileIds: string[],
    proxyIds: string[]
  ): Promise<ProxyOneToOneAssignmentResult | boolean> => {
    if (!appBridge.assignProxiesOneToOne) {
      throw new Error('API gán proxy 1-1 không khả dụng.');
    }
    try {
      return await appBridge.assignProxiesOneToOne(profileIds, proxyIds);
    } finally {
      await refreshData();
    }
  };

  const assignProfilesToProxy = async (proxyId: string, profileIds: string[]) => {
    if (!appBridge.assignProfilesToProxy) throw new Error('API gán profile cho proxy không khả dụng.');
    try {
      await appBridge.assignProfilesToProxy(proxyId, profileIds);
    } finally {
      await refreshData();
    }
  };

  const assignProxyForProfiles = async (profileIds: string[], proxyId: string) => {
    try {
      if (!proxyId) {
        if (!appBridge.unassignProxyFromProfiles) throw new Error('API bỏ gán proxy không khả dụng.');
        await appBridge.unassignProxyFromProfiles(profileIds);
      } else if (appBridge.assignProxyToProfiles) {
        await appBridge.assignProxyToProfiles(profileIds, proxyId);
      } else {
        await appBridge.assignProxy(profileIds, proxyId);
      }
    } finally {
      await refreshData();
    }
  };

  const unassignProxyFromProfiles = async (profileIds: string[]) => {
    if (!appBridge.unassignProxyFromProfiles) throw new Error('API bỏ gán proxy không khả dụng.');
    try {
      await appBridge.unassignProxyFromProfiles(profileIds);
    } finally {
      await refreshData();
    }
  };

  const deleteProxies = async (ids: string[]) => {
    if (!appBridge.deleteProxy) throw new Error('API xóa proxy không khả dụng.');
    for (const id of ids) await appBridge.deleteProxy(id);
    await refreshData();
  };

  const refreshProfileProxy = async (profileId: string) => {
    if (!appBridge.refreshProfileProxy) throw new Error('API refresh proxy profile không khả dụng.');
    const state = await appBridge.refreshProfileProxy(profileId);
    setProfileProxyStates(prev => ({ ...prev, [profileId]: state }));
    return state;
  };

  const runGroup = async (groupName: string) => {
    if (appBridge.runGroup) {
      await appBridge.runGroup(groupName);
      await refreshData();
    }
  };

  const stopGroup = async (groupName: string) => {
    if (appBridge.stopGroup) {
      await appBridge.stopGroup(groupName);
      await refreshData();
    }
  };

  const createGroup = async (data: { name: string; description: string; color: string }) => {
    if (appBridge.createGroup) {
      await appBridge.createGroup(data);
      await refreshData();
    }
  };

  const updateGroup = async (groupId: string, changes: Partial<GroupItem>) => {
    if (appBridge.updateGroup) {
      await appBridge.updateGroup(groupId, changes);
      await refreshData();
    }
  };

  const deleteGroup = async (groupId: string) => {
    if (appBridge.deleteGroup) {
      await appBridge.deleteGroup(groupId);
      await refreshData();
    }
  };

  const createBatch = async (data: {
    name: string;
    profileIds: string[];
    concurrency?: number;
    activityType?: string;
    groupTarget?: string;
    status?: import('../shared').BatchStatus;
  }) => {
    if (appBridge.createBatch) {
      const b = await appBridge.createBatch(data);
      if (appBridge.getBatches) {
        setBatches(await appBridge.getBatches());
      }
      return b;
    }
    return null;
  };

  const updateBatch = async (batchId: string, data: Partial<BatchTask>) => {
    if (appBridge.updateBatch) {
      const b = await appBridge.updateBatch(batchId, data);
      if (appBridge.getBatches) {
        setBatches(await appBridge.getBatches());
      }
      return b;
    }
    return null;
  };

  const deleteBatch = async (batchId: string) => {
    if (appBridge.deleteBatch) {
      await appBridge.deleteBatch(batchId);
      if (appBridge.getBatches) {
        setBatches(await appBridge.getBatches());
      }
    }
  };

  const startBatch = async (batchId: string) => {
    await appBridge.startBatch(batchId);
    if (appBridge.getBatches) {
      const bList = await appBridge.getBatches();
      setBatches(bList);
    }
  };

  const stopBatch = async (batchId: string) => {
    await appBridge.stopBatch(batchId);
    if (appBridge.getBatches) {
      const bList = await appBridge.getBatches();
      setBatches(bList);
    }
  };

  const resetBatch = async (batchId: string) => {
    if (appBridge.resetBatch) {
      await appBridge.resetBatch(batchId);
      if (appBridge.getBatches) {
        const bList = await appBridge.getBatches();
        setBatches(bList);
      }
    }
  };

  const toggleBatch = async (batchId: string) => {
    const target = batches.find(b => b.id === batchId);
    if (target?.status === 'Running') {
      await stopBatch(batchId);
    } else {
      await startBatch(batchId);
    }
  };

  const saveActivityConfig = async (config: ActivityConfig) => {
    if (appBridge.saveActivityConfig) {
      await appBridge.saveActivityConfig(config);
      setActivityConfig(config);
    }
  };

  const saveGeneralSettings = async (settings: GeneralAppSettings) => {
    if (appBridge.saveGeneralSettings) {
      const normalized = await appBridge.saveGeneralSettings(settings);
      setGeneralSettings(normalized);
      return normalized;
    }
    return settings;
  };

  const clearLogs = async () => {
    if (appBridge.clearLogs) {
      await appBridge.clearLogs();
      setLogs([]);
    }
  };

  const openMiniBrowser = async (profileId: string) => {
    return await appBridge.openMiniBrowser(profileId);
  };

  const closeMiniBrowser = async (profileId: string): Promise<MiniBrowserStatus> => {
    if (appBridge.closeMiniBrowser) {
      return await appBridge.closeMiniBrowser(profileId);
    }
    return {
      profileId,
      isOpen: false,
      state: 'closed'
    };
  };

  const focusMiniBrowser = async (profileId: string) => {
    if (appBridge.focusMiniBrowser) {
      return await appBridge.focusMiniBrowser(profileId);
    }
    return false;
  };

  const reloadMiniBrowser = async (profileId: string) => {
    if (appBridge.reloadMiniBrowser) {
      return await appBridge.reloadMiniBrowser(profileId);
    }
    return false;
  };

  const clearMiniBrowserSession = async (profileId: string) => {
    if (appBridge.clearMiniBrowserSession) {
      return await appBridge.clearMiniBrowserSession(profileId);
    }
    return { success: false, profileId, message: 'API clearMiniBrowserSession không khả dụng.' };
  };

  return {
    profiles,
    groups,
    proxies,
    batches,
    logs,
    activityConfig,
    generalSettings,
    miniBrowserStatuses,
    profileProxyStates,
    workerStatuses,
    workerSummary,
    systemStats,
    refreshData,
    createProfile,
    updateProfile,
    deleteProfiles,
    assignGroupForProfiles,
    assignProxyForProfiles,
    toggleModulesForProfiles,
    importProfiles,
    startProfiles,
    stopProfiles,
    openMiniBrowser,
    closeMiniBrowser,
    focusMiniBrowser,
    reloadMiniBrowser,
    clearMiniBrowserSession,
    testProxy,
    testAllProxies,
    createProxy,
    updateProxy,
    importProxyItems,
    addSingleProxy,
    addProxiesBatch,
    assignProfilesToProxy,
    assignProxiesOneToOne,
    unassignProxyFromProfiles,
    refreshProfileProxy,
    deleteProxies,
    runGroup,
    stopGroup,
    createGroup,
    updateGroup,
    deleteGroup,
    createBatch,
    updateBatch,
    deleteBatch,
    startBatch,
    stopBatch,
    resetBatch,
    toggleBatch,
    saveActivityConfig,
    saveGeneralSettings,
    clearLogs
  };
}
