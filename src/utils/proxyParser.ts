import type { ProxyImportItem, ProxyProtocol } from '../types';

export interface ParsedProxyLine {
  sourceLine: number;
  rawLine: string;
  valid: boolean;
  error?: string;
  item?: ProxyImportItem;
}

const SUPPORTED_PROTOCOLS: ProxyProtocol[] = ['http', 'https', 'socks4', 'socks5'];

function isValidPort(value: number) {
  return Number.isInteger(value) && value >= 1 && value <= 65535;
}

function parseHostPort(value: string): { host: string; port: number } | null {
  const lastColon = value.lastIndexOf(':');
  if (lastColon <= 0) return null;
  const host = value.slice(0, lastColon).trim();
  const port = Number(value.slice(lastColon + 1));
  if (!host || host.includes(':') || !isValidPort(port)) return null;
  return { host, port };
}

export function parseProxyLine(rawLine: string, sourceLine = 1): ParsedProxyLine {
  const line = rawLine.trim();
  if (!line || line.startsWith('#') || line.startsWith('//')) {
    return { sourceLine, rawLine, valid: false, error: 'Dòng trống hoặc chú thích.' };
  }

  let protocol: ProxyProtocol = 'http';
  let host = '';
  let port = 0;
  let username = '';
  let password = '';

  try {
    if (line.includes('://')) {
      const parsed = new URL(line);
      const proto = parsed.protocol.replace(':', '').toLowerCase() as ProxyProtocol;
      if (!SUPPORTED_PROTOCOLS.includes(proto)) {
        throw new Error(`Protocol ${proto} không được hỗ trợ.`);
      }
      protocol = proto;
      host = parsed.hostname;
      port = Number(parsed.port);
      username = decodeURIComponent(parsed.username || '');
      password = decodeURIComponent(parsed.password || '');
    } else if (line.includes('@')) {
      const atIndex = line.lastIndexOf('@');
      const credentialPart = line.slice(0, atIndex);
      const endpointPart = line.slice(atIndex + 1);
      const endpoint = parseHostPort(endpointPart);
      if (!endpoint) throw new Error('Endpoint host:port không hợp lệ.');
      host = endpoint.host;
      port = endpoint.port;
      const colonIndex = credentialPart.indexOf(':');
      if (colonIndex < 1) throw new Error('Credential phải có dạng username:password.');
      username = credentialPart.slice(0, colonIndex);
      password = credentialPart.slice(colonIndex + 1);
    } else {
      const parts = line.split(':');
      if (parts.length === 2) {
        host = parts[0].trim();
        port = Number(parts[1]);
      } else if (parts.length >= 4) {
        host = parts[0].trim();
        port = Number(parts[1]);
        username = parts[2];
        password = parts.slice(3).join(':');
      } else {
        throw new Error('Định dạng không được hỗ trợ.');
      }
    }

    if (!host || host.includes(':') || host.includes('/') || /\s/.test(host)) {
      throw new Error('Host không hợp lệ hoặc IPv6 chưa được hỗ trợ.');
    }
    if (!isValidPort(port)) throw new Error('Port phải từ 1 đến 65535.');
    if ((username && !password) || (!username && password)) {
      throw new Error('Credential phải có đủ username và password.');
    }

    const authRequired = Boolean(username && password);
    const item: ProxyImportItem = {
      sourceLine,
      name: `Proxy Line ${sourceLine}`,
      protocol,
      host,
      port,
      enabled: true,
      authRequired,
      username: username || undefined,
      password: password || undefined,
      notes: ''
    };

    return { sourceLine, rawLine, valid: true, item };
  } catch (error) {
    return {
      sourceLine,
      rawLine,
      valid: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export function parseMultiLineProxies(text: string): ParsedProxyLine[] {
  return text
    .split(/\r?\n/)
    .slice(0, 500)
    .map((line, index) => parseProxyLine(line, index + 1))
    .filter(result => result.rawLine.trim().length > 0 && !result.rawLine.trim().startsWith('#'));
}
