import { App } from '@slack/bolt';
import { slackConfig } from './config';
import { registerMessageHandler } from './messageHandler';
import { startScheduler } from './scheduler';

const app = new App({
  token: slackConfig.botToken,
  signingSecret: slackConfig.signingSecret,
  socketMode: true,
  appToken: slackConfig.appToken,
});

registerMessageHandler(app);

(async () => {
  await app.start();
  console.log('積ん読ボット起動完了');
  startScheduler(app);
})();
