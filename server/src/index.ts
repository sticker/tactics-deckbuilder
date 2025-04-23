import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { BattleRoom } from './rooms/BattleRoom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const port = Number(process.env.PORT || 2567);
const app = express();

// フロントエンドのファイルを提供するための静的ファイルサーバー
app.use(express.static(path.join(__dirname, '../../client-web/dist')));

// HTTPサーバーの作成
const server = http.createServer(app);

// Colyseusゲームサーバーの作成
const gameServer = new Server({
  transport: new WebSocketTransport({
    server,
  }),
});

// ルームを登録
gameServer.define('battle', BattleRoom);

// サーバーを起動
gameServer.listen(port);
console.log(`🎮 ゲームサーバーが起動しました: http://localhost:${port}`);
