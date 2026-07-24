/**
 * ProfileManagerPage - Profile Management Page
 */

import React from 'react';
import { ProfileManagerView } from '../components/views/ProfileManagerView';
import { Profile, GroupItem, ProxyItem, ProfileProxyState, ProxyImportItem, ModuleCatalogItem } from '../types';
import { MiniBrowserStatus } from '../types/electron';

interface ProfileManagerPageProps {
  profiles: Profile[];
  groups: GroupItem[];
  proxies: ProxyItem[];
  selectedGroup: string | null;
  onSelectGroup: (groupName: string | null) => void;
  statusFilter: string | null;
  onSelectStatusFilter: (status: string | null) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onToggleProfileRun: (id: string) => void;
  onStartSelectedProfiles: (ids: string[]) => void;
  onStopSelectedProfiles: (ids: string[]) => void;
  onDeleteSelectedProfiles: (ids: string[]) => void;
  onOpenMiniBrowser: (profileId: string) => Promise<MiniBrowserStatus>;
  onFocusMiniBrowser?: (profileId: string) => Promise<boolean>;
  onMiniBrowserError?: (message: string) => void;
  onOpenMiniBrowserDetails?: (profile: Profile) => void;
  onOpenProfileSettings: (profile: Profile) => void;
  onOpenAddProfile: () => void;
  onUpdateProfile: (id: string, updatedData: Partial<Profile>) => Promise<Profile>;
  onAssignGroupForSelected: (ids: string[], groupName: string) => Promise<void>;
  onAssignProxyForSelected: (ids: string[], proxyId: string) => Promise<void>;
  onQuickImportAndAssignProxies: (profileIds: string[], proxyItems: ProxyImportItem[]) => Promise<unknown>;
  onToggleModulesForSelected: (ids: string[], enabledModules: string[]) => Promise<void>;
  moduleCatalog: ModuleCatalogItem[];
  onImportProfilesFromJSON: (importedProfiles: Partial<Profile>[]) => Promise<void>;
  miniBrowserStatuses?: Record<string, MiniBrowserStatus>;
  profileProxyStates?: Record<string, ProfileProxyState>;
  onSelectionChange?: (selectedIds: string[]) => void;
}

export const ProfileManagerPage: React.FC<ProfileManagerPageProps> = (props) => {
  return <ProfileManagerView {...props} />;
};
