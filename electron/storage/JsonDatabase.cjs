/**
 * HH3D Desktop Tool - Local Atomic JSON Database Engine
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const {
  SUPPORTED_SCHEMA_VERSION,
  validateDatabaseShape
} = require('./validation.cjs');

const SCHEMA_VERSION = SUPPORTED_SCHEMA_VERSION;

class JsonDatabase {
  constructor() {
    const userDataPath = app.getPath('userData');
    this.dataDir = path.join(userDataPath, 'hh3d-data');
    this.dataFile = path.join(this.dataDir, 'app-data.json');
    this.backupFile = path.join(this.dataDir, 'app-data.backup.json');
    this.tmpFile = path.join(this.dataDir, 'app-data.tmp.json');

    this.data = null;
    this.writePromiseChain = Promise.resolve();
  }

  async init() {
    fs.mkdirSync(this.dataDir, { recursive: true });

    if (!fs.existsSync(this.dataFile)) {
      console.log('[JsonDatabase] Initializing new schema v2 database with seed data...');
      this.data = this.generateSeedData();
      await this.saveDataImmediate(this.data, { skipBackup: true });
      return;
    }

    await this.loadData();
  }

  migrateToCurrent(data) {
    validateDatabaseShape(data, { allowLegacy: true });

    if (data.schemaVersion === SCHEMA_VERSION) {
      return { data, migrated: false };
    }

    if (data.schemaVersion === 1) {
      const now = new Date().toISOString();
      const profiles = data.profiles.map(profile => {
        const next = { ...profile };

        // Phase 03 seed contained display-only proxy IDs without real proxy records.
        // Preserve the old identifier for reference, but start Phase 05 in direct mode.
        if (next.proxyId) {
          next.legacyProxyId = next.proxyId;
          next.proxyId = null;
          next.proxyAddress = 'Không dùng Proxy';
          next.expectedIp = '';
          next.currentIp = '';
        }

        return next;
      });

      return {
        migrated: true,
        data: {
          ...data,
          schemaVersion: 2,
          updatedAt: now,
          profiles,
          groups: Array.isArray(data.groups) ? data.groups : [],
          proxies: []
        }
      };
    }

    throw new Error(`Không có migration cho schemaVersion ${data.schemaVersion}.`);
  }

  async loadData() {
    try {
      const raw = fs.readFileSync(this.dataFile, 'utf-8');
      const parsed = JSON.parse(raw);
      const migration = this.migrateToCurrent(parsed);

      if (migration.migrated) {
        console.log('[JsonDatabase] Migrating app-data.json from schema v1 to v2...');
        await this.saveDataImmediate(migration.data);
      } else {
        validateDatabaseShape(migration.data, { allowLegacy: false });
        this.data = migration.data;
      }

      console.log(
        `[JsonDatabase] Successfully loaded ${this.data.profiles.length} profiles, ` +
        `${this.data.groups.length} groups and ${this.data.proxies.length} proxies.`
      );
    } catch (err) {
      console.error('[JsonDatabase] Primary database load failed:', err.message);

      if (fs.existsSync(this.backupFile)) {
        console.warn('[JsonDatabase] Attempting recovery from app-data.backup.json...');
        try {
          const rawBackup = fs.readFileSync(this.backupFile, 'utf-8');
          const parsedBackup = JSON.parse(rawBackup);
          const migration = this.migrateToCurrent(parsedBackup);
          await this.saveDataImmediate(migration.data, { skipBackup: true });
          console.log('[JsonDatabase] Successfully restored database from backup file.');
          return;
        } catch (backupErr) {
          console.error('[JsonDatabase] Backup recovery also failed:', backupErr.message);
        }
      }

      throw new Error(
        `Dữ liệu cơ sở dữ liệu JSON bị hỏng: ${err.message}. ` +
        `Vui lòng kiểm tra file ${this.dataFile}`
      );
    }
  }

  saveData(newData) {
    const snapshot = JSON.parse(JSON.stringify(newData));
    const operation = this.writePromiseChain.then(() => this.saveDataImmediate(snapshot));

    this.writePromiseChain = operation.catch(error => {
      console.error('[JsonDatabase] Atomic write failed:', error);
    });

    return operation;
  }

  transaction(mutator) {
    const operation = this.writePromiseChain.then(async () => {
      if (!this.data) {
        throw new Error('JsonDatabase chưa được khởi tạo.');
      }

      const workingData = JSON.parse(JSON.stringify(this.data));
      const transactionResult = await mutator(workingData);

      if (!transactionResult || !transactionResult.nextData) {
        throw new Error('Transaction không trả về nextData hợp lệ.');
      }

      await this.saveDataImmediate(transactionResult.nextData);
      return transactionResult.result;
    });

    this.writePromiseChain = operation.catch(error => {
      console.error('[JsonDatabase] Transaction failed:', error);
    });

    return operation;
  }

  async saveDataImmediate(newData, options = {}) {
    const payload = {
      ...newData,
      schemaVersion: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      profiles: Array.isArray(newData.profiles) ? newData.profiles : [],
      groups: Array.isArray(newData.groups) ? newData.groups : [],
      proxies: Array.isArray(newData.proxies) ? newData.proxies : []
    };

    validateDatabaseShape(payload, { allowLegacy: false });
    const jsonString = JSON.stringify(payload, null, 2);

    try {
      fs.writeFileSync(this.tmpFile, jsonString, 'utf-8');

      const readBack = JSON.parse(fs.readFileSync(this.tmpFile, 'utf-8'));
      validateDatabaseShape(readBack, { allowLegacy: false });

      if (!options.skipBackup && fs.existsSync(this.dataFile)) {
        fs.copyFileSync(this.dataFile, this.backupFile);
      }

      if (fs.existsSync(this.dataFile)) {
        fs.rmSync(this.dataFile, { force: true });
      }
      fs.renameSync(this.tmpFile, this.dataFile);
      this.data = payload;
    } catch (err) {
      if (fs.existsSync(this.tmpFile)) {
        try { fs.unlinkSync(this.tmpFile); } catch {}
      }
      throw err;
    }
  }

  getStorageInfo() {
    return {
      dataDirectory: this.dataDir,
      dataFile: this.dataFile,
      schemaVersion: this.data ? this.data.schemaVersion : SCHEMA_VERSION,
      profileCount: this.data?.profiles?.length || 0,
      groupCount: this.data?.groups?.length || 0,
      proxyCount: this.data?.proxies?.length || 0
    };
  }

  getData() {
    if (!this.data) {
      throw new Error('JsonDatabase chưa được khởi tạo.');
    }
    return this.data;
  }

  generateSeedData() {
    const nowISO = new Date().toISOString();

    const groups = [
      { id: 'group_1', name: 'Nhóm Chính (Main)', description: 'Dàn clone chính cày cấp và săn boss top', color: '#10b981' },
      { id: 'group_2', name: 'Nhóm Farm 01', description: 'Nông trại tài nguyên phụ bản Hằng Ngày', color: '#3b82f6' },
      { id: 'group_3', name: 'Nhóm Farm 02', description: 'Nông trại thu thập nguyên liệu ép đồ', color: '#8b5cf6' },
      { id: 'group_4', name: 'Nhóm Clone Guild', description: 'Clone cống hiến Bang Hội & Phó bản Bang', color: '#f59e0b' },
      { id: 'group_5', name: 'Nhóm VIP Speed', description: 'Tài khoản VIP chạy tốc độ cao phó bản khó', color: '#ec4899' }
    ];

    const prefixes = ['VũĐế', 'ThiênSứ', 'ĐộcCô', 'HoàngKim', 'BạchHổ', 'ThanhRồng', 'HuyềnVũ', 'ChuTước', 'TuyệtThế', 'BáVương', 'TiênPhong', 'PhongVân'];
    const suffixes = ['Pro', 'Max', 'VIP', 'HH3D', 'Master', 'Farm01', 'Farm02', 'Boss', 'Top1', 'Guild'];
    const profiles = [];

    for (let i = 1; i <= 200; i++) {
      const groupIndex = Math.floor((i - 1) / 40);
      const group = groups[groupIndex] || groups[0];
      const characterName = `${prefixes[(i - 1) % prefixes.length]}_${suffixes[(i + 3) % suffixes.length]}_${(i % 99) + 1}`;

      profiles.push({
        id: `profile_${i}`,
        uid: `HH3D-${88000 + i}`,
        displayName: characterName,
        characterName,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=HH3D_Char_${(i % 12) + 1}`,
        groupId: group.id,
        group: group.name,
        status: 'stopped',
        profilePath: `C:\\HH3D_AppData\\Profiles\\profile_${i}`,
        proxyId: null,
        proxyAddress: 'Không dùng Proxy',
        expectedIp: '',
        currentIp: '',
        level: 65 + (i % 55),
        stamina: 20 + (i % 80),
        currentActivity: 'Đã Dừng',
        lastLoginAt: nowISO,
        lastRunAt: nowISO,
        nextRunAt: nowISO,
        enabledModules: ['daily_quest', 'dungeon', 'clear_inventory'],
        createdAt: nowISO,
        updatedAt: nowISO
      });
    }

    return {
      schemaVersion: SCHEMA_VERSION,
      updatedAt: nowISO,
      profiles,
      groups,
      proxies: []
    };
  }
}

module.exports = JsonDatabase;
