/**
 * ActivitySettingsPage - Phase 07 Module Framework page.
 */

import React from 'react';
import { ActivitySettingsView } from '../components/views/ActivitySettingsView';
import {
  ActivityConfig,
  ModuleCatalogItem,
  ModuleRuntimeStatus,
  ModuleRunResult,
  Profile
} from '../types';

interface ActivitySettingsPageProps {
  config: ActivityConfig;
  profiles: Profile[];
  moduleCatalog: ModuleCatalogItem[];
  moduleRuntimeStatuses: Record<string, ModuleRuntimeStatus>;
  onSaveConfig: (config: ActivityConfig) => Promise<void> | void;
  onRunModule: (profileId: string, moduleCode: string) => Promise<ModuleRunResult>;
}

export const ActivitySettingsPage: React.FC<ActivitySettingsPageProps> = props => {
  return <ActivitySettingsView {...props} />;
};
