const assert = require('assert/strict');
const path = require('path');

const ProfileWorkerManager = require(
  path.resolve(__dirname, '..', 'electron', 'worker', 'ProfileWorkerManager.cjs')
);

async function main() {
  const profile = {
    id: 'p1',
    uid: 'U1',
    displayName: 'Profile 1',
    status: 'running',
    currentActivity: 'Phúc Lợi: Tiến độ 1/4, chờ 00:00.',
    nextRunAt: new Date(Date.now() - 50).toISOString(),
    nextRunTime: 'Theo lịch module'
  };

  let scheduledNextRunAt = profile.nextRunAt;
  let runCount = 0;
  const updates = [];
  const controller = new AbortController();

  const profileRepo = {
    async getProfileById(profileId) {
      return profileId === profile.id ? { ...profile } : null;
    },
    async updateProfile(profileId, changes) {
      assert.equal(profileId, profile.id);
      Object.assign(profile, changes);
      updates.push({ ...changes });
      return { ...profile };
    },
    async listProfiles() {
      return [{ ...profile }];
    }
  };

  const moduleSettingsRepository = {
    async listEnabledRunnable(profileId, trigger) {
      assert.equal(profileId, profile.id);
      assert.equal(trigger, 'worker_start');
      return [{
        profileId,
        moduleCode: 'phuc_loi',
        enabled: true,
        nextRunAt: scheduledNextRunAt,
        manifest: {
          code: 'phuc_loi',
          label: 'Phúc Lợi',
          order: 210,
          runnable: true,
          triggers: ['worker_start']
        }
      }];
    }
  };

  const moduleRunner = {
    settingsRepository: moduleSettingsRepository,
    async runModule(profileId, moduleCode, options) {
      assert.equal(profileId, profile.id);
      assert.equal(moduleCode, 'phuc_loi');
      assert.equal(options.trigger, 'worker_start');
      assert.equal(options.force, true);
      runCount += 1;
      scheduledNextRunAt = new Date(Date.now() + 60_000).toISOString();
      setTimeout(() => controller.abort(new Error('WORKER_STOP_REQUESTED')), 25);
      return {
        state: 'success',
        outcome: 'opened',
        summary: 'Phúc Lợi: Mở rương 2 thành công. Tiến độ 2/4, chờ 01:00.',
        httpStatus: 200,
        durationMs: 12,
        nextRunAt: scheduledNextRunAt,
        data: { chestLevel: 2 }
      };
    },
    cancelProfile() {}
  };

  const manager = new ProfileWorkerManager({
    profileRepo,
    moduleRunner,
    moduleSettingsRepository,
    settingsRepository: {
      getWorkerSettings() {
        return {
          maxConcurrency: 40,
          requestTimeoutMs: 5000,
          heartbeatIntervalMs: 20
        };
      }
    },
    logRepository: {
      async append(entry) { return entry; },
      async listLogs() { return []; }
    },
    batchRepository: {
      async list() { return []; },
      async update() { return null; }
    },
    broadcastCallback() {}
  });

  let stoppedError;
  try {
    await manager.runScheduledModuleLoop(
      profile.id,
      { controller, moduleCodes: ['phuc_loi'] },
      {
        requestTimeoutMs: 5000,
        heartbeatIntervalMs: 20
      }
    );
  } catch (error) {
    stoppedError = error;
  }

  assert(stoppedError);
  assert.match(stoppedError.message, /WORKER_STOP_REQUESTED/);
  assert.equal(runCount, 1);
  assert.equal(profile.currentActivity, 'Phúc Lợi: Mở rương 2 thành công. Tiến độ 2/4, chờ 01:00.');
  assert.equal(profile.nextRunAt, scheduledNextRunAt);
  assert.equal(profile.nextRunTime, 'Theo lịch module');
  assert(updates.some(item => item.currentActivity === 'Phúc Lợi: Đang thực thi theo lịch'));
  assert(updates.some(item => item.nextRunAt === scheduledNextRunAt));

  console.log(JSON.stringify({
    status: 'PASS',
    scheduledModule: 'phuc_loi',
    automaticRerun: true,
    nextRunAtPersisted: true,
    liveCountdownSource: 'profile.nextRunAt',
    runCount
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
