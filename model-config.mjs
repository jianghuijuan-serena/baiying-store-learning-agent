import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

const directory = () => process.env.STORE_DATA_DIR ? resolve(process.env.STORE_DATA_DIR) : join(import.meta.dirname, 'data');
const configFile = () => join(directory(), 'model-settings.json');
const keyFile = () => join(directory(), '.model-settings-key');
function invalid(message) { const e = new Error(message); e.httpStatus = 400; throw e; }

export function readModelConfig() {
  if (!existsSync(configFile())) return {
    raw: process.env.LLM_API_BASE_URL || process.env.OPENAI_BASE_URL || '',
    key: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '',
    model: process.env.LLM_MODEL || process.env.OPENAI_MODEL || '',
    noAuth: false, source: 'environment'
  };
  try {
    const stored = JSON.parse(readFileSync(configFile(), 'utf8'));
    let key = '';
    if (stored.secret) {
      const decipher = createDecipheriv('aes-256-gcm', readFileSync(keyFile()), Buffer.from(stored.secret.iv, 'base64'));
      decipher.setAuthTag(Buffer.from(stored.secret.tag, 'base64'));
      key = Buffer.concat([decipher.update(Buffer.from(stored.secret.data, 'base64')), decipher.final()]).toString('utf8');
    }
    return { raw: stored.baseUrl, model: stored.model, noAuth: stored.noAuth === true, key, source: 'admin', updatedAt: stored.updatedAt };
  } catch { const e = new Error('模型配置读取失败，请检查服务器配置文件及加密钥匙'); e.httpStatus = 503; throw e; }
}

export function publicModelConfig(config = readModelConfig()) {
  return { baseUrl: config.raw, model: config.model, noAuth: config.noAuth, hasKey: Boolean(config.key),
    configured: Boolean(config.raw && config.model && (config.key || config.noAuth)), source: config.source, updatedAt: config.updatedAt || null };
}

export function candidateModelConfig(input) {
  if (typeof input.baseUrl !== 'string' || typeof input.model !== 'string') invalid('请填写服务地址和模型名称');
  const raw = input.baseUrl.trim().replace(/\/+$/, ''), model = input.model.trim();
  let url;
  try { url = new URL(raw); } catch { invalid('请输入有效的 HTTP 或 HTTPS 服务地址'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || raw.length > 2048) invalid('服务地址仅支持 HTTP/HTTPS，不能含账号、查询参数或锚点');
  if (!model || model.length > 200 || /[\r\n]/.test(model)) invalid('请填写有效的模型名称（不超过 200 字）');
  if (input.apiKey !== undefined && typeof input.apiKey !== 'string') invalid('密钥格式无效');
  const noAuth = input.noAuth === true;
  let key = (input.apiKey || '').trim();
  if (key.length > 4096 || /[\r\n]/.test(key)) invalid('密钥格式无效');
  if (!key && !noAuth) {
    const current = readModelConfig();
    if (current.raw.trim().replace(/\/+$/, '') === raw) key = current.key;
  }
  if (noAuth) key = '';
  if (!key && !noAuth) invalid('请填写 API 密钥；更换服务地址后需重新填写。本地免鉴权服务可勾选“不需要密钥”');
  return { raw, model, key, noAuth, source: 'admin' };
}

export function saveModelConfig(input) {
  const config = candidateModelConfig(input);
  mkdirSync(directory(), { recursive: true });
  let secret = null;
  if (config.key) {
    if (!existsSync(keyFile())) writeFileSync(keyFile(), randomBytes(32), { mode: 0o600, flag: 'wx' });
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', readFileSync(keyFile()), iv);
    secret = { iv: iv.toString('base64'), data: Buffer.concat([cipher.update(config.key, 'utf8'), cipher.final()]).toString('base64'), tag: cipher.getAuthTag().toString('base64') };
  }
  const updatedAt = new Date().toISOString();
  const temporary = configFile() + '.tmp';
  writeFileSync(temporary, JSON.stringify({ baseUrl: config.raw, model: config.model, noAuth: config.noAuth, secret, updatedAt }), { mode: 0o600 });
  renameSync(temporary, configFile());
  return publicModelConfig({ ...config, updatedAt });
}
