import { App } from '@slack/bolt';
import { canvasId, watchChannelIds } from './config';
import { extractUrls, addUrlsToCanvas, isSlackMessageUrl, resolveSlackMessageUrls } from './canvasService';

export function registerMessageHandler(app: App): void {
  // app.message() は bot_message を配信しないため app.event() を使用
  app.event('message', async ({ event, client, logger }) => {
    // 編集・削除・参加脱退等のサブタイプは無視。bot_message は通す
    const subtype = 'subtype' in event ? event.subtype : undefined;
    if (subtype && subtype !== 'bot_message') return;

    const text = 'text' in event ? (event.text ?? '') : '';
    if (!text) return;

    // 監視チャンネルが指定されている場合はフィルタリング
    if (watchChannelIds.length > 0) {
      const channel = 'channel' in event ? (event.channel as string) : '';
      if (!watchChannelIds.includes(channel)) return;
    }

    const rawUrls = extractUrls(text);
    if (rawUrls.length === 0) return;

    // Slack メッセージURLは参照先のURLに置き換える
    const resolvedUrls: string[] = [];
    for (const url of rawUrls) {
      if (isSlackMessageUrl(url)) {
        logger.info(`Slack メッセージURL を解決: ${url}`);
        try {
          const inner = await resolveSlackMessageUrls(client, url);
          logger.info(`解決結果: ${inner.length > 0 ? inner.join(', ') : '(URLなし)'}`);
          resolvedUrls.push(...inner);
        } catch (error) {
          logger.error(`Slack メッセージURL の解決に失敗: ${url}`, error);
        }
      } else {
        resolvedUrls.push(url);
      }
    }

    const urls = [...new Set(resolvedUrls)];
    if (urls.length === 0) return;

    logger.info(`URL ${urls.length}件を検出、Canvasに追加します: ${urls.join(', ')}`);

    try {
      await addUrlsToCanvas(client, canvasId, urls);
      logger.info('Canvas への追加完了');

      const channel = 'channel' in event ? (event.channel as string) : '';
      const ts = 'ts' in event ? (event.ts as string) : '';
      if (channel && ts) {
        await client.reactions.add({ channel, name: 'new_moon_with_face', timestamp: ts });
      }
    } catch (error) {
      logger.error('Canvas への追加に失敗:', error);
    }
  });
}
