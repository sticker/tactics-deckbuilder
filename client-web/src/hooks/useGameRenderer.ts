import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { GameSystem, BattleState, Position, Unit } from 'game-logic';
import { GameConnectionState } from './useGameConnection';

// 移動アニメーション用の型定義
interface AnimatingUnit {
  unitId: string;
  path: Position[];
  currentStep: number;
  totalSteps: number;
  startTime: number;
  duration: number; // 移動全体の所要時間（ミリ秒）
  stepDuration: number; // 1ステップあたりの所要時間（ミリ秒）
  onComplete: () => void;
}

// タイルのサイズ定義
const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;
const TILE_HEIGHT_OFFSET = 16; // 高さ1単位あたりのオフセット

// アイソメトリックの座標変換
function isoToScreen(
  position: Position,
  height: number = 0
): { x: number; y: number } {
  return {
    x: ((position.x - position.y) * TILE_WIDTH) / 2,
    y:
      ((position.x + position.y) * TILE_HEIGHT) / 2 -
      height * TILE_HEIGHT_OFFSET,
  };
}

// スクリーン座標からアイソメトリック座標への変換
function screenToIso(screenX: number, screenY: number): Position {
  // タイルの菱形形状を考慮した計算式に修正
  const isoX = Math.floor(
    (screenX / (TILE_WIDTH / 2) + screenY / (TILE_HEIGHT / 2)) / 2
  );
  const isoY = Math.floor(
    (screenY / (TILE_HEIGHT / 2) - screenX / (TILE_WIDTH / 2)) / 2
  );
  return { x: isoX, y: isoY };
}

function isTileHit(
  screenX: number,
  screenY: number,
  tileX: number,
  tileY: number,
  tileHeight: number
): boolean {
  // タイルの中心座標を計算
  const { x: centerX, y: centerY } = isoToScreen(
    { x: tileX, y: tileY },
    tileHeight
  );

  // クリック点とタイル中心との差分
  const dx = screenX - centerX;
  const dy = screenY - centerY;

  // 菱形の判定を行う（アイソメトリック座標系では菱形になる）
  return (
    Math.abs(dx / (TILE_WIDTH / 2)) + Math.abs(dy / (TILE_HEIGHT / 2)) <= 1
  );
}

export function useGameRenderer(
  appRef: React.RefObject<PIXI.Application | null>,
  gameSystemRef: React.RefObject<GameSystem | null>,
  isAppInitialized: boolean = false,
  currentActionType: string | null,
  connectionState?: GameConnectionState,
  moveUnit?: (unitId: string, targetPosition: Position) => void,
  executeAction?: (
    sourceUnitId: string,
    targetUnitId: string,
    targetPosition: Position,
    actionType: string // 追加: actionTypeパラメータ
  ) => void
) {
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const selectedUnitIdRef = useRef<string | null>(null);
  const mapContainerRef = useRef<PIXI.Container | null>(null);
  const unitContainerRef = useRef<PIXI.Container | null>(null);
  const overlayContainerRef = useRef<PIXI.Container | null>(null);
  const tilesRef = useRef<Map<string, PIXI.Graphics>>(new Map());
  const unitsRef = useRef<Map<string, PIXI.Graphics>>(new Map());
  const moveRangeRef = useRef<PIXI.Graphics[]>([]);
  const isInitializedRef = useRef<boolean>(false);
  const connectionStateRef = useRef(connectionState);
  const moveUnitRef = useRef(moveUnit);
  const actionRangeRef = useRef<PIXI.Graphics[]>([]);
  const currentActionTypeRef = useRef<string | null>(null);
  const lastActiveUnitIdRef = useRef<string | null>(null); // 前回のアクティブユニットID
  const cameraAnimationRef = useRef<number | null>(null); // カメラアニメーション用ID
  const cameraPanStartTimeRef = useRef<number>(0); // パンアニメーション開始時間
  const cameraPanDurationRef = useRef<number>(800); // パンアニメーション時間（ミリ秒）
  const cameraPanStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 }); // パン開始位置
  const cameraPanTargetPosRef = useRef<{ x: number; y: number }>({
    x: 0,
    y: 0,
  }); // パン目標位置
  const animatingUnitsRef = useRef<AnimatingUnit[]>([]);
  const animationFrameIdRef = useRef<number | null>(null);

  // 値が変わったらrefを更新
  useEffect(() => {
    connectionStateRef.current = connectionState;
  }, [connectionState]);

  // 状態が変わったら参照も更新
  useEffect(() => {
    console.log('selectedUnitId が変更されました:', selectedUnitId);
    selectedUnitIdRef.current = selectedUnitId;
  }, [selectedUnitId]);

  useEffect(() => {
    moveUnitRef.current = moveUnit;
  }, [moveUnit]);

  useEffect(() => {
    currentActionTypeRef.current = currentActionType;
  }, [currentActionType]);

  // アプリが初期化されていないなら何もしない
  useEffect(() => {
    if (!isAppInitialized) return;

    console.log('レンダラー初期化開始');

    const app = appRef.current;
    if (!app || !app.stage) {
      console.log('アプリまたはステージが存在しません');
      return;
    }

    // すでに初期化されていればスキップ
    if (isInitializedRef.current) {
      console.log('レンダラーはすでに初期化されています');
      return;
    }

    // 初期化フラグを設定
    isInitializedRef.current = true;

    try {
      // コンテナの作成
      const mapContainer = new PIXI.Container();
      const unitContainer = new PIXI.Container();
      const overlayContainer = new PIXI.Container();

      // カメラのセットアップ（中央に配置、さらに上方に調整）
      const centerX = app.screen.width / 2;
      const centerY = app.screen.height * 0.3; // 画面の上から30%の位置に配置

      console.log('コンテナ位置設定:', centerX, centerY);

      mapContainer.position.set(centerX, centerY);
      unitContainer.position.set(centerX, centerY);
      overlayContainer.position.set(centerX, centerY);

      // ステージに追加
      app.stage.addChild(mapContainer);
      app.stage.addChild(unitContainer);
      app.stage.addChild(overlayContainer);

      mapContainerRef.current = mapContainer;
      unitContainerRef.current = unitContainer;
      overlayContainerRef.current = overlayContainer;

      // イベントハンドラの設定
      setupEventHandlers();

      // 初期描画
      renderGameState();

      console.log('レンダラー初期化完了');
    } catch (error) {
      console.error('レンダラー初期化エラー:', error);
    }

    return () => {
      // クリーンアップ処理
      const app = appRef.current;
      if (!app) return;

      // イベントリスナーのクリーンアップ
      cleanupEventHandlers();

      // カメラアニメーションがあれば停止
      if (cameraAnimationRef.current !== null) {
        cancelAnimationFrame(cameraAnimationRef.current);
        cameraAnimationRef.current = null;
      }

      // アニメーションのクリーンアップを追加
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }

      // コンテナが存在する場合のみ削除
      if (mapContainerRef.current && app.stage) {
        app.stage.removeChild(mapContainerRef.current);
      }

      if (unitContainerRef.current && app.stage) {
        app.stage.removeChild(unitContainerRef.current);
      }

      if (overlayContainerRef.current && app.stage) {
        app.stage.removeChild(overlayContainerRef.current);
      }

      // 参照をクリア
      mapContainerRef.current = null;
      unitContainerRef.current = null;
      overlayContainerRef.current = null;
      isInitializedRef.current = false;
    };
  }, [isAppInitialized, appRef]);

  // ウィンドウリサイズ時のコンテナ位置調整
  useEffect(() => {
    if (!isAppInitialized || !isInitializedRef.current) return;

    const updateContainerPositions = () => {
      const app = appRef.current;
      if (!app) return;

      const mapContainer = mapContainerRef.current;
      const unitContainer = unitContainerRef.current;
      const overlayContainer = overlayContainerRef.current;

      if (mapContainer && unitContainer && overlayContainer) {
        const centerX = app.screen.width / 2;
        const centerY = app.screen.height * 0.3; // 画面の上から30%に配置

        mapContainer.position.set(centerX, centerY);
        unitContainer.position.set(centerX, centerY);
        overlayContainer.position.set(centerX, centerY);

        console.log('コンテナ位置更新:', centerX, centerY);
      }
    };

    // リサイズ監視
    window.addEventListener('resize', updateContainerPositions);

    // 初期位置設定
    updateContainerPositions();

    return () => {
      window.removeEventListener('resize', updateContainerPositions);
    };
  }, [isAppInitialized, appRef]);

  // アクティブユニットの変更を監視して自動的にカメラをパンする
  useEffect(() => {
    if (!isAppInitialized || !isInitializedRef.current) return;

    const checkActiveUnitChange = () => {
      const gameSystem = gameSystemRef.current;
      if (!gameSystem) return;

      const state = gameSystem.getState();
      const currentActiveUnitId = state.activeUnitId;

      // アクティブユニットが変わっていればカメラを移動
      if (
        currentActiveUnitId &&
        currentActiveUnitId !== lastActiveUnitIdRef.current
      ) {
        console.log(
          `アクティブユニットが変更されました: ${currentActiveUnitId}`
        );
        lastActiveUnitIdRef.current = currentActiveUnitId;

        // アクティブユニットの位置を取得
        const activeUnit = state.units.find(
          (unit) => unit.id === currentActiveUnitId
        );
        if (activeUnit) {
          // ユニットの位置にカメラを移動
          panCameraToUnit(activeUnit);

          // 通知メッセージを表示
          if (window.showGameNotification) {
            window.showGameNotification(`${activeUnit.name}の行動です`);
          }
        }
      }
    };

    // 定期的にアクティブユニットをチェック
    const intervalId = setInterval(checkActiveUnitChange, 300);

    return () => {
      clearInterval(intervalId);
    };
  }, [isAppInitialized]);

  // カメラをユニットの位置にパンする関数
  function panCameraToUnit(unit: Unit) {
    const app = appRef.current;
    const gameSystem = gameSystemRef.current;
    if (
      !app ||
      !gameSystem ||
      !mapContainerRef.current ||
      !unitContainerRef.current ||
      !overlayContainerRef.current
    )
      return;

    // 現在実行中のカメラアニメーションがあれば停止
    if (cameraAnimationRef.current !== null) {
      cancelAnimationFrame(cameraAnimationRef.current);
      cameraAnimationRef.current = null;
    }

    // ユニットのタイル高さを取得
    const state = gameSystem.getState();
    const tile = state.map.getTile(unit.position);
    const height = tile ? tile.height : 0;

    // ユニットの画面座標を計算
    const unitScreenPos = isoToScreen(unit.position, height);

    // 現在のカメラ位置（コンテナの中心位置）
    const currentCenterX = app.screen.width / 2;
    const currentCenterY = app.screen.height * 0.3;

    // 現在のマップコンテナのオフセット
    const currentOffsetX = mapContainerRef.current.position.x - currentCenterX;
    const currentOffsetY = mapContainerRef.current.position.y - currentCenterY;

    // 目標の新しいオフセット（ユニットを中心に表示）
    const targetOffsetX = -unitScreenPos.x;
    const targetOffsetY = -unitScreenPos.y;

    // アニメーション開始情報を設定
    cameraPanStartPosRef.current = {
      x: currentOffsetX,
      y: currentOffsetY,
    };

    cameraPanTargetPosRef.current = {
      x: targetOffsetX,
      y: targetOffsetY,
    };

    cameraPanStartTimeRef.current = performance.now();

    // アニメーション関数
    const animateCamera = (timestamp: number) => {
      // 経過時間の計算
      const elapsed = timestamp - cameraPanStartTimeRef.current;
      const progress = Math.min(elapsed / cameraPanDurationRef.current, 1);

      // イージング関数（smoothstep）
      const smoothProgress = progress * progress * (3 - 2 * progress);

      // 新しい位置を計算
      const newOffsetX =
        cameraPanStartPosRef.current.x +
        (cameraPanTargetPosRef.current.x - cameraPanStartPosRef.current.x) *
          smoothProgress;
      const newOffsetY =
        cameraPanStartPosRef.current.y +
        (cameraPanTargetPosRef.current.y - cameraPanStartPosRef.current.y) *
          smoothProgress;

      // コンテナの位置を更新
      mapContainerRef.current!.position.set(
        currentCenterX + newOffsetX,
        currentCenterY + newOffsetY
      );

      unitContainerRef.current!.position.set(
        currentCenterX + newOffsetX,
        currentCenterY + newOffsetY
      );

      overlayContainerRef.current!.position.set(
        currentCenterX + newOffsetX,
        currentCenterY + newOffsetY
      );

      // アニメーションが完了していなければ続行
      if (progress < 1) {
        cameraAnimationRef.current = requestAnimationFrame(animateCamera);
      } else {
        cameraAnimationRef.current = null;
      }
    };

    // アニメーション開始
    cameraAnimationRef.current = requestAnimationFrame(animateCamera);
  }

  // ゲーム状態が変更されたときの再描画
  useEffect(() => {
    if (!isAppInitialized || !isInitializedRef.current) return;

    const intervalId = setInterval(() => {
      renderGameState();
    }, 100); // 100ms間隔で再描画

    return () => {
      clearInterval(intervalId);
    };
  }, [isAppInitialized]);

  // イベントハンドラの設定
  function setupEventHandlers() {
    const overlayContainer = overlayContainerRef.current;
    if (!overlayContainer) return;

    overlayContainer.eventMode = 'static';
    overlayContainer.cursor = 'pointer';

    // ヒットエリアを拡大して全体をカバー
    const hitArea = new PIXI.Graphics();
    hitArea.beginFill(0xffffff, 0.001); // ほぼ透明
    hitArea.drawRect(-2000, -2000, 4000, 4000); // 十分な大きさ
    hitArea.endFill();
    overlayContainer.addChild(hitArea);

    // ドラッグ関連の状態変数
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let lastX = 0;
    let lastY = 0;

    // イベントリスナーを設定
    overlayContainer.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
      // 右クリックまたは中クリックの場合はドラッグモードを開始
      if (event.button === 2 || event.button === 1) {
        isDragging = true;
        dragStartX = event.global.x;
        dragStartY = event.global.y;
        lastX = dragStartX;
        lastY = dragStartY;

        // ドラッグ中はカーソルを変更
        overlayContainer.cursor = 'grabbing';

        // デフォルトの右クリックメニューを抑制
        event.preventDefault?.();
        return;
      }

      // 左クリックの場合は通常のマップクリック処理
      handleMapClick(event);
    });

    // マウス移動イベント
    overlayContainer.on('pointermove', (event: PIXI.FederatedPointerEvent) => {
      if (
        isDragging &&
        mapContainerRef.current &&
        unitContainerRef.current &&
        overlayContainerRef.current
      ) {
        // ドラッグ中の処理
        const dx = event.global.x - lastX;
        const dy = event.global.y - lastY;

        // すべてのコンテナを同時に移動
        mapContainerRef.current.position.x += dx;
        mapContainerRef.current.position.y += dy;
        unitContainerRef.current.position.x += dx;
        unitContainerRef.current.position.y += dy;
        overlayContainerRef.current.position.x += dx;
        overlayContainerRef.current.position.y += dy;

        // 現在位置を更新
        lastX = event.global.x;
        lastY = event.global.y;
      } else {
        // 通常のマウスホバー処理
        handleMouseMove(event);
      }
    });

    // マウスアップイベント（ドラッグ終了）
    overlayContainer.on('pointerup', (event: PIXI.FederatedPointerEvent) => {
      if (isDragging) {
        isDragging = false;
        overlayContainer.cursor = 'pointer';
      }
    });

    // マウスがコンテナから外れた場合もドラッグ終了
    overlayContainer.on(
      'pointerupoutside',
      (event: PIXI.FederatedPointerEvent) => {
        if (isDragging) {
          isDragging = false;
          overlayContainer.cursor = 'pointer';
        }
      }
    );

    // カメラ操作でのコンテキストメニュー抑制
    window.addEventListener('contextmenu', (e) => {
      if (isDragging) {
        e.preventDefault();
      }
    });

    // マウスホイールでのズーム機能（オプション）
    // 必要に応じて実装
  }

  // マウスホバー処理
  function handleMouseMove(event: PIXI.FederatedPointerEvent) {
    const app = appRef.current;
    const gameSystem = gameSystemRef.current;
    if (!app || !gameSystem || !mapContainerRef.current) return;

    const localPos = mapContainerRef.current.toLocal(event.global);

    // ユニット上にマウスがあるかチェック
    const unitUnderMouse = findUnitUnderClick(
      localPos.x,
      localPos.y,
      gameSystem.getState()
    );

    // ユニット上ならポインタをカーソルに変更
    if (unitUnderMouse) {
      overlayContainerRef.current!.cursor = 'pointer';
    } else {
      // タイル上なら選択可能かどうかでカーソルを変更
      const position = screenToIso(localPos.x, localPos.y);
      if (isValidTilePosition(position, gameSystem.getState())) {
        overlayContainerRef.current!.cursor = 'pointer';
      } else {
        overlayContainerRef.current!.cursor = 'default';
      }
    }
  }

  // タイル位置が有効かどうかをチェック
  function isValidTilePosition(
    position: Position,
    state: BattleState
  ): boolean {
    return (
      position.x >= 0 &&
      position.y >= 0 &&
      position.x < state.map.getWidth() &&
      position.y < state.map.getHeight()
    );
  }

  // イベントハンドラのクリーンアップ
  function cleanupEventHandlers() {
    const overlayContainer = overlayContainerRef.current;
    if (!overlayContainer) return;

    // すべてのイベントリスナーを削除
    overlayContainer.off('pointerdown');
    overlayContainer.off('pointermove');
    overlayContainer.off('pointerup');
    overlayContainer.off('pointerupoutside');

    // コンテキストメニュー抑制の解除
    window.removeEventListener('contextmenu', (e) => e.preventDefault());
  }

  // 2点間の線形補間関数
  function lerp(start: number, end: number, t: number): number {
    return start + t * (end - start);
  }

  // パスの計算（シンプルな線形パス）
  function calculateLinearPath(
    start: Position,
    end: Position,
    steps: number
  ): Position[] {
    const path: Position[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      path.push({
        x: lerp(start.x, end.x, t),
        y: lerp(start.y, end.y, t),
      });
    }
    return path;
  }

  // A*アルゴリズムによるパス検索
  function findPath(
    state: BattleState,
    start: Position,
    end: Position
  ): Position[] {
    // 簡易的なA*アルゴリズム
    try {
      // ヒューリスティック関数（マンハッタン距離）
      const heuristic = (a: Position, b: Position) => {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      };

      // 開始位置と目標位置が同じ場合
      if (start.x === end.x && start.y === end.y) {
        return [{ ...start }];
      }

      // 開始位置または目標位置が無効な場合
      if (
        !start ||
        !end ||
        typeof start.x !== 'number' ||
        typeof start.y !== 'number' ||
        typeof end.x !== 'number' ||
        typeof end.y !== 'number'
      ) {
        console.error('パス検索: 無効な開始位置または目標位置');
        return [];
      }

      // 既に調査済みのノード
      const closedSet = new Set<string>();

      // 現在調査中のノード
      const openSet = new Set<string>();
      openSet.add(`${start.x},${start.y}`);

      // 各ノードへの最適経路のスコア
      const gScore: Record<string, number> = {};
      gScore[`${start.x},${start.y}`] = 0;

      // 各ノードの推定スコア
      const fScore: Record<string, number> = {};
      fScore[`${start.x},${start.y}`] = heuristic(start, end);

      // 各ノードの親ノード
      const cameFrom: Record<string, Position> = {};

      // 隣接ノードの方向を定義
      const directions = [
        { x: 0, y: -1 }, // 上
        { x: 1, y: 0 }, // 右
        { x: 0, y: 1 }, // 下
        { x: -1, y: 0 }, // 左
      ];

      // 最大探索回数（無限ループ防止）
      const maxIterations = 1000;
      let iterations = 0;

      // openSetが空になるまで探索を続ける
      while (openSet.size > 0 && iterations < maxIterations) {
        iterations++;

        // fScoreが最小のノードを取得
        let currentKey = '';
        let currentScore = Infinity;

        for (const key of openSet) {
          if (fScore[key] !== undefined && fScore[key] < currentScore) {
            currentScore = fScore[key];
            currentKey = key;
          }
        }

        // 現在のノードの座標を取得
        const [x, y] = currentKey.split(',').map(Number);
        const current: Position = { x, y };

        // 目標地点に到達したかチェック
        if (current.x === end.x && current.y === end.y) {
          // ゴールに到達、パスを再構成
          const path: Position[] = [];
          let curr = current;

          while (curr) {
            path.unshift({ ...curr });
            const key = `${curr.x},${curr.y}`;
            curr = cameFrom[key];
          }

          return path;
        }

        // 現在のノードを処理済みに
        openSet.delete(currentKey);
        closedSet.add(currentKey);

        // 隣接ノードをチェック
        for (const dir of directions) {
          const neighbor: Position = {
            x: current.x + dir.x,
            y: current.y + dir.y,
          };

          // マップ範囲外や通行不能の場合はスキップ
          if (
            neighbor.x < 0 ||
            neighbor.y < 0 ||
            neighbor.x >= state.map.getWidth() ||
            neighbor.y >= state.map.getHeight()
          ) {
            continue;
          }

          const neighborTile = state.map.getTile(neighbor);
          if (!neighborTile || !neighborTile.passable) {
            continue;
          }

          // 敵ユニットがいる場合もスキップ
          const unitAtPos = state.units.find(
            (u) => u.position.x === neighbor.x && u.position.y === neighbor.y
          );
          if (unitAtPos) {
            // 移動元のユニットと同じ位置でない場合かつ目的地でない場合はスキップ
            const startUnitId = state.units.find(
              (u) => u.position.x === start.x && u.position.y === start.y
            )?.id;

            if (unitAtPos.id !== startUnitId) {
              // 目的地の場合は許可（ユニット入れ替え用）
              if (!(neighbor.x === end.x && neighbor.y === end.y)) {
                continue;
              }
            }
          }

          const neighborKey = `${neighbor.x},${neighbor.y}`;

          // 処理済みのノードはスキップ
          if (closedSet.has(neighborKey)) {
            continue;
          }

          // 現在のノードを経由したスコアを計算
          const tentativeGScore = gScore[currentKey] + 1;

          // 未調査のノードか、より良い経路を発見した場合
          if (
            !openSet.has(neighborKey) ||
            tentativeGScore < gScore[neighborKey]
          ) {
            // 経路を更新
            cameFrom[neighborKey] = current;
            gScore[neighborKey] = tentativeGScore;
            fScore[neighborKey] = tentativeGScore + heuristic(neighbor, end);

            // 未調査なら調査対象に追加
            if (!openSet.has(neighborKey)) {
              openSet.add(neighborKey);
            }
          }
        }
      }

      // パスが見つからなかった場合のフォールバック（直線パス）
      console.warn(
        'A*でパスが見つかりませんでした。直線パスにフォールバックします。'
      );
      return calculateLinearPath(
        start,
        end,
        Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y)) + 1
      );
    } catch (error) {
      console.error('パス検索エラー:', error);
      // エラー時は空のパスを返す
      return [];
    }
  }

  // 移動アニメーションの開始
  function startMoveAnimation(
    unitId: string,
    path: Position[],
    duration: number = 800,
    onComplete?: () => void
  ) {
    console.log('移動アニメーション開始:', unitId, path);

    // パスのバリデーション
    if (!path || path.length <= 1) {
      console.log('無効なパス、アニメーションをスキップ');
      if (onComplete) onComplete();
      return;
    }

    // 不正な値が含まれていないか確認
    const validPath = path.filter(
      (pos) => pos && typeof pos.x === 'number' && typeof pos.y === 'number'
    );

    if (validPath.length !== path.length) {
      console.warn('不正な位置データがパスに含まれています。修正します。');
    }

    if (validPath.length <= 1) {
      console.log('有効なパスポイントが不足、アニメーションをスキップ');
      if (onComplete) onComplete();
      return;
    }

    const now = performance.now();
    const stepDuration = duration / (validPath.length - 1);

    // アニメーション情報を登録
    const animatingUnit: AnimatingUnit = {
      unitId,
      path: validPath,
      currentStep: 0,
      totalSteps: validPath.length - 1,
      startTime: now,
      duration,
      stepDuration,
      onComplete: onComplete || (() => {}),
    };

    // 既存のアニメーションを削除（同じユニットが複数回移動しないように）
    animatingUnitsRef.current = animatingUnitsRef.current.filter(
      (anim) => anim.unitId !== unitId
    );

    // アニメーション中のユニットリストに追加
    animatingUnitsRef.current.push(animatingUnit);

    // アニメーションループが未起動なら開始
    if (animationFrameIdRef.current === null) {
      animationFrameIdRef.current = requestAnimationFrame(updateAnimations);
    }
  }

  // アニメーションの更新
  function updateAnimations(timestamp: number) {
    const gameSystem = gameSystemRef.current;
    if (!gameSystem) {
      animationFrameIdRef.current = requestAnimationFrame(updateAnimations);
      return;
    }

    let hasActiveAnimations = false;
    const state = gameSystem.getState();

    // デバッグ情報
    console.log(
      `アニメーション更新: ${animatingUnitsRef.current.length}個のユニットがアニメーション中`
    );

    // 各アニメーション中のユニットを更新
    for (let i = animatingUnitsRef.current.length - 1; i >= 0; i--) {
      try {
        const anim = animatingUnitsRef.current[i];

        // パスが空または無効なら処理をスキップ
        if (!anim || !anim.path || anim.path.length === 0) {
          console.error('無効なアニメーションデータ:', anim);
          animatingUnitsRef.current.splice(i, 1);
          continue;
        }

        const elapsed = timestamp - anim.startTime;

        // 総経過時間から現在のステップを計算
        const currentStep = Math.min(
          Math.floor(elapsed / anim.stepDuration),
          anim.totalSteps
        );

        // アニメーション完了判定
        if (currentStep >= anim.totalSteps) {
          console.log('アニメーション完了:', anim.unitId);

          // 最終位置に設定
          const unit = state.units.find((u) => u.id === anim.unitId);
          const unitGraphic = unitsRef.current.get(anim.unitId);

          if (unit && unitGraphic && anim.path.length > 0) {
            const endPos = anim.path[anim.path.length - 1];
            const tile = state.map.getTile(endPos);
            const height = tile ? tile.height : 0;
            const { x, y } = isoToScreen(endPos, height);
            unitGraphic.position.set(x, y);
          }

          // 完了コールバックを呼び出し
          if (anim.onComplete) {
            anim.onComplete();
          }

          // リストから削除
          animatingUnitsRef.current.splice(i, 1);
        } else {
          hasActiveAnimations = true;

          // 現在のステップと次のステップの間を補間
          if (currentStep < anim.path.length - 1) {
            const unit = state.units.find((u) => u.id === anim.unitId);
            const unitGraphic = unitsRef.current.get(anim.unitId);

            if (unit && unitGraphic) {
              // 安全にインデックスをチェック
              if (
                currentStep >= 0 &&
                currentStep < anim.path.length &&
                currentStep + 1 < anim.path.length
              ) {
                const currentPos = anim.path[currentStep];
                const nextPos = anim.path[currentStep + 1];

                // パス位置の有効性を確認
                if (
                  currentPos &&
                  nextPos &&
                  typeof currentPos.x === 'number' &&
                  typeof currentPos.y === 'number' &&
                  typeof nextPos.x === 'number' &&
                  typeof nextPos.y === 'number'
                ) {
                  // ステップ内での進行度を計算（0〜1）
                  const stepProgress =
                    (elapsed % anim.stepDuration) / anim.stepDuration;

                  // 2点間を線形補間
                  const interpPos = {
                    x: lerp(currentPos.x, nextPos.x, stepProgress),
                    y: lerp(currentPos.y, nextPos.y, stepProgress),
                  };

                  // 高さを考慮した座標を計算
                  const currentTile = state.map.getTile(currentPos);
                  const nextTile = state.map.getTile(nextPos);
                  const currentHeight =
                    currentTile && typeof currentTile.height === 'number'
                      ? currentTile.height
                      : 0;
                  const nextHeight =
                    nextTile && typeof nextTile.height === 'number'
                      ? nextTile.height
                      : 0;

                  // 高さも補間
                  const interpHeight = lerp(
                    currentHeight,
                    nextHeight,
                    stepProgress
                  );

                  // ユニットのバウンス効果（軽いジャンプ感）
                  const bounceHeight = Math.sin(stepProgress * Math.PI) * 8;

                  // 画面座標に変換して位置を更新
                  const { x, y } = isoToScreen(interpPos, interpHeight);
                  unitGraphic.position.set(x, y - bounceHeight);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('アニメーション更新エラー:', error);
        // エラーが発生したアニメーションは削除
        animatingUnitsRef.current.splice(i, 1);
      }
    }

    // アニメーションがまだ残っている場合は続行
    if (hasActiveAnimations) {
      animationFrameIdRef.current = requestAnimationFrame(updateAnimations);
    } else {
      animationFrameIdRef.current = null;
    }
  }

  // マップクリック時の処理
  function handleMapClick(event: PIXI.FederatedPointerEvent) {
    const app = appRef.current;
    const gameSystem = gameSystemRef.current;
    if (!app || !gameSystem || !mapContainerRef.current) return;

    // グローバル座標からコンテナのローカル座標に変換
    const localPos = mapContainerRef.current.toLocal(event.global);

    // 1. まずユニットのクリック判定
    const clickedUnit = findUnitUnderClick(
      localPos.x,
      localPos.y,
      gameSystem.getState()
    );

    if (clickedUnit) {
      console.log(
        'ユニットがクリックされました:',
        clickedUnit.id,
        'アクション:',
        currentActionTypeRef.current
      );

      // 既に選択されているユニットがあり、アクションが選択されている場合
      if (
        selectedUnitIdRef.current &&
        currentActionTypeRef.current &&
        currentActionTypeRef.current !== 'move'
      ) {
        console.log('アクション実行条件確認中:', currentActionTypeRef.current);

        const sourceUnit = gameSystem
          .getState()
          .units.find((unit) => unit.id === selectedUnitIdRef.current);

        if (sourceUnit && executeAction) {
          // ターゲットが範囲内にあるか確認
          const isInRange = checkActionRange(
            sourceUnit.position,
            clickedUnit.position,
            currentActionTypeRef.current.startsWith('attack') ? 1 : 2
          );

          if (!isInRange) {
            if (window.showGameNotification) {
              window.showGameNotification('対象が範囲外です');
            }
            return;
          }

          console.log(
            'アクション実行:',
            currentActionTypeRef.current,
            sourceUnit.id,
            clickedUnit.id
          );

          // 修正: アクションタイプを直接渡す
          executeAction(
            sourceUnit.id,
            clickedUnit.id,
            clickedUnit.position,
            currentActionTypeRef.current
          );

          // アクション実行後、選択とアクション表示をクリア
          clearMoveRange();
          clearActionRange();
          setSelectedUnitId(null);
          return;
        }
      }
      // 既存の選択をクリア
      clearMoveRange();
      clearActionRange(); // アクション範囲も消去
      setSelectedUnitId(clickedUnit.id);
      showMoveRange(clickedUnit.id);
      return;
    }

    // 2. ユニットがクリックされていない場合、タイルのクリック判定を行う
    // 全タイルに対してクリック判定を行い、最も近いタイルを選択
    const state = gameSystem.getState();
    const tiles = state.map.getAllTiles();

    let closestTile = null;
    let closestDistance = Number.MAX_VALUE;

    for (const tile of tiles) {
      const { x: tileX, y: tileY } = isoToScreen(tile.position, tile.height);
      const dx = localPos.x - tileX;
      const dy = localPos.y - tileY;
      const distance = dx * dx + dy * dy;

      if (
        distance < closestDistance &&
        isTileHit(
          localPos.x,
          localPos.y,
          tile.position.x,
          tile.position.y,
          tile.height
        )
      ) {
        closestDistance = distance;
        closestTile = tile;
      }
    }

    if (closestTile) {
      console.log('クリックされたタイル:', closestTile.position);
      const clickedPosition: Position = closestTile.position;

      // 現在の選択状態をrefから安全に取得
      const currentSelectedId = selectedUnitIdRef.current;
      console.log('空きマスクリック時の選択ユニット:', currentSelectedId);

      if (currentSelectedId) {
        // 選択中のユニットとアクティブユニットをチェック
        const selectedUnit = state.units.find(
          (unit) => unit.id === currentSelectedId
        );
        const isActiveUnit =
          selectedUnit && state.activeUnitId === currentSelectedId;

        if (!selectedUnit) {
          console.log('選択されたユニットが見つかりません');
          clearMoveRange();
          setSelectedUnitId(null);
          return;
        }

        console.log(currentActionType);
        // 現在のアクションタイプをチェック
        if (currentActionType === 'move' || currentActionType === null) {
          console.log('移動アクションが選択されています');
          // 移動アクションの場合
          // 移動可能範囲をチェック
          const movePositions = gameSystem.getUnitMoveRange(currentSelectedId);
          const canMoveToPosition = movePositions.some(
            (pos) => pos.x === clickedPosition.x && pos.y === clickedPosition.y
          );

          console.log('アクティブユニット?:', isActiveUnit);
          console.log('移動可能?:', canMoveToPosition);

          // 移動処理を行う箇所を修正
          if (isActiveUnit && canMoveToPosition) {
            console.log(
              `ユニット ${currentSelectedId} を移動します:`,
              clickedPosition
            );

            try {
              // ユニット移動を実行する前に、選択解除中であることを記録
              const movingUnitId = currentSelectedId;
              const unit = gameSystem
                .getState()
                .units.find((u) => u.id === movingUnitId);

              if (!unit) {
                console.error('移動するユニットが見つかりません');
                return;
              }

              // まず選択状態をクリア
              setSelectedUnitId(null);
              clearMoveRange();
              clearActionRange();

              // パスを計算
              const path = findPath(
                gameSystem.getState(),
                unit.position,
                clickedPosition
              );

              console.log('計算されたパス:', path);

              // パスが有効なら移動アニメーションを開始
              if (path && path.length > 0) {
                // アニメーション時間を計算（パスの長さに基づく、ただし上限あり）
                const animationDuration = Math.min(path.length * 150, 800);

                // アニメーション開始
                startMoveAnimation(
                  movingUnitId,
                  path,
                  animationDuration,
                  () => {
                    try {
                      // アニメーション完了後に実際のゲームロジックでユニットを移動
                      const success = gameSystem.moveUnit(
                        movingUnitId,
                        clickedPosition
                      );

                      if (success) {
                        console.log('移動成功');

                        // 通知メッセージを表示
                        if (window.showGameNotification) {
                          window.showGameNotification('移動完了');
                        }
                      } else {
                        console.error('移動ロジックの実行に失敗');

                        if (window.showGameNotification) {
                          window.showGameNotification('移動に失敗しました');
                        }
                      }
                    } catch (error) {
                      console.error('移動実行エラー:', error);
                    }
                  }
                );
              } else {
                console.error('有効なパスが生成されませんでした');

                if (window.showGameNotification) {
                  window.showGameNotification(
                    '移動経路を見つけられませんでした'
                  );
                }
              }
            } catch (error) {
              console.error('移動処理エラー:', error);
            }
          } else {
            // 移動できない場合は選択解除
            if (!isActiveUnit) {
              console.log('このユニットは現在行動できません');
            }
            if (!canMoveToPosition) {
              console.log('選択された位置は移動可能範囲外です');
            }

            // 選択を解除
            clearMoveRange();
            clearActionRange();
            setSelectedUnitId(null);
          }
        } else {
          // 移動以外のアクションの場合、クリックで選択解除
          clearMoveRange();
          clearActionRange();
          setSelectedUnitId(null);
        }
      } else if (
        moveRangeRef.current.length > 0 ||
        actionRangeRef.current.length > 0
      ) {
        // 選択されたユニットがない状態でもし範囲表示が残っていれば消去
        clearMoveRange();
        clearActionRange();
      }
    } else {
      console.log('クリック位置がマップ範囲外です');
      // マップ範囲外をクリックした場合も選択解除
      if (
        selectedUnitIdRef.current ||
        moveRangeRef.current.length > 0 ||
        actionRangeRef.current.length > 0
      ) {
        clearMoveRange();
        clearActionRange();
        setSelectedUnitId(null);
      }
    }
  }

  function findUnitUnderClick(
    x: number,
    y: number,
    state: BattleState
  ): Unit | undefined {
    // 各ユニットに対してクリック判定
    return state.units.find((unit) => {
      const tile = state.map.getTile(unit.position);
      const height = tile ? tile.height : 0;
      const { x: unitX, y: unitY } = isoToScreen(unit.position, height);

      // ユニットの表示サイズを考慮した判定エリア
      const hitRadius = TILE_WIDTH / 3; // ユニットの当たり判定サイズ
      const dx = x - unitX;
      const dy = y - unitY + TILE_HEIGHT / 4; // 少し上方向にオフセット

      // 円形の当たり判定
      return dx * dx + dy * dy <= hitRadius * hitRadius;
    });
  }

  // selectedUnitIdの変更を監視
  useEffect(() => {
    console.log('selectedUnitId が変更されました:', selectedUnitId);
  }, [selectedUnitId]);

  // 移動可能範囲の表示
  function showMoveRange(unitId: string) {
    console.log('移動可能範囲を表示:', unitId);
    const gameSystem = gameSystemRef.current;
    const overlayContainer = overlayContainerRef.current;
    if (!gameSystem || !overlayContainer) return;

    // 以前の移動範囲表示をクリア
    clearMoveRange();

    // ユニットがアクティブ（移動可能）かどうか判定
    const state = gameSystem.getState();
    const isActive = state.activeUnitId === unitId;

    // 色を選択：アクティブなら緑、非アクティブならオレンジ
    const fillColor = isActive ? 0x00ff00 : 0xff9900; // 緑 or オレンジ
    const lineColor = isActive ? 0x00ff00 : 0xff9900; // 緑 or オレンジ

    // 移動可能範囲を取得
    const movePositions = gameSystem.getUnitMoveRange(unitId);
    console.log('移動可能範囲:', movePositions);

    // 移動可能範囲を描画
    movePositions.forEach((position) => {
      const tile = gameSystem.getState().map.getTile(position);
      const height = tile ? tile.height : 0;
      const { x, y } = isoToScreen(position, height);

      const rangeMarker = new PIXI.Graphics();
      rangeMarker.beginFill(fillColor, 0.3); // 色を変数に置き換え
      rangeMarker.lineStyle(2, lineColor, 0.8); // 色を変数に置き換え
      rangeMarker.drawPolygon([
        -TILE_WIDTH / 2,
        0,
        0,
        -TILE_HEIGHT / 2,
        TILE_WIDTH / 2,
        0,
        0,
        TILE_HEIGHT / 2,
      ]);
      rangeMarker.endFill();
      rangeMarker.position.set(x, y);

      overlayContainer.addChild(rangeMarker);
      moveRangeRef.current.push(rangeMarker);
    });

    // ユニットが非アクティブな場合、通知を表示
    if (!isActive && movePositions.length > 0) {
      if (window.showGameNotification) {
        window.showGameNotification('このユニットはまだ行動できません');
      }
    }
  }

  // 移動可能範囲表示のクリア
  function clearMoveRange() {
    const overlayContainer = overlayContainerRef.current;
    if (!overlayContainer) return;

    moveRangeRef.current.forEach((marker) => {
      overlayContainer.removeChild(marker);
      marker.destroy();
    });
    moveRangeRef.current = [];
  }

  // ゲーム状態の描画
  function renderGameState() {
    const app = appRef.current;
    const gameSystem = gameSystemRef.current;
    if (!app || !gameSystem) return;

    const state = gameSystem.getState();

    renderMap(state);
    renderUnits(state);
  }

  // マップの描画
  function renderMap(state: BattleState) {
    const mapContainer = mapContainerRef.current;
    if (!mapContainer) return;

    const tiles = state.map.getAllTiles();

    // タイルの描画
    tiles.forEach((tile) => {
      const tileKey = `${tile.position.x},${tile.position.y}`;
      let tileGraphic = tilesRef.current.get(tileKey);

      if (!tileGraphic) {
        // 新しいタイルを作成
        tileGraphic = new PIXI.Graphics();
        mapContainer.addChild(tileGraphic);
        tilesRef.current.set(tileKey, tileGraphic);
      }

      // タイルの座標をアイソメトリックに変換
      const { x, y } = isoToScreen(tile.position, tile.height);
      tileGraphic.position.set(x, y);

      // タイルを描画
      tileGraphic.clear();

      // タイルの側面（高さに応じて）
      if (tile.height > 0) {
        tileGraphic.beginFill(0x555577);
        tileGraphic.lineStyle(1, 0x333355, 1);
        tileGraphic.drawPolygon([
          -TILE_WIDTH / 2,
          0,
          -TILE_WIDTH / 2,
          TILE_HEIGHT_OFFSET * tile.height,
          0,
          TILE_HEIGHT / 2 + TILE_HEIGHT_OFFSET * tile.height,
          0,
          TILE_HEIGHT / 2,
        ]);
        tileGraphic.endFill();

        tileGraphic.beginFill(0x555577);
        tileGraphic.lineStyle(1, 0x333355, 1);
        tileGraphic.drawPolygon([
          TILE_WIDTH / 2,
          0,
          TILE_WIDTH / 2,
          TILE_HEIGHT_OFFSET * tile.height,
          0,
          TILE_HEIGHT / 2 + TILE_HEIGHT_OFFSET * tile.height,
          0,
          TILE_HEIGHT / 2,
        ]);
        tileGraphic.endFill();
      }

      // タイルの上面
      tileGraphic.beginFill(tile.passable ? 0x88aaff : 0x884444);
      tileGraphic.lineStyle(1, 0x333355, 1);
      tileGraphic.drawPolygon([
        -TILE_WIDTH / 2,
        0,
        0,
        -TILE_HEIGHT / 2,
        TILE_WIDTH / 2,
        0,
        0,
        TILE_HEIGHT / 2,
      ]);
      tileGraphic.endFill();
    });
  }

  // ユニットの描画
  function renderUnits(state: BattleState) {
    const unitContainer = unitContainerRef.current;
    if (!unitContainer) return;

    // 現在のユニットをクリア
    unitsRef.current.forEach((graphic, id) => {
      if (!state.units.some((unit) => unit.id === id)) {
        unitContainer.removeChild(graphic);
        graphic.destroy();
        unitsRef.current.delete(id);
      }
    });

    // ユニットの描画
    state.units.forEach((unit) => {
      let unitGraphic = unitsRef.current.get(unit.id);

      if (!unitGraphic) {
        // 新しいユニットを作成
        unitGraphic = new PIXI.Graphics();
        unitContainer.addChild(unitGraphic);
        unitsRef.current.set(unit.id, unitGraphic);
      }

      // タイルの座標をアイソメトリックに変換
      const tile = state.map.getTile(unit.position);
      const height = tile ? tile.height : 0;
      const { x, y } = isoToScreen(unit.position, height);

      unitGraphic.position.set(x, y);

      // ユニットを描画
      unitGraphic.clear();

      // チームによって色を変える
      const teamColor = unit.teamId === 0 ? 0x4444ff : 0xff4444;

      // ユニットが選択されているか、行動可能かによって強調表示
      const isSelected = unit.id === selectedUnitId;
      const isActive = unit.id === state.activeUnitId;
      const borderColor = isSelected
        ? 0xffff00
        : isActive
        ? 0x00ffff
        : 0x000000;
      const borderWidth = isSelected || isActive ? 3 : 1;

      // ユニットの描画（円形で表現）
      unitGraphic.beginFill(teamColor, 0.8);
      unitGraphic.lineStyle(borderWidth, borderColor, 1);
      unitGraphic.drawCircle(0, -TILE_HEIGHT / 4, TILE_WIDTH / 4);
      unitGraphic.endFill();

      // CTゲージの描画
      const ctRatio = unit.stats.ct / 100;
      unitGraphic.beginFill(0xffcc44, 0.8);
      unitGraphic.lineStyle(1, 0x000000, 0.8);
      unitGraphic.drawRect(
        -TILE_WIDTH / 5,
        -TILE_HEIGHT / 2,
        (TILE_WIDTH / 2.5) * ctRatio,
        5
      );
      unitGraphic.endFill();

      // HPバーの描画
      const hpRatio = unit.stats.hp / unit.stats.maxHp;
      unitGraphic.beginFill(0x44ff44, 0.8);
      unitGraphic.lineStyle(1, 0x000000, 0.8);
      unitGraphic.drawRect(
        -TILE_WIDTH / 5,
        -TILE_HEIGHT / 2 + 7,
        (TILE_WIDTH / 2.5) * hpRatio,
        5
      );
      unitGraphic.endFill();
    });
  }

  // マンハッタン距離でアクション範囲をチェックする関数
  function checkActionRange(
    sourcePosition: Position,
    targetPosition: Position,
    range: number
  ): boolean {
    const distance =
      Math.abs(sourcePosition.x - targetPosition.x) +
      Math.abs(sourcePosition.y - targetPosition.y);
    return distance <= range && distance > 0;
  }

  // アクション範囲表示関数
  function showActionRange(
    unitId: string,
    actionType: string,
    range: number = 1
  ) {
    console.log('アクション範囲表示:', actionType, range, unitId);
    const gameSystem = gameSystemRef.current;
    const overlayContainer = overlayContainerRef.current;
    if (!gameSystem || !overlayContainer) return;

    // 既存の範囲表示をクリア
    clearActionRange();
    clearMoveRange(); // 移動範囲も消去

    // アクション範囲の色
    const fillColor = actionType === 'attack' ? 0xff0000 : 0x00ff00; // 赤または緑
    const lineColor = actionType === 'attack' ? 0xff3333 : 0x33ff33;
    const alpha = 0.3;

    // ユニットの位置を取得
    const unit = gameSystem.getState().units.find((u) => u.id === unitId);
    if (!unit) return;

    // マップを取得
    const state = gameSystem.getState();
    const map = state.map;

    // アクション可能なタイルを検索
    for (let y = 0; y < map.getHeight(); y++) {
      for (let x = 0; x < map.getWidth(); x++) {
        const position = { x, y };
        const tile = map.getTile(position);

        if (!tile || !tile.passable) continue;

        // マンハッタン距離でアクション範囲をチェック
        const distance =
          Math.abs(unit.position.x - x) + Math.abs(unit.position.y - y);

        if (distance <= range && distance > 0) {
          // 対象位置にユニットがいるか確認
          const targetUnit = state.units.find(
            (u) => u.position.x === x && u.position.y === y
          );

          // ユニットがいる場所のみ表示（自分自身を除く）
          if (targetUnit && targetUnit.id !== unit.id) {
            // 範囲表示用のグラフィックスを作成
            const { x: screenX, y: screenY } = isoToScreen(
              position,
              tile.height
            );
            const rangeGraphic = new PIXI.Graphics();

            rangeGraphic.beginFill(fillColor, alpha);
            rangeGraphic.lineStyle(2, lineColor, 0.8);
            rangeGraphic.drawPolygon([
              -TILE_WIDTH / 2,
              0,
              0,
              -TILE_HEIGHT / 2,
              TILE_WIDTH / 2,
              0,
              0,
              TILE_HEIGHT / 2,
            ]);
            rangeGraphic.endFill();
            rangeGraphic.position.set(screenX, screenY);

            overlayContainer.addChild(rangeGraphic);
            actionRangeRef.current.push(rangeGraphic);
          }
        }
      }
    }

    if (actionRangeRef.current.length === 0) {
      // 範囲内に対象がいない場合
      if (window.showGameNotification) {
        window.showGameNotification(
          'アクション可能なユニットが範囲内にいません'
        );
      }
    }
  }

  // アクション範囲表示のクリア
  function clearActionRange() {
    const overlayContainer = overlayContainerRef.current;
    if (!overlayContainer) return;

    actionRangeRef.current.forEach((graphic) => {
      overlayContainer.removeChild(graphic);
      graphic.destroy();
    });

    actionRangeRef.current = [];
  }

  return {
    selectedUnitId,
    setSelectedUnitId,
    showMoveRange,
    clearMoveRange,
    showActionRange,
    clearActionRange,
  };
}
