const { WORKER_HEALTHCHECK_URL } = require('../../worker/workerConstants.cjs');

async function runSessionCheck(context) {
  const result = await context.httpClient.fetch(context.profile, WORKER_HEALTHCHECK_URL, {
    signal: context.signal,
    timeoutMs: context.timeoutMs
  });
  const { response, durationMs } = result;

  if (response.status === 401 || response.status === 403) {
    const error = new Error(`WORKER_LOGIN_REQUIRED: HTTP ${response.status}.`);
    error.code = 'WORKER_LOGIN_REQUIRED';
    throw error;
  }
  if (!response.ok) {
    const error = new Error(`WORKER_HTTP_ERROR: HTTP ${response.status}.`);
    error.code = 'WORKER_HTTP_ERROR';
    throw error;
  }

  let publicIp;
  try {
    const payload = await response.json();
    if (payload && typeof payload.ip === 'string') publicIp = payload.ip;
  } catch {}

  return {
    outcome: 'success',
    summary: `Session/network sẵn sàng. HTTP ${response.status}, ${durationMs}ms.`,
    httpStatus: response.status,
    durationMs,
    data: publicIp ? { publicIp } : {}
  };
}

module.exports = runSessionCheck;
