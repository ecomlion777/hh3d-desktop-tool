/**
 * AppBridge Singleton Service Provider
 * Automatically detects Electron environment or fallback to MockAppBridge
 */

import { AppBridge } from '../types';
import { MockAppBridge, ElectronPreloadBridge } from './AppBridge';

function createAppBridge(): AppBridge {
  if (typeof window !== 'undefined' && window.desktopBridge) {
    console.log('[AppBridge] Initializing Native Electron Desktop Bridge');
    return new ElectronPreloadBridge();
  }
  
  console.log('[AppBridge] Initializing Mock App Bridge (Web Browser Mode)');
  return new MockAppBridge();
}

export const appBridge: AppBridge = createAppBridge();
