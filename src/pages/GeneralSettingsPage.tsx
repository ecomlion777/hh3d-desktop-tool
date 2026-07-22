/**
 * GeneralSettingsPage - Application Settings Page
 */

import React from 'react';
import { GeneralSettingsView } from '../components/views/GeneralSettingsView';
import { GeneralAppSettings } from '../types';

interface GeneralSettingsPageProps {
  settings: GeneralAppSettings;
  onSaveSettings: (settings: GeneralAppSettings) => void;
}

export const GeneralSettingsPage: React.FC<GeneralSettingsPageProps> = (props) => {
  return <GeneralSettingsView {...props} />;
};
