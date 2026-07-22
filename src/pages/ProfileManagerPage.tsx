/**
 * ProfileManagerPage - Profile Management Page
 */

import React from 'react';
import { ProfileManagerView } from '../components/views/ProfileManagerView';
import { Profile, GroupItem, ProxyItem } from '../types';

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
  onOpenMiniBrowser: (profile: Profile) => void;
  onOpenProfileSettings: (profile: Profile) => void;
  onOpenAddProfile: () => void;
  onUpdateProfile: (id: string, updatedData: Partial<Profile>) => Promise<void>;
  onAssignGroupForSelected: (ids: string[], groupName: string) => Promise<void>;
  onAssignProxyForSelected: (ids: string[], proxyId: string) => Promise<void>;
  onToggleModulesForSelected: (ids: string[], enabledModules: string[]) => Promise<void>;
  onImportProfilesFromJSON: (importedProfiles: Partial<Profile>[]) => Promise<void>;
}

export const ProfileManagerPage: React.FC<ProfileManagerPageProps> = (props) => {
  return <ProfileManagerView {...props} />;
};
