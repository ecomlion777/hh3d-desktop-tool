/**
 * HH3D Desktop Tool - Main Desktop Application Root Shell
 */

import React, { useState } from 'react';
import { ViewTab, Profile, GroupItem } from './types';
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

  // Filters & Search
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [isAddProfileOpen, setIsAddProfileOpen] = useState(false);
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupItem | null>(null);
  const [isAddProxyOpen, setIsAddProxyOpen] = useState(false);
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

  // Group Handlers
  const handleRunSelectedGroup = async () => {
    const targetGroup = selectedGroup || (groups[0]?.name || 'Nhóm Chính (Main)');
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
    const px = proxies.find(p => p.id === data.proxyId) || proxies[0];
    await createProfile({
      characterName: data.characterName,
      uid: data.uid,
      groupId: data.groupId,
      group: data.group,
      proxyId: px ? px.id : 'proxy_1',
      proxyAddress: px ? px.ipPort : '103.142.10.100:8080',
      currentIp: px ? px.ipPort.split(':')[0] : '103.142.10.100',
      status: 'stopped',
      currentActivity: 'Vừa khởi tạo',
      level: 70,
      stamina: 100
    });
  };

  const handleAddBulkProfiles = async (lines: string[], groupName: string, proxyId: string, groupId?: string) => {
    const px = proxies.find(p => p.id === proxyId) || proxies[0];
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
        proxyId: px ? px.id : 'proxy_1',
        proxyAddress: px ? px.ipPort : '103.142.10.100:8080',
        currentIp: px ? px.ipPort.split(':')[0] : '103.142.10.100',
        status: 'stopped',
        currentActivity: 'Chờ thiết lập',
        level: 75,
        stamina: 100
      });
    }
  };

  const runningCount = profiles.filter(p => p.status === 'running').length;
  const waitingCount = profiles.filter(p => p.status === 'waiting').length;
  const stoppedCount = profiles.filter(p => p.status === 'stopped').length;
  const proxyErrorCount = profiles.filter(p => p.status === 'proxy_error').length;
  const loginRequiredCount = profiles.filter(p => p.status === 'login_required').length;

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
        onOpenMiniBrowser={() => {
          const firstRunning = profiles.find(p => p.status === 'running') || profiles[0];
          if (firstRunning) setMiniBrowserProfile(firstRunning);
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        runningProfilesCount={runningCount}
        totalProfilesCount={profiles.length}
      />

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
              onStartSelectedProfiles={startProfiles}
              onStopSelectedProfiles={stopProfiles}
              onDeleteSelectedProfiles={deleteProfiles}
              onOpenMiniBrowser={(p) => setMiniBrowserProfile(p)}
              onOpenProfileSettings={(p) => setMiniBrowserProfile(p)}
              onOpenAddProfile={() => setIsAddProfileOpen(true)}
              onUpdateProfile={updateProfile}
              onAssignGroupForSelected={assignGroupForProfiles}
              onAssignProxyForSelected={assignProxyForProfiles}
              onToggleModulesForSelected={toggleModulesForProfiles}
              onImportProfilesFromJSON={importProfiles}
            />
          )}

          {currentTab === 'proxies' && (
            <ProxyManagerPage
              proxies={proxies}
              profiles={profiles}
              onTestProxy={testProxy}
              onTestAllProxies={testAllProxies}
              onOpenAddProxyModal={() => setIsAddProxyOpen(true)}
              onDeleteProxies={deleteProxies}
              onAssignProfilesToProxy={assignProfilesToProxy}
            />
          )}

          {currentTab === 'batches' && (
            <BatchManagerPage
              batches={batches}
              profiles={profiles}
              groups={groups}
              onStartBatch={startBatch}
              onStopBatch={stopBatch}
              onResetBatch={resetBatch}
              onCreateBatch={createBatch}
              onUpdateBatch={updateBatch}
              onDeleteBatch={deleteBatch}
              onToggleBatch={toggleBatch}
            />
          )}

          {currentTab === 'activity_settings' && activityConfig && (
            <ActivitySettingsPage
              config={activityConfig}
              onSaveConfig={saveActivityConfig}
            />
          )}

          {currentTab === 'logs' && (
            <LogsPage
              logs={logs}
              onClearLogs={clearLogs}
            />
          )}

          {currentTab === 'general_settings' && generalSettings && (
            <GeneralSettingsPage
              settings={generalSettings}
              onSaveSettings={saveGeneralSettings}
            />
          )}
        </main>
      </div>

      {/* Summary Status Bar */}
      <AppStatusBar
        totalProfiles={profiles.length}
        runningCount={runningCount}
        waitingCount={waitingCount}
        stoppedCount={stoppedCount}
        proxyErrorCount={proxyErrorCount}
        loginRequiredCount={loginRequiredCount}
        systemStats={systemStats}
        activeFilterStatus={statusFilter}
        onFilterStatusChange={(s) => {
          setStatusFilter(s);
          if (currentTab !== 'profiles') setCurrentTab('profiles');
        }}
      />

      {/* Modals */}
      <MiniBrowserModal
        profile={miniBrowserProfile}
        onClose={() => setMiniBrowserProfile(null)}
        onToggleRun={handleToggleProfileRun}
      />

      <AddProfileModal
        isOpen={isAddProfileOpen}
        onClose={() => setIsAddProfileOpen(false)}
        groups={groups}
        proxies={proxies}
        onSubmitSingle={handleAddSingleProfile}
        onSubmitBulk={handleAddBulkProfiles}
      />

      <AddGroupModal
        isOpen={isAddGroupOpen}
        onClose={() => {
          setIsAddGroupOpen(false);
          setEditingGroup(null);
        }}
        onSubmit={handleGroupSubmit}
        groupToEdit={editingGroup}
      />

      <ProxyEditModal
        isOpen={isAddProxyOpen}
        onClose={() => setIsAddProxyOpen(false)}
        onSubmitSingleProxy={addSingleProxy}
        onSubmitBulkProxies={addProxiesBatch}
      />

    </div>
  );
}
