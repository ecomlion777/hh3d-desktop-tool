const assert = require('assert');
const path = require('path');

const base = path.resolve(__dirname, '..', 'electron');
const WorkerSettingsRepository = require(`${base}/worker/WorkerSettingsRepository.cjs`);
const WebsiteConfigService = require(`${base}/website/WebsiteConfigService.cjs`);
const {
  normalizeWebsiteBaseUrl,
  normalizeWebsiteAllowedHosts,
  isAllowedWebsiteUrl,
  buildWebsiteUrl
} = require(`${base}/website/websiteValidation.cjs`);

class FakeDatabase {
  constructor() {
    this.data = {
      schemaVersion: 3,
      profiles: [],
      groups: [],
      proxies: [],
      batches: [],
      logs: [],
      workerSettings: {},
      activityConfig: {},
      generalSettings: {}
    };
  }

  getData() {
    return this.data;
  }

  async transaction(mutator) {
    const workingData = JSON.parse(JSON.stringify(this.data));
    const result = await mutator(workingData);
    this.data = JSON.parse(JSON.stringify(result.nextData));
    return result.result;
  }
}

async function main() {
  assert.equal(normalizeWebsiteBaseUrl('hoathinh3d.com'), 'https://hoathinh3d.com/');
  assert.equal(normalizeWebsiteBaseUrl('https://HOATHINH3D.ST/path?q=1'), 'https://hoathinh3d.st/');
  assert.deepEqual(
    normalizeWebsiteAllowedHosts(['hoathinh3d.com', 'hoathinh3d.st'], 'https://hoathinh3d.com/'),
    ['hoathinh3d.com', 'hoathinh3d.st']
  );
  assert.equal(isAllowedWebsiteUrl('https://sub.hoathinh3d.com/path', ['hoathinh3d.com']), true);
  assert.equal(isAllowedWebsiteUrl('https://evilhoathinh3d.com/path', ['hoathinh3d.com']), false);
  assert.equal(isAllowedWebsiteUrl('http://hoathinh3d.com/', ['hoathinh3d.com']), false);
  assert.equal(buildWebsiteUrl('hoathinh3d.st', '/wp-json/hh3d/v1/action'), 'https://hoathinh3d.st/wp-json/hh3d/v1/action');

  const db = new FakeDatabase();
  const settingsRepository = new WorkerSettingsRepository(db);
  const websiteConfig = new WebsiteConfigService(settingsRepository);

  const defaults = settingsRepository.getGeneralSettings();
  assert.equal(defaults.websiteBaseUrl, 'https://hoathinh3d.co/');
  assert(defaults.websiteAllowedHosts.includes('hoathinh3d.com'));

  const saved = await settingsRepository.saveGeneralSettings({
    ...defaults,
    websiteBaseUrl: 'hoathinh3d.com',
    websiteAllowedHosts: ['hoathinh3d.com', 'hoathinh3d.st']
  });

  assert.equal(saved.websiteBaseUrl, 'https://hoathinh3d.com/');
  assert.deepEqual(saved.websiteAllowedHosts, ['hoathinh3d.com', 'hoathinh3d.st']);
  assert.equal(websiteConfig.getTargetUrl(), 'https://hoathinh3d.com/');
  assert.equal(websiteConfig.isAllowedUrl('https://www.hoathinh3d.com/'), true);
  assert.equal(websiteConfig.isAllowedUrl('https://hoathinh3d.co/'), false);
  assert.equal(websiteConfig.buildUrl('/login'), 'https://hoathinh3d.com/login');

  await assert.rejects(
    () => settingsRepository.saveGeneralSettings({ ...saved, websiteBaseUrl: 'http://hoathinh3d.com' }),
    /WEBSITE_HTTPS_REQUIRED/
  );

  await assert.rejects(
    () => settingsRepository.saveGeneralSettings({ ...saved, websiteBaseUrl: 'https://user:pass@hoathinh3d.com' }),
    /WEBSITE_CREDENTIALS_NOT_ALLOWED/
  );

  console.log(JSON.stringify({
    status: 'PASS',
    websiteBaseUrl: websiteConfig.getTargetUrl(),
    allowedHosts: websiteConfig.getAllowedHosts(),
    dynamicDomain: true,
    httpsOnly: true,
    schemaVersion: db.getData().schemaVersion
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
