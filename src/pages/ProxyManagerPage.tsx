import React from 'react';
import { ProxyManagerView } from '../components/views/ProxyManagerView';
import type { Profile, ProxyItem, ProxyTestResult } from '../types';

interface ProxyManagerPageProps {
  proxies: ProxyItem[];
  profiles: Profile[];
  onTestProxy: (id: string) => Promise<ProxyTestResult>;
  onTestAllProxies: () => Promise<ProxyTestResult[]>;
  onOpenAddProxyModal: () => void;
  onEditProxy: (proxy: ProxyItem) => void;
  onDeleteProxies: (ids: string[]) => Promise<void>;
  onToggleEnabled: (proxy: ProxyItem) => Promise<void>;
  onAssignProfilesToProxy: (proxyId: string, profileIds: string[]) => Promise<void>;
  onError: (message: string) => void;
}

export const ProxyManagerPage: React.FC<ProxyManagerPageProps> = props => <ProxyManagerView {...props} />;
