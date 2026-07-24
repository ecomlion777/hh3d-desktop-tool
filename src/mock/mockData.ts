/**
 * Mock Data Generators & Initial Datasets
 * Located in /src/mock
 */

import { Profile, ProxyItem, GroupItem, BatchTask, LogEntry, ActivityConfig, GeneralAppSettings } from '../shared';

const CHARACTER_PREFIXES = [
  'VũĐế', 'ThiênSứ', 'ĐộcCô', 'HoàngKim', 'BạchHổ', 'ThanhRồng', 'HuyềnVũ', 'ChuTước',
  'TuyệtThế', 'BáVương', 'TiênPhong', 'PhongVân', 'ThầnMa', 'NgộKhông', 'MôHình', 'VôSong',
  'ThầnLong', 'HắcAm', 'SátThủ', 'MậtMã', 'ChiếnThần', 'TụNghĩa', 'PháThiên', 'LăngTiêu'
];

const CHARACTER_SUFFIXES = [
  'Pro', 'Max', 'VIP', 'HH3D', 'Master', 'Farm01', 'Farm02', 'Boss', 'Top1', 'Guild',
  'Super', 'Vip99', 'Zero', 'Alpha', 'Omega', 'Prime', 'Ultra', 'Solo', 'God', 'Ace'
];

export const GROUPS_DATA = [
  { id: 'group_1', name: 'Nhóm Chính (Main)', description: 'Dàn clone chính cày cấp và săn boss top', color: '#10b981' },
  { id: 'group_2', name: 'Nhóm Farm 01', description: 'Nông trại tài nguyên phụ bản Hằng Ngày', color: '#3b82f6' },
  { id: 'group_3', name: 'Nhóm Farm 02', description: 'Nông trại thu thập nguyên liệu ép đồ', color: '#8b5cf6' },
  { id: 'group_4', name: 'Nhóm Clone Guild', description: 'Clone cống hiến Bang Hội & Phó bản Bang', color: '#f59e0b' },
  { id: 'group_5', name: 'Nhóm VIP Speed', description: 'Tài khoản VIP chạy tốc độ cao phó bản khó', color: '#ec4899' },
];

const ACTIVITIES_LIST = [
  'Luyện Cấp (Leveling Map 85)',
  'Nhiệm Vụ Hàng Ngày (7/10)',
  'Săn Boss Thế Giới (Tầng 4)',
  'Vượt Phụ Bản Ma Vương',
  'Thu Thập Tài Nguyên (Kháng Khống)',
  'Điểm Danh & Nhận Thư',
  'Ủy Thác Đào Khoáng',
  'Đang Kiểm Tra Đăng Nhập',
  'Chờ Hồi Thể Lực (Resting)',
  'Dọn Dẹp Túi Đồ & Bán Rác'
];

export function generateInitialProxies(): ProxyItem[] {
  const proxies: ProxyItem[] = [];
  const now = new Date().toISOString();
  for (let i = 1; i <= 8; i++) {
    const protocol: 'http' | 'https' | 'socks5' = i % 3 === 0 ? 'socks5' : i % 2 === 0 ? 'https' : 'http';
    const host = `103.142.${10 + i}.${100 + i}`;
    const port = 8000 + i;
    proxies.push({
      id: `mock_proxy_${i}`,
      name: `Mock Proxy ${i}`,
      protocol,
      host,
      port,
      enabled: true,
      authRequired: false,
      hasCredentials: false,
      credentialState: 'none',
      notes: 'Web Preview mock only',
      createdAt: now,
      updatedAt: now,
      assignedProfileCount: 0,
      testState: 'not_tested',
      ipPort: `${host}:${port}`,
      status: 'unknown',
      assignedProfilesCount: 0,
      ping: 0,
      lastChecked: 'Chưa test'
    });
  }
  return proxies;
}

export function generateInitialProfiles(proxies: ProxyItem[]): Profile[] {
  const profiles: Profile[] = [];
  const nowISO = new Date().toISOString();
  
  const statuses: ('running' | 'waiting' | 'stopped' | 'proxy_error' | 'login_required')[] = [
    'running', 'running', 'running', 'waiting', 'stopped', 'proxy_error', 'login_required'
  ];

  for (let i = 1; i <= 200; i++) {
    const groupIndex = Math.floor((i - 1) / 40);
    const groupObj = GROUPS_DATA[groupIndex];
    
    const prefix = CHARACTER_PREFIXES[(i - 1) % CHARACTER_PREFIXES.length];
    const suffix = CHARACTER_SUFFIXES[(i + 3) % CHARACTER_SUFFIXES.length];
    const characterName = `${prefix}_${suffix}_${(i % 99) + 1}`;
    
    const uid = `HH3D-${88000 + i}`;
    
    const proxyIndex = (i - 1) % proxies.length;
    const proxy = proxies[proxyIndex];
    
    let status = statuses[(i * 7 + groupIndex) % statuses.length];
    
    const level = Math.floor(65 + (i % 55));
    const stamina = Math.floor(20 + Math.random() * 80);
    
    const randomActivity = ACTIVITIES_LIST[(i * 3) % ACTIVITIES_LIST.length];
    const currentActivity = status === 'running' ? randomActivity : status === 'waiting' ? 'Chờ Đến Giờ Hẹn Task' : 'Đã Dừng';
    
    const nextMinutes = Math.floor(1 + Math.random() * 45);
    const nextRunTime = status === 'running' ? 'Đang chạy' : status === 'waiting' ? `Sau ${nextMinutes} phút` : '--:--';
    
    const avatarSeed = (i % 12) + 1;
    const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=HH3D_Char_${avatarSeed}`;

    profiles.push({
      id: `profile_${i}`,
      uid,
      displayName: characterName,
      avatarUrl,
      groupId: groupObj.id,
      status,
      profilePath: `C:\\HH3D_AppData\\Profiles\\profile_${i}`,
      proxyId: proxy.id,
      expectedIp: proxy.host,
      currentIp: proxy.host,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      lastLoginAt: new Date(Date.now() - Math.floor(Math.random() * 86400000)).toISOString(),
      lastRunAt: new Date(Date.now() - Math.floor(Math.random() * 3600000)).toISOString(),
      nextRunAt: new Date(Date.now() + Math.floor(Math.random() * 7200000)).toISOString(),
      enabledModules: ['daily_quest', 'dungeon', 'clear_inventory'],
      createdAt: nowISO,
      updatedAt: nowISO,

      // UI compatibility fields
      stt: i,
      characterName,
      group: groupObj.name,
      proxyAddress: proxy.ipPort || `${proxy.host}:${proxy.port}`,
      currentActivity,
      nextRunTime,
      level,
      stamina,
      lastActive: new Date(Date.now() - Math.floor(Math.random() * 7200000)).toLocaleTimeString('vi-VN'),
      notes: i % 5 === 0 ? 'Ưu tiên cày phụ bản buổi tối' : undefined,
      isSelected: false
    });
  }

  return profiles;
}

export function generateInitialGroups(profiles: Profile[]): GroupItem[] {
  return GROUPS_DATA.map(g => {
    const groupProfiles = profiles.filter(p => p.group === g.name || p.groupId === g.id);
    return {
      id: g.id,
      name: g.name,
      description: g.description,
      profileCount: groupProfiles.length,
      runningCount: groupProfiles.filter(p => p.status === 'running').length,
      waitingCount: groupProfiles.filter(p => p.status === 'waiting').length,
      stoppedCount: groupProfiles.filter(p => p.status === 'stopped' || p.status === 'proxy_error' || p.status === 'login_required').length,
      color: g.color
    };
  });
}

export function generateInitialBatches(): BatchTask[] {
  const nowISO = new Date().toISOString();
  return [
    {
      id: 'batch_1',
      name: 'Tự động chạy Nhiệm Vụ Hàng Ngày (Nhóm Main)',
      profileIds: Array.from({ length: 40 }, (_, idx) => `profile_${idx + 1}`),
      concurrency: 40,
      status: 'Running',
      totalProfiles: 40,
      readyCount: 12,
      runningCount: 15,
      successCount: 12,
      failedCount: 1,
      startedAt: new Date(Date.now() - 3600000).toISOString(),
      completedAt: '',

      // UI compatibility fields
      title: 'Tự động chạy Nhiệm Vụ Hàng Ngày (Nhóm Main)',
      groupTarget: 'Nhóm Chính (Main)',
      activityType: 'Nhiệm Vụ Hàng Ngày',
      scheduleCron: '0 06:00, 18:00 Hàng Ngày',
      lastRun: '06:00 Hôm nay',
      nextRun: '18:00 Hôm nay',
      successRate: 92.3,
      executedProfiles: 25
    },
    {
      id: 'batch_2',
      name: 'Săn Boss Phụ Bản Tầng 4 (Nhóm VIP Speed)',
      profileIds: Array.from({ length: 40 }, (_, idx) => `profile_${idx + 161}`),
      concurrency: 40,
      status: 'Ready',
      totalProfiles: 40,
      readyCount: 40,
      runningCount: 0,
      successCount: 0,
      failedCount: 0,
      startedAt: '',
      completedAt: '',

      // UI compatibility fields
      title: 'Săn Boss Phụ Bản Tầng 4 (Nhóm VIP Speed)',
      groupTarget: 'Nhóm VIP Speed',
      activityType: 'Săn Boss Thế Giới',
      scheduleCron: 'Mỗi 4 tiếng',
      lastRun: 'Chưa chạy',
      nextRun: 'Sẵn sàng kích hoạt',
      successRate: 100,
      executedProfiles: 0
    },
    {
      id: 'batch_3',
      name: 'Farm Cống Hiến Guild (Nhóm Clone Guild)',
      profileIds: Array.from({ length: 40 }, (_, idx) => `profile_${idx + 121}`),
      concurrency: 30,
      status: 'Completed',
      totalProfiles: 40,
      readyCount: 0,
      runningCount: 0,
      successCount: 40,
      failedCount: 0,
      startedAt: new Date(Date.now() - 86400000).toISOString(),
      completedAt: new Date(Date.now() - 82800000).toISOString(),

      // UI compatibility fields
      title: 'Farm Cống Hiến Guild (Nhóm Clone Guild)',
      groupTarget: 'Nhóm Clone Guild',
      activityType: 'Cống Hiến Bang',
      scheduleCron: '12:00 Hàng Ngày',
      lastRun: '12:00 Hôm qua',
      nextRun: '12:00 Hôm nay',
      successRate: 100,
      executedProfiles: 40
    },
    {
      id: 'batch_4',
      name: 'Thu Thập Rương Tài Nguyên (Nhóm Trù Bị)',
      profileIds: Array.from({ length: 25 }, (_, idx) => `profile_${idx + 81}`),
      concurrency: 20,
      status: 'Preparing',
      totalProfiles: 25,
      readyCount: 25,
      runningCount: 0,
      successCount: 0,
      failedCount: 0,
      startedAt: '',
      completedAt: '',

      // UI compatibility fields
      title: 'Thu Thập Rương Tài Nguyên (Nhóm Trù Bị)',
      groupTarget: 'Nhóm Trù Bị',
      activityType: 'Thu Thập Tài Nguyên',
      scheduleCron: 'Thủ công',
      lastRun: 'Chưa khởi chạy',
      nextRun: 'Đang chuẩn bị',
      successRate: 0,
      executedProfiles: 0
    },
    {
      id: 'batch_5',
      name: 'Clear Kho & Mua Bình Thể Lực (Nhóm Phụ)',
      profileIds: Array.from({ length: 30 }, (_, idx) => `profile_${idx + 41}`),
      concurrency: 25,
      status: 'PartiallyFailed',
      totalProfiles: 30,
      readyCount: 0,
      runningCount: 0,
      successCount: 24,
      failedCount: 6,
      startedAt: new Date(Date.now() - 14400000).toISOString(),
      completedAt: new Date(Date.now() - 10800000).toISOString(),

      title: 'Clear Kho & Mua Bình Thể Lực (Nhóm Phụ)',
      groupTarget: 'Nhóm Phụ',
      activityType: 'Clear Dọn Kho',
      scheduleCron: 'Hàng Ngày',
      lastRun: '4 tiếng trước',
      nextRun: 'Ngày mai',
      successRate: 80,
      executedProfiles: 30
    }
  ];
}

export function generateInitialLogs(profiles: Profile[]): LogEntry[] {
  const sampleLogs: LogEntry[] = [];
  const sources = ['SYSTEM', 'PROXY_ENGINE', 'GAME_API_SIMULATOR', 'BATCH_SCHEDULE', 'AUTO_LOGIN'];
  const levels: ('info' | 'warn' | 'error' | 'success')[] = ['info', 'info', 'success', 'warn', 'error'];
  
  const now = Date.now();
  for (let i = 0; i < 35; i++) {
    const profile = profiles[i % profiles.length];
    const lvl = levels[i % levels.length];
    const timestampISO = new Date(now - i * 180000).toISOString();
    const timeStr = new Date(now - i * 180000).toLocaleTimeString('vi-VN');
    
    let msg = '';
    let actionName = 'TASK_EXECUTE';
    if (lvl === 'success') {
      actionName = 'QUEST_COMPLETED';
      msg = `Tài khoản ${profile.displayName || profile.characterName} (${profile.uid}) đã hoàn thành Nhiệm vụ Hàng Ngày. Bạc +45,000, EXP +120,000.`;
    } else if (lvl === 'info') {
      actionName = 'STATUS_CHANGE';
      msg = `Tài khoản ${profile.displayName || profile.characterName} chuyển trạng thái hoạt động: ${profile.currentActivity || 'Luyện cấp'}.`;
    } else if (lvl === 'warn') {
      actionName = 'STAMINA_LOW';
      msg = `Cảnh báo thể lực tài khoản ${profile.displayName || profile.characterName} dưới 15%. Chuyển sang chế độ Chờ Phục Hồi.`;
    } else {
      actionName = 'PROXY_CONNECT_ERROR';
      msg = `Lỗi kết nối Proxy ${profile.proxyAddress} đối với tài khoản ${profile.displayName || profile.characterName}. Đang thử kết nối lại (Lần 1/3)...`;
    }

    sampleLogs.push({
      id: `log_${i + 1}`,
      timestamp: timeStr,
      profileId: profile.id,
      moduleCode: sources[i % sources.length],
      level: lvl,
      action: actionName,
      message: msg,
      httpStatus: lvl === 'error' ? 502 : 200,
      durationMs: Math.floor(120 + Math.random() * 800),
      retryCount: lvl === 'error' ? 1 : 0,

      // UI compatibility fields
      profileUid: profile.uid,
      profileName: profile.displayName || profile.characterName,
      source: sources[i % sources.length]
    });
  }

  return sampleLogs;
}

export const DEFAULT_ACTIVITY_CONFIG: ActivityConfig = {
  autoDailyQuest: true,
  autoDungeon: true,
  autoBossRaid: false,
  autoClearInventory: true,
  autoClaimMailReward: true,
  delayBetweenActions: 3,
  maxConcurrentProfiles: 25,
  autoReloginOnDisconnect: true,
  reloginAttempts: 3,
  proxyFailover: true,
  scriptPreset: 'HH3D_Optimal_Farm_v2.lua'
};

export const DEFAULT_GENERAL_SETTINGS: GeneralAppSettings = {
  websiteBaseUrl: 'https://hoathinh3d.co/',
  websiteAllowedHosts: ['hoathinh3d.co', 'hoathinh3d.com', 'hoathinh3d.st'],
  theme: 'dark',
  maxThreads: 30,
  minimizeToTray: true,
  autoStartWithSystem: false,
  ipcMode: 'mock',
  proxyTimeout: 10,
  checkUpdateAuto: true,
  language: 'vi'
};
