import * as dotenv from 'dotenv';
dotenv.config();

import { WebClient } from '@slack/web-api';
import * as https from 'https';

function fetchWithToken(url: string, token: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { Authorization: `Bearer ${token}` } }, (res) => {
      let buf = '';
      res.on('data', (c: string) => (buf += c));
      res.on('end', () => resolve(buf));
    });
    req.on('error', reject);
  });
}

function parseUrlBlocks(html: string) {
  const blocks: { ulId: string; liId: string; url: string; checked: boolean }[] = [];
  const ulRe = /<ul\b[^>]*\bid='([^']+)'[^>]*>([\s\S]*?)<\/ul>/g;
  let m: RegExpExecArray | null;
  while ((m = ulRe.exec(html)) !== null) {
    const content = m[2];
    const urlMatch = content.match(/\bhref="(https?:\/\/[^"]+)"/);
    if (!urlMatch) continue;
    const liIdMatch = content.match(/<li\b[^>]*\bid='([^']+)'/);
    blocks.push({
      ulId: m[1],
      liId: liIdMatch ? liIdMatch[1] : m[1],
      url: urlMatch[1],
      checked: /\bclass='checked'/.test(content),
    });
  }
  return blocks;
}

async function main() {
  const token = process.env.SLACK_BOT_TOKEN!;
  const client = new WebClient(token);
  const canvasId = process.env.CANVAS_ID!;

  const info = await client.files.info({ file: canvasId });
  const file = info.file as Record<string, unknown>;
  const url = (file.url_private ?? file.url_private_download) as string;

  const html = await fetchWithToken(url, token);
  const blocks = parseUrlBlocks(html);

  console.log('=== URL ブロック一覧 ===');
  for (const b of blocks) {
    console.log(`[${b.checked ? 'x' : ' '}] ${b.url}`);
    console.log(`    liId: ${b.liId}`);
    console.log(`    ulId: ${b.ulId}`);
  }
}

main().catch(console.error);
