import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { GameSystem, BattleState, Position } from 'game-logic';
import { GameConnectionState } from './useGameConnection';

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
  // スクリーン座標をアイソメトリック座標に変換
  const isoX = Math.floor(
    ((screenX / TILE_WIDTH) * 2 + (screenY / TILE_HEIGHT) * 2) / 2
  );
  const isoY = Math.floor(
    ((screenY / TILE_HEIGHT) * 2 - (screenX / TILE_WIDTH) * 2) / 2
  );
  return { x: isoX, y: isoY };
}

export function useGameRenderer(
  appRef: React.RefObject<PIXI.Application | null>,
  gameSystemRef: React.RefObject<GameSystem | null>,
  isAppInitialized: boolean = false,
  connectionState?: GameConnectionState,
  moveUnit?: (unitId: string, targetPosition: Position) => void
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
  // 接続状態とmoveUnitへの参照を追加
  const connectionStateRef = useRef(connectionState);
  const moveUnitRef = useRef(moveUnit);

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

    // マップ全体にヒットエリアを追加
    const hitArea = new PIXI.Graphics();
    hitArea.beginFill(0xffffff, 0.001); // ほぼ透明
    hitArea.drawRect(-1000, -1000, 2000, 2000); // 広いエリア
    hitArea.endFill();
    overlayContainer.addChild(hitArea);

    // イベントリスナーを設定
    overlayContainer.on('pointerdown', handleMapClick);
  }

  // イベントハンドラのクリーンアップ
  function cleanupEventHandlers() {
    const overlayContainer = overlayContainerRef.current;
    if (!overlayContainer) return;

    overlayContainer.off('pointerdown', handleMapClick);
  }

  // マップクリック時の処理
  function handleMapClick(event: PIXI.FederatedPointerEvent) {
    const app = appRef.current;
    const gameSystem = gameSystemRef.current;
    if (!app || !gameSystem || !mapContainerRef.current) return;

    // 現在の状態を確認
    console.log(
      'クリック時の selectedUnitId (ref):',
      selectedUnitIdRef.current
    );
    console.log('クリック時の selectedUnitId (state):', selectedUnitId);

    // グローバル座標からコンテナのローカル座標に変換
    const localPos = mapContainerRef.current.toLocal(event.global);

    // スクリーン座標からアイソメトリック座標への変換
    const position = screenToIso(localPos.x, localPos.y);
    console.log('クリック座標:', position);

    const clickedPosition: Position = position;
    const state = gameSystem.getState();

    // 座標がマップ範囲内かチェック
    if (
      position.x < 0 ||
      position.y < 0 ||
      position.x >= state.map.getWidth() ||
      position.y >= state.map.getHeight()
    ) {
      console.log('クリック位置がマップ範囲外です');
      return;
    }

    // クリックされた位置のユニットを取得
    const units = state.units;
    const clickedUnit = units.find(
      (unit) =>
        unit.position.x === clickedPosition.x &&
        unit.position.y === clickedPosition.y
    );

    // --- ユニットクリックのロジック ---
    if (clickedUnit) {
      console.log('ユニットが選択されました:', clickedUnit.id);
      // ユニットが選択された場合、状態を更新
      setSelectedUnitId(clickedUnit.id);
      // 移動範囲を表示（選択状態をrefから直接取得）
      showMoveRange(clickedUnit.id);
    }
    // --- 空きマスクリックのロジック ---
    else {
      // 現在の選択状態をrefから安全に取得
      const currentSelectedId = selectedUnitIdRef.current;
      console.log('空きマスクリック時の選択ユニット:', currentSelectedId);

      if (currentSelectedId) {
        // 選択中のユニットとアクティブユニットをチェック
        const selectedUnit = units.find(
          (unit) => unit.id === currentSelectedId
        );
        const isActiveUnit =
          selectedUnit && state.activeUnitId === currentSelectedId;

        if (!selectedUnit) {
          console.log('選択されたユニットが見つかりません');
          return;
        }

        // 移動可能範囲をチェック
        const movePositions = gameSystem.getUnitMoveRange(currentSelectedId);
        const canMoveToPosition = movePositions.some(
          (pos) => pos.x === clickedPosition.x && pos.y === clickedPosition.y
        );

        console.log('アクティブユニット?:', isActiveUnit);
        console.log('移動可能?:', canMoveToPosition);

        if (isActiveUnit && canMoveToPosition) {
          console.log(
            `ユニット ${currentSelectedId} を移動します:`,
            clickedPosition
          );

          try {
            // ユニット移動を実行
            gameSystem.moveUnit(currentSelectedId, clickedPosition);
            console.log('移動成功');

            // 移動が成功したら選択状態をクリア
            setSelectedUnitId(null);
            clearMoveRange();
          } catch (error) {
            console.error('移動エラー:', error);
          }
        } else {
          if (!isActiveUnit) {
            console.log('このユニットは現在行動できません');
          }
          if (!canMoveToPosition) {
            console.log('選択された位置は移動可能範囲外です');
          }
        }
      }
    }
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

    // 移動可能範囲を取得
    const movePositions = gameSystem.getUnitMoveRange(unitId);
    console.log('移動可能範囲:', movePositions);

    // 移動可能範囲を描画
    movePositions.forEach((position) => {
      const tile = gameSystem.getState().map.getTile(position);
      const height = tile ? tile.height : 0;
      const { x, y } = isoToScreen(position, height);

      const rangeMarker = new PIXI.Graphics();
      rangeMarker.beginFill(0x00ff00, 0.3);
      rangeMarker.lineStyle(2, 0x00ff00, 0.8);
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

  return { selectedUnitId, setSelectedUnitId };
}
