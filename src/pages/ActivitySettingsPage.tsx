/**
 * ActivitySettingsPage - Game Script Configurations Page
 */

import React from 'react';
import { ActivitySettingsView } from '../components/views/ActivitySettingsView';
import { ActivityConfig } from '../types';

interface ActivitySettingsPageProps {
  config: ActivityConfig;
  onSaveConfig: (config: ActivityConfig) => void;
}

export const ActivitySettingsPage: React.FC<ActivitySettingsPageProps> = (props) => {
  return <ActivitySettingsView {...props} />;
};
