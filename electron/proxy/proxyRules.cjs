/**
 * Build Electron ProxyConfig from validated public proxy data.
 */

const {
  normalizeProtocol,
  normalizeHost,
  normalizePort
} = require('./proxyValidation.cjs');

function buildProxyRules(proxy) {
  if (!proxy) {
    return { mode: 'direct' };
  }

  const protocol = normalizeProtocol(proxy.protocol);
  const host = normalizeHost(proxy.host);
  const port = normalizePort(proxy.port);

  return {
    mode: 'fixed_servers',
    proxyRules: `${protocol}://${host}:${port}`,
    proxyBypassRules: '<local>'
  };
}

module.exports = { buildProxyRules };
