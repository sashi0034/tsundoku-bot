import { WebClient } from '@slack/web-api';

// Slack メッセージ内のURL形式: <https://...> or <https://...|表示テキスト>
const SLACK_URL_RE = /<(https?:\/\/[^|>\s]+)(?:\|[^>]*)?>/g;

// Canvas 内のチェックボックス行
const CHECKED_LINE_RE = /^-\s*\[x\]\s*(https?:\/\/\S+)/i;
const ANY_CHECKBOX_LINE_RE = /^-\s*\[[ x]\]/i;

export function extractUrls(text: string): string[] {
  const urls: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = SLACK_URL_RE.exec(text)) !== null) {
    urls.push(m[1]);
  }
  return [...new Set(urls)];
}

export async function addUrlsToCanvas(
  client: WebClient,
  canvasId: string,
  urls: string[],
): Promise<void> {
  const markdown = urls.map((url) => `- [ ] ${url}`).join('\n') + '\n';

  await client.apiCall('canvases.edit', {
    canvas_id: canvasId,
    changes: [
      {
        operation: 'insert_at_end',
        document_content: { type: 'markdown', markdown },
      },
    ],
  });
}

interface SectionResult {
  ok: boolean;
  sections?: Array<{ id: string; content?: string }>;
}

export async function processCheckedItems(
  client: WebClient,
  canvasId: string,
): Promise<string[]> {
  // チェック済み([x])を含むセクションを検索
  const result = (await client.apiCall('canvases.sections.lookup', {
    canvas_id: canvasId,
    criteria: { contains_text: '[x]' },
  })) as SectionResult;

  const sections = result.sections ?? [];
  if (sections.length === 0) return [];

  const allCheckedUrls: string[] = [];

  for (const section of sections) {
    const content = section.content ?? '';
    const lines = content.split('\n').filter((l) => l.trim());

    const checkedUrls: string[] = [];
    const remainingLines: string[] = [];

    for (const line of lines) {
      const checkedMatch = line.match(CHECKED_LINE_RE);
      if (checkedMatch) {
        checkedUrls.push(checkedMatch[1]);
      } else {
        remainingLines.push(line);
      }
    }

    if (checkedUrls.length === 0) continue;

    allCheckedUrls.push(...checkedUrls);

    if (remainingLines.filter((l) => ANY_CHECKBOX_LINE_RE.test(l)).length === 0) {
      // チェックボックス行が残らなければセクションを削除
      await client.apiCall('canvases.edit', {
        canvas_id: canvasId,
        changes: [{ operation: 'delete', section_id: section.id }],
      });
    } else {
      // 未チェック行だけで置換
      await client.apiCall('canvases.edit', {
        canvas_id: canvasId,
        changes: [
          {
            operation: 'replace',
            section_id: section.id,
            document_content: {
              type: 'markdown',
              markdown: remainingLines.join('\n') + '\n',
            },
          },
        ],
      });
    }
  }

  return allCheckedUrls;
}
