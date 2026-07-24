/**
 * HH3D Desktop Tool - Mini Browser Constants
 */

const DEFAULT_TARGET_URL = 'https://hoathinh3d.co/';
const TARGET_URL = DEFAULT_TARGET_URL;

/**
 * Allowed top-level hosts.
 * hoathinh3d.co currently redirects to hoathinh3d.st, so both domains
 * and their subdomains must be accepted inside the same Mini Browser.
 */
const DEFAULT_ALLOWED_HOSTS = [
  'hoathinh3d.co',
  'hoathinh3d.com',
  'hoathinh3d.st'
];
const ALLOWED_HOSTS = DEFAULT_ALLOWED_HOSTS;

const DEFAULT_WINDOW_CONFIG = {
  width: 1280,
  height: 820,
  minWidth: 900,
  minHeight: 600,
  show: false,
  autoHideMenuBar: true,
  backgroundColor: '#080f20'
};

const PARTITION_PREFIX = 'persist:hh3d-profile-';

const IPC_CHANNELS = {
  OPEN: 'mini-browser:open',
  CLOSE: 'mini-browser:close',
  FOCUS: 'mini-browser:focus',
  RELOAD: 'mini-browser:reload',
  GET_STATUS: 'mini-browser:get-status',
  LIST_STATUSES: 'mini-browser:list-statuses',
  CLEAR_SESSION: 'mini-browser:clear-session',
  STATUS_CHANGED: 'mini-browser:status-changed'
};

module.exports = {
  TARGET_URL,
  DEFAULT_TARGET_URL,
  ALLOWED_HOSTS,
  DEFAULT_ALLOWED_HOSTS,
  DEFAULT_WINDOW_CONFIG,
  PARTITION_PREFIX,
  IPC_CHANNELS
};
