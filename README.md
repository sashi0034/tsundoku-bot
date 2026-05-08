# tsundoku-bot

Slack に投稿された URL を Slack Canvas に積ん読リストとして追加し、Canvas 上でチェック済みにした URL を定期的に指定スレッドへ投稿する bot です。

## 必要なもの

- Node.js 20 系
- Slack App
- URL を保存する Slack Canvas
- チェック済み URL を投稿する Slack スレッド

## Slack App の設定

この bot は Socket Mode で起動するため、公開 URL や Request URL は不要です。

### Socket Mode

Slack App の Socket Mode を有効化し、App-Level Token を作成してください。

App-Level Token に必要な scope:

- `connections:write`: Socket Mode の WebSocket 接続に必要

### Bot Token Scopes

OAuth & Permissions の Bot Token Scopes に以下を追加してください。

- `channels:history`: public channel のメッセージイベントを受け取る
- `groups:history`: private channel のメッセージイベントを受け取る
- `chat:write`: チェック済み URL を指定スレッドへ投稿する
- `canvases:read`: Canvas 内のチェック済み項目を検索する
- `canvases:write`: Canvas に URL を追加し、チェック済み項目を削除または置換する

private channel を監視・投稿対象にする場合は、bot をその channel に追加してください。投稿先 channel でも bot が投稿できる必要があります。

### Event Subscriptions

Event Subscriptions を有効化し、Subscribe to bot events に必要なメッセージイベントを追加してください。

- public channel を監視する場合: `message.channels`
- private channel を監視する場合: `message.groups`

### App Manifest 例

Slack App 作成時に App Manifest を使う場合は、以下をベースに設定できます。

```yaml
display_information:
  name: tsundoku-bot
  description: 積ん読ボット
  background_color: "#2e2f30"
features:
  bot_user:
    display_name: tsundoku-bot
    always_online: false
oauth_config:
  scopes:
    bot:
      - channels:history
      - groups:history
      - canvases:read
      - canvases:write
      - chat:write
settings:
  event_subscriptions:
    bot_events:
      - message.channels
      - message.groups
  interactivity:
    is_enabled: true
  org_deploy_enabled: false
  socket_mode_enabled: true
  token_rotation_enabled: false
  is_mcp_enabled: false
```

Manifest で app-level token は発行されないため、Socket Mode 用に `connections:write` scope 付きの App-Level Token を別途作成してください。

## 環境変数

`.env.example` をコピーして `.env` を作成します。

```sh
cp .env.example .env
```

設定する値:

- `SLACK_BOT_TOKEN`: Bot User OAuth Token。`xoxb-` で始まる値
- `SLACK_APP_TOKEN`: Socket Mode 用 App-Level Token。`xapp-` で始まる値
- `CANVAS_ID`: URL を保存する Canvas ID。`F...` 形式
- `THREAD_CHANNEL_ID`: チェック済み URL を投稿するスレッドの channel ID
- `THREAD_TS`: チェック済み URL を投稿するスレッドの親メッセージ timestamp
- `WATCH_CHANNEL_IDS`: 任意。監視対象 channel ID をカンマ区切りで指定。空の場合は bot が参加していてイベント購読対象の channel を監視

## アプリ設定

`config.json` で Canvas のチェック間隔を変更できます。

```json
{
  "scheduleIntervalMinutes": 30
}
```

未設定または読み込みに失敗した場合は 30 分間隔で動作します。

## 起動方法

依存関係をインストールします。

```sh
npm install
```

開発環境では TypeScript を直接実行できます。

```sh
npm run dev
```

本番環境では build してから起動します。

```sh
npm run build
npm start
```

起動すると Socket Mode で Slack に接続し、起動直後に一度 Canvas をチェックします。その後は `scheduleIntervalMinutes` ごとにチェック済み URL を処理します。

## 動作確認

1. bot を監視対象 channel と投稿先 thread の channel に追加します。
2. 監視対象 channel に URL を含むメッセージを投稿します。
3. 対象 Canvas に `- [ ] https://...` の形式で URL が追加されることを確認します。
4. Canvas 上で項目をチェック済み、つまり `- [x] https://...` にします。
5. 起動直後または次回スケジュール実行時に、チェック済み URL が指定スレッドへ投稿され、Canvas から処理済み項目が削除されることを確認します。

## 参考

- Slack `canvases.edit`: https://docs.slack.dev/reference/methods/canvases.edit/
- Slack `canvases.sections.lookup`: https://docs.slack.dev/reference/methods/canvases.sections.lookup/
- Slack `chat.postMessage`: https://docs.slack.dev/reference/methods/chat.postMessage/
- Slack `connections:write`: https://docs.slack.dev/reference/scopes/connections.write/
