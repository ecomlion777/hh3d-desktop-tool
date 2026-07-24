async function runFrameworkDiagnostic(context) {
  return {
    outcome: 'success',
    summary: 'Module Framework hoạt động bình thường; không gửi request game.',
    data: {
      profileId: context.profile.id,
      trigger: context.trigger,
      websiteBaseUrl: context.websiteBaseUrl,
      timestamp: new Date().toISOString()
    }
  };
}

module.exports = runFrameworkDiagnostic;
