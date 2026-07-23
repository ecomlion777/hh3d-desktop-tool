/**
 * DashboardPage - Overview Analytics & Live System Ticker Page
 */

import React from 'react';
import { DashboardView } from '../components/views/DashboardView';
import { Profile, GroupItem, LogEntry, SystemStats, ViewTab } from '../types';

interface DashboardPageProps {
  profiles: Profile[];
  groups: GroupItem[];
  logs: LogEntry[];
  systemStats: SystemStats;
  onNavigate: (tab: ViewTab) => void;
  onRunGroup: (groupName: string) => void;
  onStopGroup: (groupName: string) => void;
  onOpenMiniBrowser: (profile: Profile) => void;
  onEditGroup?: (group: GroupItem) => void;
  onDeleteGroup?: (group: GroupItem) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = (props) => {
  return <DashboardView {...props} />;
};
