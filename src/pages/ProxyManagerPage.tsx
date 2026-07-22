/**
 * ProxyManagerPage - Network Proxies Page
 */

import React from 'react';
import { ProxyManagerView } from '../components/views/ProxyManagerView';
import { ProxyItem, Profile } from '../types';

interface ProxyManagerPageProps {
  proxies: ProxyItem[];
  profiles: Profile[];
  onTestProxy: (id: string) => void;
  onTestAllProxies: () => void;
  onOpenAddProxyModal: () => void;
  onDeleteProxies: (ids: string[]) => void;
  onAssignProfilesToProxy: (proxyId: string, profileIds: string[]) => Promise<void>;
}

export const ProxyManagerPage: React.FC<ProxyManagerPageProps> = (props) => {
  return <ProxyManagerView {...props} />;
};
