/**
 * BatchManagerPage - Batch Tasks & Automation Schedules Page
 */

import React from 'react';
import { BatchManagerView } from '../components/views/BatchManagerView';
import { BatchTask, Profile, GroupItem, BatchStatus } from '../types';

interface BatchManagerPageProps {
  batches: BatchTask[];
  profiles: Profile[];
  groups: GroupItem[];
  onStartBatch: (id: string) => Promise<void>;
  onStopBatch: (id: string) => Promise<void>;
  onResetBatch: (id: string) => Promise<void>;
  onCreateBatch: (data: {
    name: string;
    profileIds: string[];
    concurrency?: number;
    activityType?: string;
    groupTarget?: string;
    status?: BatchStatus;
  }) => Promise<any>;
  onUpdateBatch: (id: string, data: Partial<BatchTask>) => Promise<any>;
  onDeleteBatch: (id: string) => Promise<void>;
  onToggleBatch: (id: string) => void;
}

export const BatchManagerPage: React.FC<BatchManagerPageProps> = (props) => {
  return <BatchManagerView {...props} />;
};
