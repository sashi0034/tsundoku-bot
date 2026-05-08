import * as https from 'https';
import { WebClient } from '@slack/web-api';

const SLACK_URL_RE = /<(https?:\/\/[^|>\s]+)(?:\|[^>]*)?>/g;

export function extractUrls(text: string): string[] {
  const urls: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = SLACK_URL_RE.exec(text)) !== null) {
    urls.push(m[1]);
  }
  return [...new Set(urls)];
}

// ---------------------------------------------------------------------------
// Canvas HTML 取得 (Quip 形式)
// ---------------------------------------------------------------------------

async function fetchCanvasHtml(client: WebClient, canvasId: string): Promise<string> {
  const info = await client.files.info({ file: canvasId });
  const file = info.file as Record<string, unknown> | undefined;
  const url = (file?.url_private ?? file?.url_private_download) as string | undefined;
  if (!url) throw new Error('[canvas] url_private が取得できませんでした');
  const token = (client as unknown as { token: string }).token;
  return fetchWithToken(url, token);
}

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

// ---------------------------------------------------------------------------
// HTML パース
// Canvas は Quip HTML 形式。URL ごとに独立した <ul> ブロックがある。
// チェック済み: <li class='checked'>, URL は <lnk href="..."> タグ内。
// ---------------------------------------------------------------------------

interface UrlBlock {
  ulId: string;
  liId: string;
  url: string;
  checked: boolean;
}

function parseUrlBlocks(html: string): UrlBlock[] {
  const blocks: UrlBlock[] = [];
  const ulRe = /<ul\b[^>]*\bid='([^']+)'[^>]*>([\s\S]*?)<\/ul>/g;
  let m: RegExpExecArray | null;

  while ((m = ulRe.exec(html)) !== null) {
    const ulId = m[1];
    const content = m[2];
    const urlMatch = content.match(/\bhref="(https?:\/\/[^"]+)"/);
    if (!urlMatch) continue;
    const liIdMatch = content.match(/<li\b[^>]*\bid='([^']+)'/);
    blocks.push({
      ulId,
      liId: liIdMatch ? liIdMatch[1] : ulId,
      url: urlMatch[1],
      checked: /\bclass='checked'/.test(content),
    });
  }

  return blocks;
}

function parseFirstUrlUlId(html: string): string | null {
  // URL を含む最初の <ul> の id を返す
  const m = html.match(/<ul\b[^>]*\bid='([^']+)'[^>]*>[\s\S]*?\bhref="https?:\/\//);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// Canvas への URL 追加（先頭に挿入）
// ---------------------------------------------------------------------------

export async function addUrlsToCanvas(
  client: WebClient,
  canvasId: string,
  urls: string[],
): Promise<void> {
  const markdown = urls.map((url) => `- [ ] ${url}`).join('\n') + '\n';

  let firstUlId: string | null = null;
  try {
    const html = await fetchCanvasHtml(client, canvasId);
    firstUlId = parseFirstUrlUlId(html);
  } catch {
    // files:read スコープ未付与などの場合は末尾挿入にフォールバック
  }

  await client.apiCall('canvases.edit', {
    canvas_id: canvasId,
    changes: [
      firstUlId
        ? {
            operation: 'insert_before',
            section_id: firstUlId,
            document_content: { type: 'markdown', markdown },
          }
        : { operation: 'insert_at_end', document_content: { type: 'markdown', markdown } },
    ],
  });
}

// ---------------------------------------------------------------------------
// チェック済みアイテムの取得と削除
// ---------------------------------------------------------------------------

export async function processCheckedItems(
  client: WebClient,
  canvasId: string,
): Promise<string[]> {
  const html = await fetchCanvasHtml(client, canvasId);
  const checked = parseUrlBlocks(html).filter((b) => b.checked);
  if (checked.length === 0) return [];

  for (const block of checked) {
    await client.apiCall('canvases.edit', {
      canvas_id: canvasId,
      changes: [{ operation: 'delete', section_id: block.liId }],
    });
  }

  return checked.map((b) => b.url);
}
