/**
 * Proxy Line Parser Utility
 * Parses various proxy format strings into standardized Proxy structures.
 * 
 * Supported Formats:
 * 1. ip:port (e.g. 103.142.10.1:8080)
 * 2. ip:port:user:pass (e.g. 103.142.10.1:8080:usr1:pwd1)
 * 3. user:pass@ip:port (e.g. usr1:pwd1@103.142.10.1:8080)
 * 4. http://user:pass@ip:port (e.g. http://usr1:pwd1@103.142.10.1:8080)
 * 5. socks5://user:pass@ip:port (e.g. socks5://usr1:pwd1@103.142.10.1:8080)
 * As well as socks4://, https://, http://ip:port, socks5://ip:port
 */

export interface ParsedProxy {
  protocol: 'HTTP' | 'HTTPS' | 'SOCKS5' | 'SOCKS4';
  host: string;
  port: number;
  username?: string;
  password?: string;
  ipPort: string;
  rawLine: string;
}

export function parseProxyLine(rawLine: string): ParsedProxy | null {
  if (!rawLine) return null;
  let line = rawLine.trim();
  if (!line || line.startsWith('#') || line.startsWith('//')) return null;

  const originalRaw = line;
  let protocol: 'HTTP' | 'HTTPS' | 'SOCKS5' | 'SOCKS4' = 'SOCKS5'; // Default protocol

  // 1. Strip protocol prefix if present
  if (/^socks5:\/\//i.test(line)) {
    protocol = 'SOCKS5';
    line = line.replace(/^socks5:\/\//i, '');
  } else if (/^socks4:\/\//i.test(line)) {
    protocol = 'SOCKS4';
    line = line.replace(/^socks4:\/\//i, '');
  } else if (/^https:\/\//i.test(line)) {
    protocol = 'HTTPS';
    line = line.replace(/^https:\/\//i, '');
  } else if (/^http:\/\//i.test(line)) {
    protocol = 'HTTP';
    line = line.replace(/^http:\/\//i, '');
  }

  let username = '';
  let password = '';
  let host = '';
  let port = 8080;

  // Case A: user:pass@ip:port or user@ip:port
  if (line.includes('@')) {
    const parts = line.split('@');
    const userPassPart = parts[0];
    const hostPortPart = parts.slice(1).join('@');

    if (userPassPart.includes(':')) {
      const up = userPassPart.split(':');
      username = up[0];
      password = up.slice(1).join(':');
    } else {
      username = userPassPart;
    }

    if (hostPortPart.includes(':')) {
      const hp = hostPortPart.split(':');
      host = hp[0];
      port = parseInt(hp[1], 10) || 8080;
    } else {
      host = hostPortPart;
    }
  } else {
    // Case B: Colon separated parts
    const parts = line.split(':');
    if (parts.length >= 4) {
      // ip:port:user:pass
      host = parts[0];
      port = parseInt(parts[1], 10) || 8080;
      username = parts[2];
      password = parts.slice(3).join(':');
    } else if (parts.length === 2) {
      // ip:port
      host = parts[0];
      port = parseInt(parts[1], 10) || 8080;
    } else if (parts.length === 3) {
      // ip:port:user
      host = parts[0];
      port = parseInt(parts[1], 10) || 8080;
      username = parts[2];
    } else {
      return null;
    }
  }

  host = host.trim();
  if (!host || isNaN(port)) return null;

  return {
    protocol,
    host,
    port,
    username: username.trim() || undefined,
    password: password.trim() || undefined,
    ipPort: `${host}:${port}`,
    rawLine: originalRaw
  };
}

export function parseMultiLineProxies(text: string): ParsedProxy[] {
  const lines = text.split('\n');
  const results: ParsedProxy[] = [];
  for (const rawLine of lines) {
    const parsed = parseProxyLine(rawLine);
    if (parsed) {
      results.push(parsed);
    }
  }
  return results;
}
