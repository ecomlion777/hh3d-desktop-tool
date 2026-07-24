/**
 * HH3D Desktop Tool - Runtime website/domain configuration service.
 * Reads persisted General Settings on demand so Mini Browser, proxy resolution,
 * and future game modules always use the latest configured domain.
 */

const {
  DEFAULT_WEBSITE_BASE_URL,
  DEFAULT_WEBSITE_ALLOWED_HOSTS,
  normalizeWebsiteSettings,
  isAllowedWebsiteUrl,
  buildWebsiteUrl
} = require('./websiteValidation.cjs');

class WebsiteConfigService {
  constructor(settingsRepository) {
    this.settingsRepository = settingsRepository;
  }

  getConfig() {
    const settings = this.settingsRepository?.getGeneralSettings?.() || {};
    const normalized = normalizeWebsiteSettings(settings, {
      websiteBaseUrl: DEFAULT_WEBSITE_BASE_URL,
      websiteAllowedHosts: DEFAULT_WEBSITE_ALLOWED_HOSTS
    });

    return {
      baseUrl: normalized.websiteBaseUrl,
      allowedHosts: [...normalized.websiteAllowedHosts]
    };
  }

  getTargetUrl() {
    return this.getConfig().baseUrl;
  }

  getAllowedHosts() {
    return this.getConfig().allowedHosts;
  }

  isAllowedUrl(urlString) {
    return isAllowedWebsiteUrl(urlString, this.getAllowedHosts());
  }

  buildUrl(relativePath = '/') {
    return buildWebsiteUrl(this.getTargetUrl(), relativePath);
  }
}

module.exports = WebsiteConfigService;
