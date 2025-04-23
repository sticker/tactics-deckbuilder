import { useEffect, useRef, useState } from 'react';
import { Client, Room } from 'colyseus.js';
import { GameSystem, Position } from 'game-logic';

// Viteの環境変数の型定義
declare global {
  interface ImportMeta {
    env: {
      DEV: boolean;
      PROD: boolean;
      MODE: string;
    };
  }
}

export interface GameConnectionState {
  connected: boolean;
  teamId: number | null;
  error: string | null;
}

export function useGameConnection(
  gameSystemRef: React.RefObject<GameSystem | null>,
  onStateUpdate: () => void
) {
  const [connectionState, setConnectionState] = useState<GameConnectionState>({
    connected: false,
    teamId: null,
    error: null,
  });

  const clientRef = useRef<Client | null>(null);
  const roomRef = useRef<Room | null>(null);
  const connectionAttemptRef = useRef<boolean>(false);

  // サーバーへの接続
  useEffect(() => {
    // 2重接続を防止
    if (connectionAttemptRef.current) return;
    connectionAttemptRef.current = true;

    const connectToServer = async () => {
      try {
        console.log("サーバーに接続を試みています...");
        
        // 接続先URLの決定（開発環境とプロダクション環境で異なる場合がある）
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const host = window.location.hostname;
        // MODE変数でチェック
        const isDev = typeof import.meta.env !== 'undefined' && import.meta.env.MODE === 'development';
        const port = isDev ? 2567 : window.location.port;
        const serverUrl = `${protocol}://${host}${port ? `:${port}` : ''}`;
        
        console.log(`接続先URL: ${serverUrl}`);
        
        const client = new Client(serverUrl);
        
        // 保存されたセッションIDがあれば取得
        const savedSessionId = localStorage.getItem('sessionId');
        
        // 接続オプション - オプションは第2引数として渡す
        const options = savedSessionId ? { sessionId: savedSessionId } : {};
        
        // ルームに接続または作成
        const room = await client.joinOrCreate<any>('battle', options);
        
        // セッションIDを保存
        localStorage.setItem('sessionId', room.sessionId);

        clientRef.current = client;
        roomRef.current = room;

        console.log("接続成功！ルームID:", room.id);

        // チーム割り当てメッセージの処理
        room.onMessage('assign-team', (message) => {
          console.log("チーム割り当て受信:", message);
          setConnectionState((prev) => ({
            ...prev,
            teamId: message.teamId,
          }));
        });

        // ルーム状態の変更を監視
        room.onStateChange((state) => {
          console.log("ゲーム状態更新");
          updateGameStateFromServer(state);
          onStateUpdate();
        });

        setConnectionState({
          connected: true,
          teamId: null,
          error: null,
        });

        console.log('ゲームサーバーに接続しました');
      } catch (error) {
        console.error('サーバー接続エラー:', error);
        setConnectionState({
          connected: false,
          teamId: null,
          error: '接続に失敗しました。ローカルモードで実行します。',
        });
        
        // ゲームシステムの初期化を行い、オフラインモードで動作できるようにする
        const gameSystem = gameSystemRef.current;
        if (gameSystem) {
          gameSystem.setupInitialState();
        }
      }
    };

    connectToServer();

    return () => {
      if (roomRef.current) {
        roomRef.current.leave();
      }
    };
  }, [onStateUpdate]);

  // サーバーから受信した状態をゲームシステムに反映
  const updateGameStateFromServer = (_: any) => {
    const gameSystem = gameSystemRef.current;
    if (!gameSystem) return;

    // サーバー状態からローカルのゲームシステムに反映
    // 今回は簡易的な実装として、ゲーム状態の更新は行わず、
    // ローカルのゲームロジックで処理する
  };

  // ユニットの移動をサーバーに送信
  const moveUnit = (unitId: string, targetPosition: Position) => {
    const room = roomRef.current;
    if (!room) return;

    // 移動メッセージをサーバーに送信
    room.send('move', {
      unitId,
      x: targetPosition.x,
      y: targetPosition.y,
    });
  };

  return {
    connectionState,
    moveUnit,
  };
}