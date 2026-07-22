/**
 * LogsPage - System Event Logs Page
 */

import React from 'react';
import { LogsView } from '../components/views/LogsView';
import { LogEntry } from '../types';

interface LogsPageProps {
  logs: LogEntry[];
  onClearLogs: () => void;
}

export const LogsPage: React.FC<LogsPageProps> = (props) => {
  return <LogsView {...props} />;
};
