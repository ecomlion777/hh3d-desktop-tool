/**
 * HH3D Desktop Tool - Main Desktop Application Root Shell
 */

import React, { useState } from 'react';
import { ViewTab, Profile, GroupItem, ProxyItem, ProxyCreateInput, ProxyUpdateInput, ProxyImportItem } from './types';
import { useAppBridge } from './hooks';

import { AppHeader } from './components/layout/AppHeader';
import { AppSidebar } from './components/layout/AppSidebar';
import { AppStatusBar } from './components/layout/AppStatusBar';

import {
  DashboardPage,
  ProfileManagerPage,
  ProxyManagerPage,
  BatchManagerPage,
  ActivitySettingsPage,
  LogsPage,
  GeneralSettingsPage
} from './pages';

import { MiniBrowserModal } from './components/modals/MiniBrowserModal';
import { AddProfileModal } from './components/modals/AddProfileModal';
import { AddGroupModal } from './components/modals/AddGroupModal';
import { ProxyEditModal } from './components/modals/ProxyEditModal';

export default function App() {
  const [currentTab, setCurrentTab] = useState<ViewTab>('profiles');

  // Custom AppBridge Hook
  const {
    profiles,
    groups,
    proxies,
    batches,
    logs,
    activityConfig,
    generalSettings,
    miniBrowserStatuses,
    profileProxyStates,
    moduleCatalog,
    moduleRuntimeStatuses,
    systemStats,
    refreshData,
    createProfile,
    updateProfile,
    deleteProfiles,
    assignGroupForProfiles,
    assignProxyForProfiles,
    toggleModulesForProfiles,
    runModuleOnce,
    importProfiles,
    startProfiles,
    stopProfiles,
    openMiniBrowser,
    focusMiniBrowser,
    testProxy,
    testAllProxies,
    createProxy,
    updateProxy,
    importProxyItems,
    assignProfilesToProxy,
    assignProxiesOneToOne,
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
  } = useAppBridge();

  // Selected Profile IDs state reported from ProfileManagerView
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);

  // Shared runtime error banner for Mini Browser and Proxy Manager
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  // Filters & Search
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [isAddProfileOpen, setIsAddProfileOpen] = useState(false);
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupItem | null>(null);
  const [isAddProxyOpen, setIsAddProxyOpen] = useState(false);
  const [editingProxy, setEditingProxy] = useState<ProxyItem | null>(null);
  const [miniBrowserProfile, setMiniBrowserProfile] = useState<Profile | null>(null);

  // Group Handlers
  const handleOpenAddGroup = () => {
    setEditingGroup(null);
    setIsAddGroupOpen(true);
  };

  const handleOpenEditGroup = (group: GroupItem) => {
    setEditingGroup(group);
    setIsAddGroupOpen(true);
  };

  const handleGroupSubmit = async (data: { name: string; description: string; color: string }) => {
    if (editingGroup) {
      await updateGroup(editingGroup.id, data);
    } else {
      await createGroup(data);
    }
    setEditingGroup(null);
  };

  const handleDeleteGroup = async (group: GroupItem) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa nhóm "${group.name}"? Các profile thuộc nhóm này sẽ được chuyển sang "Chưa Phân Nhóm".`)) {
      await deleteGroup(group.id);
    }
  };

  const handleStartSelectedProfiles = async (profileIds: string[]) => {
    // Running profiles is independent from proxy quantity. Profiles without an
    // assigned proxy continue in Direct mode; assigned proxies are enforced per
    // profile by ProxySessionManager when their network session is opened.
    setRuntimeError(null);
    await startProfiles(profileIds);
  };

  // Group Handlers
  const handleRunSelectedGroup = async () => {
    const targetGroup = selectedGroup || (groups[0]?.name || 'Nhóm Chính (Main)');
    setRuntimeError(null);
    await runGroup(targetGroup);
  };

  const handleStopSelectedGroup = async () => {
    const targetGroup = selectedGroup || (groups[0]?.name || 'Nhóm Chính (Main)');
    await stopGroup(targetGroup);
  };

  const handleToggleProfileRun = async (id: string) => {
    const target = profiles.find(p => p.id === id);
    if (!target) return;
    if (target.status === 'running') {
      await stopProfiles([id]);
    } else {
      await startProfiles([id]);
    }
  };

  const handleAddSingleProfile = async (data: { characterName: string; uid: string; group: string; groupId?: string; proxyId: string }) => {
    const px = data.proxyId ? proxies.find(p => p.id === data.proxyId) : undefined;
    await createProfile({
      characterName: data.characterName,
      uid: data.uid,
      groupId: data.groupId,
      group: data.group,
      proxyId: px?.id || null,
      proxyAddress: px ? `${px.host}:${px.port}` : 'Không dùng Proxy',
      currentIp: '',
      status: 'stopped',
      currentActivity: 'Vừa khởi tạo',
      level: 70,
      stamina: 100
    });
  };

  const handleAddBulkProfiles = async (lines: string[], groupName: string, proxyId: string, groupId?: string) => {
    const px = proxyId ? proxies.find(p => p.id === proxyId) : undefined;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split('|');
      const uidVal = parts[0] || `HH3D-${90000 + i}`;
      const nameVal = parts[1] || `Char_${uidVal}`;

      await createProfile({
        characterName: nameVal,
        uid: uidVal,
        groupId: groupId,
        group: groupName,
        proxyId: px?.id || null,
        proxyAddress: px ? `${px.host}:${px.port}` : 'Không dùng Proxy',
        currentIp: '',
        status: 'stopped',
        currentActivity: 'Chờ thiết lập',
        level: 75,
        stamina: 100
      });
    }
  };

  const handleOpenCreateProxy = () => {
    setEditingProxy(null);
    setIsAddProxyOpen(true);
  };

  const handleOpenEditProxy = (proxy: ProxyItem) => {
    setEditingProxy(proxy);
    setIsAddProxyOpen(true);
  };

  const handleProxySubmit = async (data: ProxyCreateInput | ProxyUpdateInput) => {
    if (editingProxy) {
      await updateProxy(editingProxy.id, data as ProxyUpdateInput);
    } else {
      await createProxy(data as ProxyCreateInput);
    }
  };

  const handleToggleProxyEnabled = async (proxy: ProxyItem) => {
    await updateProxy(proxy.id, { enabled: !proxy.enabled });
  };


  const handleQuickImportAndAssignProxies = async (
    profileIds: string[],
    proxyItems: ProxyImportItem[]
  ) => {
    if (profileIds.length === 0 || profileIds.length !== proxyItems.length) {
      throw new Error('Số profile và số proxy dùng để gán phải bằng nhau.');
    }

    const fullIdentitySet = new Set<string>();
    const existingUnauthByEndpoint = new Map<string, ProxyItem>(
      proxies
        .filter(proxy => !proxy.authRequired && proxy.enabled)
        .map(proxy => [
          `${proxy.protocol}|${proxy.host.trim().toLowerCase()}|${proxy.port}`,
          proxy
        ])
    );

    const targetProxyIds = new Array<string>(proxyItems.length);
    const newItems: ProxyImportItem[] = [];
    const newItemIndexes: number[] = [];

    for (let index = 0; index < proxyItems.length; index++) {
      const item = proxyItems[index];
      const fullIdentity = [
        item.protocol,
        item.host.trim().toLowerCase(),
        item.port,
        item.username || '',
        item.password || ''
      ].join('|');

      if (fullIdentitySet.has(fullIdentity)) {
        throw new Error(`Proxy ở vị trí ${index + 1} bị trùng hoàn toàn trong danh sách.`);
      }
      fullIdentitySet.add(fullIdentity);

      const hasCredentials = Boolean(item.username || item.password || item.authRequired);
      const endpointIdentity = `${item.protocol}|${item.host.trim().toLowerCase()}|${item.port}`;
      const reusable = hasCredentials ? undefined : existingUnauthByEndpoint.get(endpointIdentity);

      if (reusable) {
        targetProxyIds[index] = reusable.id;
      } else {
        newItemIndexes.push(index);
        newItems.push(item);
      }
    }

    if (newItems.length > 0) {
      const created = await importProxyItems(newItems);
      if (created.length !== newItems.length) {
        throw new Error('Số proxy import thành công không khớp với kế hoạch gán.');
      }
      newItemIndexes.forEach((targetIndex, createdIndex) => {
        targetProxyIds[targetIndex] = created[createdIndex].id;
      });
    }

    if (targetProxyIds.some(proxyId => !proxyId)) {
      throw new Error('Không thể xác định đầy đủ proxy để gán.');
    }

    try {
      const result = await assignProxiesOneToOne(profileIds, targetProxyIds);
      setRuntimeError(null);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRuntimeError(message);
      throw error;
    }
  };

  // Toolbar Mini Browser Handler - Strict Selection Rules
  const handleToolbarOpenMiniBrowser = async () => {
    if (selectedProfileIds.length === 0) {
      setRuntimeError('Hãy chọn một profile');
      return;
    }
    if (selectedProfileIds.length > 1) {
      setRuntimeError('Mini Browser chỉ mở cho một profile mỗi lần');
      return;
    }

    const singleId = selectedProfileIds[0];
    const mbStatus = miniBrowserStatuses[singleId];
    const mbState = mbStatus?.state || 'closed';

    try {
      if (mbState === 'opening' || mbState === 'loading' || mbState === 'open') {
        const focused = await focusMiniBrowser(singleId);
        if (!focused) {
          await openMiniBrowser(singleId);
        }
      } else {
        await openMiniBrowser(singleId);
      }
    } catch (err: any) {
      console.error(`Toolbar Mini Browser error for ${singleId}:`, err);
      setRuntimeError(`Không thể mở Mini Browser: ${err?.message || String(err)}`);
    }
  };

  const runningCount = profiles.filter(p => p.status === 'running').length;

  return (
    <div id="hh3d-app-root" className="h-screen w-screen flex flex-col bg-slate-950 font-sans text-slate-100 overflow-hidden antialiased select-none">
      
      {/* Top Application Header */}
      <AppHeader
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenAddProfile={() => setIsAddProfileOpen(true)}
        onOpenAddGroup={handleOpenAddGroup}
        onRunSelectedGroup={handleRunSelectedGroup}
        onStopSelectedGroup={handleStopSelectedGroup}
        onRefreshData={refreshData}
        onOpenMiniBrowser={handleToolbarOpenMiniBrowser}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        runningProfilesCount={runningCount}
        totalProfilesCount={profiles.length}
      />

      {/* Mini Browser Error Banner */}
      {runtimeError && (
        <div className="bg-rose-950/90 border-b border-rose-800 text-rose-200 px-4 py-2 flex items-center justify-between text-xs font-medium z-50">
          <div className="flex items-center gap-2">
            <span className="bg-rose-800 text-white font-bold px-1.5 py-0.5 rounded text-[10px] uppercase">Lỗi Ứng Dụng</span>
            <span>{runtimeError}</span>
          </div>
          <button
            onClick={() => setRuntimeError(null)}
            className="text-rose-400 hover:text-white px-2 py-0.5 rounded hover:bg-rose-900 transition-colors font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main App Body with Left Sidebar & Content Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Navigation Sidebar */}
        <AppSidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          groups={groups}
          selectedGroup={selectedGroup}
          onSelectGroup={setSelectedGroup}
          onOpenAddGroup={handleOpenAddGroup}
          systemStats={systemStats}
          totalProfilesCount={profiles.length}
        />

        {/* Central Workspace Content */}
        <main className="flex-1 bg-slate-900 overflow-hidden flex flex-col relative">
          {currentTab === 'dashboard' && (
            <DashboardPage
              profiles={profiles}
              groups={groups}
              logs={logs}
              systemStats={systemStats}
              onNavigate={setCurrentTab}
              onRunGroup={runGroup}
              onStopGroup={stopGroup}
              onOpenMiniBrowser={(p) => setMiniBrowserProfile(p)}
              onEditGroup={handleOpenEditGroup}
              onDeleteGroup={handleDeleteGroup}
            />
          )}

          {currentTab === 'profiles' && (
            <ProfileManagerPage
              profiles={profiles}
              groups={groups}
              proxies={proxies}
              selectedGroup={selectedGroup}
              onSelectGroup={setSelectedGroup}
              statusFilter={statusFilter}
              onSelectStatusFilter={setStatusFilter}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onToggleProfileRun={handleToggleProfileRun}
              onStartSelectedProfiles={handleStartSelectedProfiles}
              onStopSelectedProfiles={stopProfiles}
              onDeleteSelectedProfiles={deleteProfiles}
              onOpenMiniBrowser={(profileId) => openMiniBrowser(profileId)}
              onFocusMiniBrowser={(profileId) => focusMiniBrowser(profileId)}
              onMiniBrowserError={setRuntimeError}
              onOpenMiniBrowserDetails={(profile) => setMiniBrowserProfile(profile)}
              onOpenProfileSettings={(p) => setMiniBrowserProfile(p)}
              onOpenAddProfile={() => setIsAddProfileOpen(true)}
              onUpdateProfile={updateProfile}
              onAssignGroupForSelected={assignGroupForProfiles}
              onAssignProxyForSelected={assignProxyForProfiles}
              onQuickImportAndAssignProxies={handleQuickImportAndAssignProxies}
              onToggleModulesForSelected={toggleModulesForProfiles}
              moduleCatalog={moduleCatalog}
              onImportProfilesFromJSON={importProfiles}
              miniBrowserStatuses={miniBrowserStatuses}
              profileProxyStates={profileProxyStates}
              onSelectionChange={setSelectedProfileIds}
            />
          )}

          {currentTab === 'proxies' && (
            <ProxyManagerPage
              proxies={proxies}
              profiles={profiles}
              onTestProxy={testProxy}
              onTestAllProxies={testAllProxies}
              onOpenAddProxyModal={handleOpenCreateProxy}
              onEditProxy={handleOpenEditProxy}
              onDeleteProxies={deleteProxies}
              onToggleEnabled={handleToggleProxyEnabled}
              onAssignProfilesToProxy={assignProfilesToProxy}
              onError={setRuntimeError}
            />
          )}

          {currentTab === 'batches' && (
            <BatchManagerPage
              batches={batches}
              profiles={profiles}
              groups={groups}
              onCreateBatch={createBatch}
              onUpdateBatch={updateBatch}
              onDeleteBatch={deleteBatch}
              onStartBatch={startBatch}
              onStopBatch={stopBatch}
              onResetBatch={resetBatch}
              onToggleBatch={toggleBatch}
            />
          )}

          {currentTab === 'activity_settings' && (
            <ActivitySettingsPage
              config={activityConfig}
              profiles={profiles}
              moduleCatalog={moduleCatalog}
              moduleRuntimeStatuses={moduleRuntimeStatuses}
              onSaveConfig={saveActivityConfig}
              onRunModule={runModuleOnce}
            />
          )}

          {currentTab === 'logs' && (
            <LogsPage
              logs={logs}
              onClearLogs={clearLogs}
            />
          )}

          {currentTab === 'general_settings' && (
            <GeneralSettingsPage
              settings={generalSettings || {
                websiteBaseUrl: 'https://hoathinh3d.co/',
                websiteAllowedHosts: ['hoathinh3d.co', 'hoathinh3d.com', 'hoathinh3d.st'],
                theme: 'dark',
                maxThreads: 40,
                minimizeToTray: true,
                autoStartWithSystem: false,
                ipcMode: 'electron_bridge',
                proxyTimeout: 15,
                checkUpdateAuto: true,
                language: 'vi'
              }}
              onSaveSettings={saveGeneralSettings}
            />
          )}
        </main>
      </div>

      {/* Global Status Footer Bar */}
      <AppStatusBar
        totalProfiles={profiles.length}
        runningCount={runningCount}
        waitingCount={profiles.filter(p => p.status === 'waiting').length}
        stoppedCount={profiles.filter(p => p.status === 'stopped').length}
        proxyErrorCount={new Set([
          ...profiles.filter(p => p.status === 'proxy_error').map(p => p.id),
          ...(Object.values(profileProxyStates) as import('./types').ProfileProxyState[]).filter(state => state.state === 'error').map(state => state.profileId)
        ]).size}
        loginRequiredCount={profiles.filter(p => p.status === 'login_required').length}
        systemStats={systemStats}
        activeFilterStatus={statusFilter}
        onFilterStatusChange={setStatusFilter}
      />

      {/* Interactive Application Modals */}
      {miniBrowserProfile && (
        <MiniBrowserModal
          profile={miniBrowserProfile}
          onClose={() => setMiniBrowserProfile(null)}
        />
      )}

      <AddProfileModal
        isOpen={isAddProfileOpen}
        groups={groups}
        proxies={proxies}
        existingProfiles={profiles}
        onClose={() => setIsAddProfileOpen(false)}
        onSubmitSingle={handleAddSingleProfile}
        onSubmitBulk={handleAddBulkProfiles}
      />

      <AddGroupModal
        isOpen={isAddGroupOpen}
        groupToEdit={editingGroup}
        onClose={() => {
          setIsAddGroupOpen(false);
          setEditingGroup(null);
        }}
        onSubmit={handleGroupSubmit}
      />

      <ProxyEditModal
        isOpen={isAddProxyOpen}
        proxy={editingProxy}
        onClose={() => {
          setIsAddProxyOpen(false);
          setEditingProxy(null);
        }}
        onSubmit={handleProxySubmit}
        onImport={async items => { await importProxyItems(items); }}
      />

    </div>
  );
}
