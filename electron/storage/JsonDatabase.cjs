/**
 * HH3D Desktop Tool - Local Atomic JSON Database Engine
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { validateDatabaseShape } = require('./validation.cjs');

const SCHEMA_VERSION = 1;

class JsonDatabase {
  constructor() {
    // Get user data path safely in Electron environment
    const userDataPath = app ? app.getPath('userData') : process.cwd();
    this.dataDir = path.join(userDataPath, 'hh3d-data');
    this.dataFile = path.join(this.dataDir, 'app-data.json');
    this.backupFile = path.join(this.dataDir, 'app-data.backup.json');
    this.tmpFile = path.join(this.dataDir, 'app-data.tmp.json');

    this.data = null;
    this.writePromiseChain = Promise.resolve();
  }

  /**
   * Initializes database directory and loads data or seeds if missing
   */
  async init() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    if (!fs.existsSync(this.dataFile)) {
      console.log('[JsonDatabase] Initializing new database with seed data...');
      this.data = this.generateSeedData();
      await this.saveDataImmediate(this.data);
    } else {
      await this.loadData();
    }
  }

  /**
   * Loads data from app-data.json, falling back to app-data.backup.json on error
   */
  async loadData() {
    try {
      const raw = fs.readFileSync(this.dataFile, 'utf-8');
      const parsed = JSON.parse(raw);
      validateDatabaseShape(parsed);
      this.data = parsed;
      console.log(`[JsonDatabase] Successfully loaded ${parsed.profiles.length} profiles and ${parsed.groups.length} groups.`);
    } catch (err) {
      console.error('[JsonDatabase] Primary database load failed:', err.message);
      
      // Attempt recovery from backup file
      if (fs.existsSync(this.backupFile)) {
        console.warn('[JsonDatabase] Attempting recovery from app-data.backup.json...');
        try {
          const rawBackup = fs.readFileSync(this.backupFile, 'utf-8');
          const parsedBackup = JSON.parse(rawBackup);
          validateDatabaseShape(parsedBackup);
          this.data = parsedBackup;
          // Restore primary data file from valid backup
          fs.writeFileSync(this.dataFile, JSON.stringify(parsedBackup, null, 2), 'utf-8');
          console.log('[JsonDatabase] Successfully restored database from backup file.');
          return;
        } catch (backupErr) {
          console.error('[JsonDatabase] Backup recovery also failed:', backupErr.message);
        }
      }

      // If load and backup both fail, raise clear error without destroying existing corrupt files
      throw new Error(`Dữ liệu cơ sở dữ liệu JSON bị hỏng: ${err.message}. Vui lòng kiểm tra file ${this.dataFile}`);
    }
  }

  /**
   * Enqueues an atomic write operation to ensure sequential file writes with caller promise isolation
   */
  saveData(newData) {
    const snapshot = JSON.parse(JSON.stringify(newData));
    const operation = this.writePromiseChain.then(() =>
      this.saveDataImmediate(snapshot)
    );

    this.writePromiseChain = operation.catch(error => {
      console.error('[JsonDatabase] Atomic write failed:', error);
    });

    return operation;
  }

  /**
   * Executes a transactional mutator sequentially inside the atomic write queue
   */
  transaction(mutator) {
    const operation = this.writePromiseChain.then(async () => {
      if (!this.data) {
        throw new Error('JsonDatabase chưa được khởi tạo.');
      }

      const workingData = JSON.parse(
        JSON.stringify(this.data)
      );

      const transactionResult =
        await mutator(workingData);

      if (
        !transactionResult ||
        !transactionResult.nextData
      ) {
        throw new Error(
          'Transaction không trả về nextData hợp lệ.'
        );
      }

      await this.saveDataImmediate(
        transactionResult.nextData
      );

      return transactionResult.result;
    });

    this.writePromiseChain =
      operation.catch(error => {
        console.error(
          '[JsonDatabase] Transaction failed:',
          error
        );
      });

    return operation;
  }

  /**
   * Performs atomic write: tmp file -> verify -> backup -> rename
   */
  async saveDataImmediate(newData) {
    const payload = {
      schemaVersion: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      profiles: newData.profiles || [],
      groups: newData.groups || []
    };

    validateDatabaseShape(payload);

    const jsonString = JSON.stringify(payload, null, 2);

    try {
      // 1. Write to temporary file
      fs.writeFileSync(this.tmpFile, jsonString, 'utf-8');

      // 2. Read back & parse & validate to verify integrity
      const readBack = fs.readFileSync(this.tmpFile, 'utf-8');
      const readBackParsed = JSON.parse(readBack);
      validateDatabaseShape(readBackParsed);

      // 3. Backup existing app-data.json if present
      if (fs.existsSync(this.dataFile)) {
        fs.copyFileSync(this.dataFile, this.backupFile);
      }

      // 4. Atomic rename tmp -> main data file
      fs.renameSync(this.tmpFile, this.dataFile);

      // Update in-memory reference ONLY after successful write
      this.data = payload;
    } catch (err) {
      if (fs.existsSync(this.tmpFile)) {
        try {
          fs.unlinkSync(this.tmpFile);
        } catch (e) {}
      }
      throw err;
    }
  }

  /**
   * Returns storage info for General Settings UI
   */
  getStorageInfo() {
    return {
      dataDirectory: this.dataDir,
      dataFile: this.dataFile,
      schemaVersion: this.data ? this.data.schemaVersion : SCHEMA_VERSION,
      profileCount: this.data && Array.isArray(this.data.profiles) ? this.data.profiles.length : 0,
      groupCount: this.data && Array.isArray(this.data.groups) ? this.data.groups.length : 0
    };
  }

  getData() {
    if (!this.data) {
      throw new Error('JsonDatabase chưa được khởi tạo.');
    }
    return this.data;
  }

  /**
   * Generates initial seed dataset (200 mock profiles & 5 mock groups)
   */
  generateSeedData() {
    const nowISO = new Date().toISOString();

    const groups = [
      { id: 'group_1', name: 'Nhóm Chính (Main)', description: 'Dàn clone chính cày cấp và săn boss top', color: '#10b981' },
      { id: 'group_2', name: 'Nhóm Farm 01', description: 'Nông trại tài nguyên phụ bản Hằng Ngày', color: '#3b82f6' },
      { id: 'group_3', name: 'Nhóm Farm 02', description: 'Nông trại thu thập nguyên liệu ép đồ', color: '#8b5cf6' },
      { id: 'group_4', name: 'Nhóm Clone Guild', description: 'Clone cống hiến Bang Hội & Phó bản Bang', color: '#f59e0b' },
      { id: 'group_5', name: 'Nhóm VIP Speed', description: 'Tài khoản VIP chạy tốc độ cao phó bản khó', color: '#ec4899' },
    ];

    const prefixes = ['VũĐế', 'ThiênSứ', 'ĐộcCô', 'HoàngKim', 'BạchHổ', 'ThanhRồng', 'HuyềnVũ', 'ChuTước', 'TuyệtThế', 'BáVương', 'TiênPhong', 'PhongVân'];
    const suffixes = ['Pro', 'Max', 'VIP', 'HH3D', 'Master', 'Farm01', 'Farm02', 'Boss', 'Top1', 'Guild'];
    const statuses = ['running', 'running', 'running', 'waiting', 'stopped', 'proxy_error', 'login_required'];

    const profiles = [];

    for (let i = 1; i <= 200; i++) {
      const groupIndex = Math.floor((i - 1) / 40);
      const groupObj = groups[groupIndex] || groups[0];

      const prefix = prefixes[(i - 1) % prefixes.length];
      const suffix = suffixes[(i + 3) % suffixes.length];
      const characterName = `${prefix}_${suffix}_${(i % 99) + 1}`;
      const uid = `HH3D-${88000 + i}`;

      const host = `103.142.${10 + (i % 20)}.${100 + (i % 50)}`;
      const port = 8000 + (i % 40) + 1;
      const proxyAddress = `${host}:${port}`;

      const status = statuses[(i * 7 + groupIndex) % statuses.length];
      const level = Math.floor(65 + (i % 55));
      const stamina = Math.floor(20 + (i % 80));

      profiles.push({
        id: `profile_${i}`,
        uid,
        displayName: characterName,
        characterName,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=HH3D_Char_${(i % 12) + 1}`,
        groupId: groupObj.id,
        group: groupObj.name,
        status,
        profilePath: `C:\\HH3D_AppData\\Profiles\\profile_${i}`,
        proxyId: `proxy_${(i % 40) + 1}`,
        proxyAddress,
        expectedIp: host,
        currentIp: host,
        level,
        stamina,
        currentActivity: status === 'running' ? 'Luyện Cấp (Leveling Map 85)' : status === 'waiting' ? 'Chờ Đến Giờ Hẹn Task' : 'Đã Dừng',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
      groups
    };
  }
}

module.exports = JsonDatabase;
