import { App } from '@slack/bolt';
import { appConfig, canvasId, postChannelId } from './config';
import { processCheckedItems, fetchPageTitle } from './canvasService';

export function startScheduler(app: App): void {
  const intervalMs = appConfig.scheduleIntervalMinutes * 60 * 1000;

  console.log(
    `[scheduler] ${appConfig.scheduleIntervalMinutes}分ごとにCanvasをチェックします`,
  );

  // 起動直後に一度実行してから定期実行
  void runProcess(app);
  setInterval(() => void runProcess(app), intervalMs);
}

async function runProcess(app: App): Promise<void> {
  app.logger.info('[scheduler] Canvas チェック開始');

  try {
    const checkedUrls = await processCheckedItems(app.client, canvasId);

    if (checkedUrls.length === 0) {
      app.logger.info('[scheduler] チェック済みアイテムなし');
      return;
    }

    app.logger.info(`[scheduler] ${checkedUrls.length}件をスレッドに投稿します`);

    const titles = await Promise.all(checkedUrls.map((url) => fetchPageTitle(url)));
    const text = checkedUrls
      .map((url, i) => (titles[i] ? `${titles[i]}\n${url}` : url))
      .join('\n\n');

    await app.client.chat.postMessage({
      channel: postChannelId,
      text,
      unfurl_links: true,
      unfurl_media: true,
    });

    app.logger.info('[scheduler] スレッド投稿完了');
  } catch (error) {
    app.logger.error('[scheduler] エラー:', error);
  }
}
