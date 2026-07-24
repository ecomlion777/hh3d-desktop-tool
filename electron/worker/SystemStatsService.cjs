/**
 * HH3D Desktop Tool - Lightweight real system stats broadcaster.
 */

const os = require('os');
const { WORKER_IPC_CHANNELS } = require('./workerConstants.cjs');

class SystemStatsService {
  constructor(options) {
    this.workerManager = options.workerManager;
    this.broadcastCallback = options.broadcastCallback || (() => {});
    this.timer = null;
    this.previousCpu = null;
    this.lastStats = {
      cpuUsage: 0,
      ramUsageGb: 0,
      ramTotalGb: Number((os.totalmem() / 1024 / 1024 / 1024).toFixed(1)),
      activeConnections: 0,
      networkSpeedMbps: 0
    };
  }

  sampleCpu() {
    const cpus = os.cpus();
    const totals = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((sum, value) => sum + value, 0);
      acc.idle += cpu.times.idle;
      acc.total += total;
      return acc;
    }, { idle: 0, total: 0 });

    if (!this.previousCpu) {
      this.previousCpu = totals;
      return 0;
    }

    const idleDelta = totals.idle - this.previousCpu.idle;
    const totalDelta = totals.total - this.previousCpu.total;
    this.previousCpu = totals;
    if (totalDelta <= 0) return this.lastStats.cpuUsage || 0;
    return Math.min(100, Math.max(0, Math.round((1 - idleDelta / totalDelta) * 100)));
  }

  getStats() {
    const ramTotal = os.totalmem();
    const ramUsed = ramTotal - os.freemem();
    const summary = this.workerManager.getSummary();
    this.lastStats = {
      cpuUsage: this.sampleCpu(),
      ramUsageGb: Number((ramUsed / 1024 / 1024 / 1024).toFixed(1)),
      ramTotalGb: Number((ramTotal / 1024 / 1024 / 1024).toFixed(1)),
      activeConnections: summary.activeCount,
      networkSpeedMbps: 0
    };
    return { ...this.lastStats };
  }

  start(intervalMs = 2000) {
    if (this.timer) return;
    this.getStats();
    this.timer = setInterval(() => {
      const stats = this.getStats();
      try {
        this.broadcastCallback(WORKER_IPC_CHANNELS.STATS_CHANGED, stats);
      } catch (error) {
        console.error('[SystemStatsService] Broadcast failed:', error);
      }
    }, intervalMs);
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }
}

module.exports = SystemStatsService;
