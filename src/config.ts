import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

interface AppConfig {
  scheduleIntervalMinutes: number;
}

function loadAppConfig(): AppConfig {
  const configPath = path.resolve(process.cwd(), 'config.json');
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    return {
      scheduleIntervalMinutes: parsed.scheduleIntervalMinutes ?? 30,
    };
  } catch {
    console.warn('[config] config.json not found or invalid, using defaults');
    return { scheduleIntervalMinutes: 30 };
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const appConfig = loadAppConfig();

export const slackConfig = {
  botToken: requireEnv('SLACK_BOT_TOKEN'),
  appToken: requireEnv('SLACK_APP_TOKEN'),
};

export const canvasId = requireEnv('CANVAS_ID');
export const postChannelId = requireEnv('POST_CHANNEL_ID');

export const watchChannelIds: string[] = (process.env.WATCH_CHANNEL_IDS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
