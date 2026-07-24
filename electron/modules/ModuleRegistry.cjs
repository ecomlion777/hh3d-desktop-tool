const { MODULE_CATALOG_VERSION } = require('./moduleConstants.cjs');
const { validateModuleCode, validateModuleManifest } = require('./moduleValidation.cjs');

const BUILTIN_CATALOG = Object.freeze([
  {
    code: 'session_check',
    label: 'Kiểm tra Session / Network',
    description: 'Kiểm tra persistent Chromium session và network trước khi Worker chạy.',
    category: 'core',
    version: '1.0.0',
    implementationState: 'ready',
    required: true,
    defaultEnabled: true,
    triggers: ['manual', 'worker_start'],
    order: 0,
    sourceVersion: 'desktop-core',
    defaultConfig: {}
  },
  {
    code: 'framework_diagnostic',
    label: 'Chẩn đoán Module Framework',
    description: 'Module nội bộ không gọi API game, dùng để xác nhận registry, context và logging.',
    category: 'core',
    version: '1.0.0',
    implementationState: 'ready',
    required: false,
    defaultEnabled: false,
    triggers: ['manual'],
    order: 10,
    sourceVersion: 'desktop-core',
    defaultConfig: {}
  },
  {
    code: 'chuc_phuc',
    label: 'Chúc Phúc',
    description: 'Chúc phúc các phòng cưới Đạo Lữ/Hồng Nhan và nhận lì xì Tiên Duyên bằng session, nonce và proxy của profile.',
    category: 'social',
    version: '1.0.0',
    implementationState: 'ready',
    required: false,
    defaultEnabled: false,
    triggers: ['manual', 'worker_start'],
    order: 90,
    sourceVersion: '5.4.8',
    defaultConfig: {
      retrySecurityContextOnce: true,
      receiveRedPackets: true,
      processHongNhan: true,
      checkIntervalMinutes: 30,
      roomDelayMs: 500,
      maxRoomsPerRun: 100,
      blessingMessage: 'Chúc phúc trăm năm hạnh phúc 🎉',
      hongNhanBlessingMessage: '🌠 Một đoạn hồng duyên, vạn phần cơ ngộ! Chúc mừng cơ duyên đẹp giữa chốn hồng trần. ✨'
    }
  },
  {
    code: 'diem_danh',
    label: 'Điểm Danh',
    description: 'Thực hiện Điểm Danh qua REST API bằng đúng persistent session và proxy của profile.',
    category: 'daily',
    version: '1.0.0',
    implementationState: 'ready',
    required: false,
    defaultEnabled: false,
    triggers: ['manual', 'worker_start'],
    order: 100,
    sourceVersion: '5.4.8',
    defaultConfig: {
      retryNonceOnce: true
    }
  },
  {
    code: 'te_le',
    label: 'Tế Lễ',
    description: 'Thực hiện Tế Lễ Tông Môn bằng REST API với nonce, security_token, session và proxy của profile.',
    category: 'daily',
    version: '1.0.0',
    implementationState: 'ready',
    required: false,
    defaultEnabled: false,
    triggers: ['manual', 'worker_start'],
    order: 120,
    sourceVersion: '5.4.8',
    defaultConfig: {
      retrySecurityContextOnce: true
    }
  },
  {
    code: 'van_dap', label: 'Vấn Đáp', description: 'Khung module Vấn Đáp từ userscript HH3D.',
    category: 'daily', version: '0.1.0', implementationState: 'planned', required: false,
    defaultEnabled: false, triggers: ['manual', 'worker_start'], order: 110, sourceVersion: '5.4.8', defaultConfig: {}
  },
  {
    code: 'thi_luyen', label: 'Thí Luyện', description: 'Khung module Thí Luyện.',
    category: 'activity', version: '0.1.0', implementationState: 'planned', required: false,
    defaultEnabled: false, triggers: ['manual', 'worker_start'], order: 140, sourceVersion: '5.4.8', defaultConfig: {}
  },
  {
    code: 'phuc_loi',
    label: 'Phúc Lợi',
    description: 'Kiểm tra tiến độ, mở rương Phúc Lợi khi đến giờ và nhận bonus tháng trong hai ngày cuối tháng.',
    category: 'activity',
    version: '1.0.0',
    implementationState: 'ready',
    required: false,
    defaultEnabled: false,
    triggers: ['manual', 'worker_start'],
    order: 150,
    sourceVersion: '5.4.8',
    defaultConfig: {
      retrySecurityContextOnce: true,
      claimMonthlyBonus: true
    }
  },
  {
    code: 'hoang_vuc', label: 'Hoang Vực', description: 'Khung module Hoang Vực.',
    category: 'combat', version: '0.1.0', implementationState: 'planned', required: false,
    defaultEnabled: false, triggers: ['manual', 'worker_start'], order: 130, sourceVersion: '5.4.8', defaultConfig: {}
  },
  {
    code: 'bi_canh', label: 'Bí Cảnh', description: 'Khung module Bí Cảnh.',
    category: 'combat', version: '0.1.0', implementationState: 'planned', required: false,
    defaultEnabled: false, triggers: ['manual', 'worker_start'], order: 160, sourceVersion: '5.4.8', defaultConfig: {}
  },
  {
    code: 'khoang_mach', label: 'Khoáng Mạch', description: 'Khung module Khoáng Mạch và cấu hình mỏ.',
    category: 'resource', version: '0.1.0', implementationState: 'planned', required: false,
    defaultEnabled: false, triggers: ['manual', 'worker_start'], order: 170, sourceVersion: '5.4.8', defaultConfig: {}
  },
  {
    code: 'tien_duyen', label: 'Tiên Duyên', description: 'Khung module Cầu Nguyện và Tặng hoa bạn bè; không gồm Chúc Phúc hoặc nhận lì xì.',
    category: 'social', version: '0.1.0', implementationState: 'planned', required: false,
    defaultEnabled: false, triggers: ['manual', 'worker_start'], order: 180, sourceVersion: '5.4.8', defaultConfig: {}
  },
  {
    code: 'luyen_dan', label: 'Luyện Đan', description: 'Khung module Luyện Đan.',
    category: 'resource', version: '0.1.0', implementationState: 'planned', required: false,
    defaultEnabled: false, triggers: ['manual', 'worker_start'], order: 200, sourceVersion: '5.4.8', defaultConfig: {}
  },
  {
    code: 'me_cung', label: 'Mê Cung', description: 'Khung tích hợp Auto Mê Cung; chưa chuyển socket/game bridge trong Phase 07.',
    category: 'combat', version: '0.1.0', implementationState: 'planned', required: false,
    defaultEnabled: false, triggers: ['manual', 'worker_start'], order: 190, sourceVersion: '5.4.8', defaultConfig: {}
  },
  {
    code: 'do_thach', label: 'Đổ Thạch', description: 'Khung module Đổ Thạch.',
    category: 'activity', version: '0.1.0', implementationState: 'planned', required: false,
    defaultEnabled: false, triggers: ['manual', 'worker_start'], order: 610, sourceVersion: '5.4.8', defaultConfig: {}
  },
  {
    code: 'hoat_dong_ngay', label: 'Bảng Hoạt Động Ngày', description: 'Khung module theo dõi và nhận thưởng hoạt động ngày.',
    category: 'daily', version: '0.1.0', implementationState: 'planned', required: false,
    defaultEnabled: false, triggers: ['manual', 'worker_start'], order: 700, sourceVersion: '5.4.8', defaultConfig: {}
  },
  {
    code: 'vong_quay_phuc_van', label: 'Vòng Quay Phúc Vận', description: 'Khung module Vòng Quay Phúc Vận.',
    category: 'reward', version: '0.1.0', implementationState: 'planned', required: false,
    defaultEnabled: false, triggers: ['manual', 'worker_start'], order: 710, sourceVersion: '5.4.8', defaultConfig: {}
  },
  {
    code: 'promo_code', label: 'Mã Thưởng', description: 'Khung module nhập mã thưởng; không tải mã từ nguồn ngoài trong Phase 07.',
    category: 'reward', version: '0.1.0', implementationState: 'planned', required: false,
    defaultEnabled: false, triggers: ['manual', 'worker_start'], order: 720, sourceVersion: '5.4.8', defaultConfig: {}
  }
]);

class ModuleRegistry {
  constructor() {
    this.catalogVersion = MODULE_CATALOG_VERSION;
    this.manifests = new Map();
    this.handlers = new Map();
    for (const manifest of BUILTIN_CATALOG) this.registerManifest(manifest);
  }

  registerManifest(manifest) {
    validateModuleManifest(manifest);
    const code = validateModuleCode(manifest.code);
    if (this.manifests.has(code)) throw new Error(`MODULE_DUPLICATE: Module ${code} đã tồn tại.`);
    const snapshot = JSON.parse(JSON.stringify(manifest));
    this.manifests.set(code, Object.freeze(snapshot));
    return snapshot;
  }

  registerHandler(moduleCode, handler) {
    const code = validateModuleCode(moduleCode);
    const manifest = this.manifests.get(code);
    if (!manifest) throw new Error(`MODULE_NOT_FOUND: Không tìm thấy module ${code}.`);
    if (manifest.implementationState !== 'ready') {
      throw new Error(`MODULE_NOT_READY: Module ${code} chưa được đánh dấu ready.`);
    }
    if (typeof handler !== 'function') throw new Error(`MODULE_HANDLER_INVALID: Handler ${code} không hợp lệ.`);
    this.handlers.set(code, handler);
  }

  has(moduleCode) {
    return this.manifests.has(String(moduleCode || '').trim());
  }

  getManifest(moduleCode) {
    const code = validateModuleCode(moduleCode);
    return this.manifests.get(code) || null;
  }

  getHandler(moduleCode) {
    return this.handlers.get(validateModuleCode(moduleCode)) || null;
  }

  listCatalog() {
    return Array.from(this.manifests.values())
      .sort((a, b) => a.order - b.order || a.code.localeCompare(b.code))
      .map(manifest => ({
        ...JSON.parse(JSON.stringify(manifest)),
        runnable: manifest.implementationState === 'ready' && this.handlers.has(manifest.code),
        catalogVersion: this.catalogVersion
      }));
  }
}

module.exports = ModuleRegistry;
