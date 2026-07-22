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
  SystemStats
} from '../types';
import { appBridge } from '../services/appBridgeService';

export function useAppBridge() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [proxies, setProxies] = useState<ProxyItem[]>([]);
  const [batches, setBatches] = useState<BatchTask[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activityConfig, setActivityConfig] = useState<ActivityConfig | null>(null);
  const [generalSettings, setGeneralSettings] = useState<GeneralAppSettings | null>(null);
  const [systemStats, setSystemStats] = useState<SystemStats>({
    cpuUsage: 20,
    ramUsageGb: 4.2,
    ramTotalGb: 16.0,
    activeConnections: 52,
    networkSpeedMbps: 18.5
  });

  const refreshData = useCallback(async () => {
    try {
      const [pList, pxList, gList, bList, lList, acConfig, genSettings, stats] = await Promise.all([
        appBridge.listProfiles(),
        appBridge.listProxies(),
        appBridge.listGroups ? appBridge.listGroups() : Promise.resolve([]),
        appBridge.getBatches ? appBridge.getBatches() : Promise.resolve([]),
        appBridge.getLogs(),
        appBridge.getActivityConfig ? appBridge.getActivityConfig() : Promise.resolve(null),
        appBridge.getGeneralSettings ? appBridge.getGeneralSettings() : Promise.resolve(null),
        appBridge.getSystemStats ? appBridge.getSystemStats() : Promise.resolve({ cpuUsage: 0, ramUsageGb: 0, ramTotalGb: 16, activeConnections: 0, networkSpeedMbps: 0 })
      ]);

      setProfiles(pList);
      setProxies(pxList);
      setGroups(gList);
      setBatches(bList);
      setLogs(lList);
      setActivityConfig(acConfig);
      setGeneralSettings(genSettings);
      setSystemStats(stats);
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

    return () => {
      if (unsubProfiles) unsubProfiles();
      if (unsubBatches) unsubBatches();
      if (unsubLogs) unsubLogs();
      if (unsubStats) unsubStats();
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

  const assignProxyForProfiles = async (ids: string[], proxyId: string) => {
    await appBridge.assignProxy(ids, proxyId);
    await refreshData();
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

  const testProxy = async (proxyId: string) => {
    const px = await appBridge.testProxy(proxyId);
    setProxies(prev => prev.map(p => p.id === proxyId ? px : p));
    return px;
  };

  const testAllProxies = async () => {
    if ((appBridge as any).testAllProxies) {
      const updated = await (appBridge as any).testAllProxies();
      setProxies(updated);
    }
  };

  const addSingleProxy = async (proxyData: Partial<ProxyItem>) => {
    if (appBridge.addSingleProxy) {
      await appBridge.addSingleProxy(proxyData);
      const pxList = await appBridge.listProxies();
      setProxies(pxList);
    }
  };

  const addProxiesBatch = async (lines: string[]) => {
    if (appBridge.addProxiesBatch) {
      await appBridge.addProxiesBatch(lines);
      const pxList = await appBridge.listProxies();
      setProxies(pxList);
    }
  };

  const assignProfilesToProxy = async (proxyId: string, profileIds: string[]) => {
    if (appBridge.assignProfilesToProxy) {
      await appBridge.assignProfilesToProxy(proxyId, profileIds);
      await refreshData();
    }
  };

  const deleteProxies = async (ids: string[]) => {
    if (appBridge.deleteProxies) {
      await appBridge.deleteProxies(ids);
      const pxList = await appBridge.listProxies();
      setProxies(pxList);
    }
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
      if (appBridge.listGroups) {
        const gList = await appBridge.listGroups();
        setGroups(gList);
      }
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
      await appBridge.saveGeneralSettings(settings);
      setGeneralSettings(settings);
    }
  };

  const clearLogs = async () => {
    if (appBridge.clearLogs) {
      await appBridge.clearLogs();
      setLogs([]);
    }
  };

  return {
    profiles,
    groups,
    proxies,
    batches,
    logs,
    activityConfig,
    generalSettings,
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
    testProxy,
    testAllProxies,
    addSingleProxy,
    addProxiesBatch,
    assignProfilesToProxy,
    deleteProxies,
    runGroup,
    stopGroup,
    createGroup,
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
