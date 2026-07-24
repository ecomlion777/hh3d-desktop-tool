/**
 * Shared Worker/Module error policy.
 *
 * A single game-module failure must not terminate the whole profile Worker.
 * Only lifecycle, login/session identity, proxy-routing and missing-profile
 * failures are fatal to the Worker process.
 */

function errorText(error) {
  const code = String(error?.code || '').trim();
  const message = error instanceof Error ? error.message : String(error || '');
  return `${code} ${message}`.trim();
}

function isWorkerStopError(error) {
  return /(?:WORKER_STOP_REQUESTED|MODULE_CANCELLED)/i.test(errorText(error));
}

function isWorkerLoginError(error) {
  return /(?:WORKER_LOGIN_REQUIRED|LOGIN_REQUIRED|UNAUTHORIZED)/i.test(errorText(error));
}

function isWorkerProxyError(error) {
  return /(?:PROXY_|ERR_PROXY|ERR_TUNNEL|ERR_SOCKS|DIRECT_FALLBACK)/i.test(errorText(error));
}

function isMissingProfileError(error) {
  return /(?:WORKER_PROFILE_NOT_FOUND|MODULE_PROFILE_NOT_FOUND)/i.test(errorText(error));
}

function isFatalWorkerModuleError(error) {
  return isWorkerStopError(error)
    || isWorkerLoginError(error)
    || isWorkerProxyError(error)
    || isMissingProfileError(error);
}

module.exports = {
  errorText,
  isWorkerStopError,
  isWorkerLoginError,
  isWorkerProxyError,
  isMissingProfileError,
  isFatalWorkerModuleError
};
