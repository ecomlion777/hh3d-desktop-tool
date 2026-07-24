/**
 * Deprecated compatibility export.
 *
 * The application now uses the unified AppBridge implementation selected by
 * appBridgeService. Keeping this small alias avoids maintaining a second mock
 * proxy implementation with incompatible public types.
 */
import type { AppBridge } from '../types';
import { appBridge } from './appBridgeService';

export type EventListener<T> = (data: T) => void;
export type IDesktopBridgeService = AppBridge;
export const desktopBridge: AppBridge = appBridge;
