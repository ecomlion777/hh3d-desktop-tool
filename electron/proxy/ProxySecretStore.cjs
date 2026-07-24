/**
 * HH3D Desktop Tool - OS encrypted proxy credential store.
 *
 * Public proxy metadata stays in app-data.json. Usernames/passwords are stored
 * separately as safeStorage-encrypted Base64 strings under userData/hh3d-data.
 */

const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');
const { validateProxyId, proxyError } = require('./proxyValidation.cjs');

const SECRET_SCHEMA_VERSION = 1;

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

class ProxySecretStore {
  constructor() {
    this.dataDir = path.join(app.getPath('userData'), 'hh3d-data');
    this.secretFile = path.join(this.dataDir, 'proxy-secrets.json');
    this.backupFile = path.join(this.dataDir, 'proxy-secrets.backup.json');
    this.tmpFile = path.join(this.dataDir, 'proxy-secrets.tmp.json');
    this.data = null;
    this.writePromiseChain = Promise.resolve();
  }

  async init() {
    fs.mkdirSync(this.dataDir, { recursive: true });

    if (!fs.existsSync(this.secretFile)) {
      // Do not create a secret file until the first authenticated proxy is saved.
      this.data = this.createEmptyData();
      return;
    }

    try {
      this.data = this.readAndValidate(this.secretFile);
      return;
    } catch (error) {
      console.error('[ProxySecretStore] Primary secret file load failed:', error.message);
    }

    if (fs.existsSync(this.backupFile)) {
      try {
        this.data = this.readAndValidate(this.backupFile);
        await this.writeImmediate(this.data, { skipBackup: true });
        console.warn('[ProxySecretStore] Restored encrypted credentials from backup.');
        return;
      } catch (backupError) {
        console.error('[ProxySecretStore] Backup load failed:', backupError.message);
      }
    }

    throw proxyError(
      'PROXY_CREDENTIAL_DECRYPT_FAILED',
      'File credential proxy bị hỏng hoặc không thể đọc.'
    );
  }

  createEmptyData() {
    return {
      schemaVersion: SECRET_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      secrets: {}
    };
  }

  validateShape(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Secret store phải là object.');
    }
    if (data.schemaVersion !== SECRET_SCHEMA_VERSION) {
      throw new Error(`Secret schemaVersion không hỗ trợ: ${data.schemaVersion}`);
    }
    if (!data.secrets || typeof data.secrets !== 'object' || Array.isArray(data.secrets)) {
      throw new Error('Secret store thiếu secrets object.');
    }

    for (const [proxyId, entry] of Object.entries(data.secrets)) {
      validateProxyId(proxyId);
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        throw new Error(`Secret entry của proxy ${proxyId} không hợp lệ.`);
      }
      if (
        typeof entry.usernameEncrypted !== 'string' ||
        typeof entry.passwordEncrypted !== 'string' ||
        !entry.usernameEncrypted ||
        !entry.passwordEncrypted
      ) {
        throw new Error(`Secret entry của proxy ${proxyId} thiếu dữ liệu mã hóa.`);
      }
    }
    return true;
  }

  readAndValidate(filePath) {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    this.validateShape(parsed);
    return parsed;
  }

  isEncryptionAvailable() {
    if (!app.isReady()) return false;
    if (!safeStorage.isEncryptionAvailable()) return false;

    // Electron can report safeStorage available on Linux while using the
    // basic_text backend. Phase 05 never accepts that plaintext fallback.
    if (
      process.platform === 'linux' &&
      typeof safeStorage.getSelectedStorageBackend === 'function'
    ) {
      return safeStorage.getSelectedStorageBackend() !== 'basic_text';
    }
    return true;
  }

  ensureEncryptionAvailable() {
    if (!this.isEncryptionAvailable()) {
      throw proxyError(
        'SAFE_STORAGE_UNAVAILABLE',
        'Mã hóa hệ điều hành chưa khả dụng. Không thể lưu proxy có tài khoản/mật khẩu.'
      );
    }
  }

  getData() {
    if (!this.data) {
      this.data = this.createEmptyData();
    }
    return this.data;
  }

  /**
   * Serializes read -> mutate -> atomic-write so concurrent credential updates
   * cannot overwrite one another. A failed operation rejects its caller but the
   * internal queue is recovered for later operations.
   */
  transaction(mutator) {
    const operation = this.writePromiseChain.then(async () => {
      const workingData = cloneJson(this.getData());
      const transactionResult = await mutator(workingData);

      if (!transactionResult || !transactionResult.nextData) {
        throw new Error('Secret transaction không trả về nextData hợp lệ.');
      }

      await this.writeImmediate(transactionResult.nextData);
      return transactionResult.result;
    });

    this.writePromiseChain = operation.catch(error => {
      console.error('[ProxySecretStore] Secret transaction failed:', error.message);
    });

    return operation;
  }

  async writeImmediate(nextData, options = {}) {
    const payload = {
      schemaVersion: SECRET_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      secrets: nextData.secrets || {}
    };
    this.validateShape(payload);

    try {
      fs.mkdirSync(this.dataDir, { recursive: true });
      fs.writeFileSync(this.tmpFile, JSON.stringify(payload, null, 2), 'utf-8');
      this.readAndValidate(this.tmpFile);

      if (!options.skipBackup && fs.existsSync(this.secretFile)) {
        fs.copyFileSync(this.secretFile, this.backupFile);
      }

      if (fs.existsSync(this.secretFile)) {
        fs.rmSync(this.secretFile, { force: true });
      }
      fs.renameSync(this.tmpFile, this.secretFile);
      this.data = payload;
    } catch (error) {
      if (fs.existsSync(this.tmpFile)) {
        try { fs.unlinkSync(this.tmpFile); } catch {}
      }
      throw error;
    }
  }

  encrypt(value) {
    this.ensureEncryptionAvailable();
    return safeStorage.encryptString(String(value)).toString('base64');
  }

  decrypt(value) {
    this.ensureEncryptionAvailable();
    try {
      return safeStorage.decryptString(Buffer.from(value, 'base64'));
    } catch {
      throw proxyError(
        'PROXY_CREDENTIAL_DECRYPT_FAILED',
        'Không thể giải mã credential proxy trên máy hiện tại.'
      );
    }
  }

  async setCredentials(proxyId, username, password) {
    const id = validateProxyId(proxyId);
    this.ensureEncryptionAvailable();

    return this.transaction(async workingData => {
      const existing = workingData.secrets[id];
      const existingUsername = existing ? this.decrypt(existing.usernameEncrypted) : '';
      const existingPassword = existing ? this.decrypt(existing.passwordEncrypted) : '';

      const nextUsername = username !== undefined && username !== null && String(username) !== ''
        ? String(username)
        : existingUsername;
      // A blank password intentionally preserves the current password.
      const nextPassword = password !== undefined && password !== null && String(password) !== ''
        ? String(password)
        : existingPassword;

      if (!nextUsername || !nextPassword) {
        throw proxyError('PROXY_AUTH_REQUIRED', 'Proxy xác thực cần đầy đủ username và password.');
      }

      workingData.secrets[id] = {
        usernameEncrypted: this.encrypt(nextUsername),
        passwordEncrypted: this.encrypt(nextPassword)
      };

      return { nextData: workingData, result: true };
    });
  }

  /** Store multiple credentials in one atomic secret-file write. */
  async setManyCredentials(items) {
    if (!Array.isArray(items) || items.length === 0) return true;
    this.ensureEncryptionAvailable();

    return this.transaction(async workingData => {
      for (const item of items) {
        const id = validateProxyId(item.proxyId);
        const username = String(item.username || '');
        const password = String(item.password || '');
        if (!username || !password) {
          throw proxyError('PROXY_AUTH_REQUIRED', `Proxy ${id} thiếu username hoặc password.`);
        }
        workingData.secrets[id] = {
          usernameEncrypted: this.encrypt(username),
          passwordEncrypted: this.encrypt(password)
        };
      }
      return { nextData: workingData, result: true };
    });
  }

  getCredentials(proxyId) {
    const id = validateProxyId(proxyId);
    const entry = this.getData().secrets[id];
    if (!entry) return null;

    return {
      username: this.decrypt(entry.usernameEncrypted),
      password: this.decrypt(entry.passwordEncrypted)
    };
  }

  hasCredentials(proxyId) {
    const id = validateProxyId(proxyId);
    return Boolean(this.getData().secrets[id]);
  }

  getMaskedUsername(proxyId) {
    const credentials = this.getCredentials(proxyId);
    if (!credentials) return undefined;
    const username = credentials.username;
    return username.length <= 1
      ? '*'
      : `${username[0]}${'*'.repeat(Math.min(5, username.length - 1))}`;
  }

  async deleteCredentials(proxyId) {
    const id = validateProxyId(proxyId);
    if (!this.getData().secrets[id]) return false;

    return this.transaction(async workingData => {
      if (!workingData.secrets[id]) {
        return { nextData: workingData, result: false };
      }
      delete workingData.secrets[id];
      return { nextData: workingData, result: true };
    });
  }

  async deleteManyCredentials(proxyIds) {
    const ids = new Set((proxyIds || []).map(validateProxyId));
    if (ids.size === 0) return true;

    return this.transaction(async workingData => {
      for (const id of ids) delete workingData.secrets[id];
      return { nextData: workingData, result: true };
    });
  }

  async clearCredentials(proxyId) {
    return this.deleteCredentials(proxyId);
  }

  getStorageInfo() {
    return {
      secretFileExists: fs.existsSync(this.secretFile),
      encryptionAvailable: this.isEncryptionAvailable()
    };
  }
}

module.exports = ProxySecretStore;
