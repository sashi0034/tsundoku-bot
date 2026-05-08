import { App } from '@slack/bolt';
import { canvasId, watchChannelIds } from './config';
import { extractUrls, addUrlsToCanvas } from './canvasService';

export function registerMessageHandler(app: App): void {
  app.message(async ({ message, client, logger }) => {
    // bot_message や message_changed などのサブタイプは無視
    if ('subtype' in message && message.subtype) return;

    const text = 'text' in message ? (message.text ?? '') : '';
    if (!text) return;

    // 監視チャンネルが指定されている場合はフィルタリング
    if (watchChannelIds.length > 0) {
      const channel = 'channel' in message ? (message.channel as string) : '';
      if (!watchChannelIds.includes(channel)) return;
    }

    const urls = extractUrls(text);
    if (urls.length === 0) return;

    logger.info(`URL ${urls.length}件を検出、Canvasに追加します: ${urls.join(', ')}`);

    try {
      await addUrlsToCanvas(client, canvasId, urls);
      logger.info('Canvas への追加完了');
    } catch (error) {
      logger.error('Canvas への追加に失敗:', error);
    }
  });
}
