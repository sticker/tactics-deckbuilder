import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { GameSystem, BattleState, Position } from 'game-logic';

// タイルのサイズ定義
const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;
const TILE_HEIGHT_OFFSET = 16; // 高さ1単位あたりのオフセット

// アイソメトリックの座標変換
function isoToScreen(position: Position, height: number = 0): { x: number, y: number } {
  return {
    x: (position.x - position.y) * TILE_WIDTH / 2,
    y: (position.x + position.y) * TILE_HEIGHT / 2 - height * TILE_HEIGHT_OFFSET,
  };
}

export function useGameRenderer(
  appRef: React.RefObject<PIXI.Application | null>,
  gameSystemRef: React.RefObject<GameSystem | null>
) {
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const mapContainerRef = useRef<PIXI.Container | null>(null);
  const unitContainerRef = useRef<PIXI.Container | null>(null);
  const overlayContainerRef = useRef<PIXI.Container | null>(null);
  const tilesRef = useRef<Map<string, PIXI.Graphics>>(new Map());
  const unitsRef = useRef<Map<string, PIXI.Graphics>>(new Map());
  const moveRangeRef = useRef<PIXI.Graphics[]>([]);
  const isInitializedRef = useRef<boolean>(false);

  // レンダラーの初期化
  useEffect(() => {
    // アプリケーションの初期化を待つ
    const initInterval = setInterval(() => {
      const app = appRef.current;
      if (!app) return;
      
      clearInterval(initInterval);
      
      // コンテナがすでに初期化されていれば何もしない
      if (isInitializedRef.current) return;
      isInitializedRef.current = true;

      console.log("レンダラーを初期化します");

      // コンテナの作成
      const mapContainer = new PIXI.Container();
      const unitContainer = new PIXI.Container();
      const overlayContainer = new PIXI.Container();

      // カメラのセットアップ（中央に配置）
      const centerX = app.screen.width / 2;
      const centerY = app.screen.height / 2 - 100; // 少し上に調整
      
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
    }, 100);

    return () => {
      clearInterval(initInterval);
      
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
  }, [appRef]);

  // ゲーム状態が変更されたときの再描画
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (isInitializedRef.current) {
        renderGameState();
      }
    }, 100); // 100ms間隔で再描画

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  // イベントハンドラの設定
  function setupEventHandlers() {
    const overlayContainer = overlayContainerRef.current;
    if (!overlayContainer) return;

    overlayContainer.eventMode = 'static';
    overlayContainer.cursor = 'pointer';
    
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

    // グローバル座標からコンテナのローカル座標に変換
    const localPos = mapContainerRef.current.toLocal(event.global);
    
    // スクリーン座標からアイソメトリック座標への変換（簡易版）
    const tileX = Math.floor((localPos.x / TILE_WIDTH * 2 + localPos.y / TILE_HEIGHT * 2) / 2);
    const tileY = Math.floor((localPos.y / TILE_HEIGHT * 2 - localPos.x / TILE_WIDTH * 2) / 2);
    
    const clickedPosition: Position = { x: tileX, y: tileY };
    const state = gameSystem.getState();
    
    // クリックされた位置のユニットを取得
    const units = state.units;
    const clickedUnit = units.find(unit => 
      unit.position.x === clickedPosition.x && unit.position.y === clickedPosition.y
    );

    if (clickedUnit) {
      // ユニットが選択された場合
      setSelectedUnitId(clickedUnit.id);
      showMoveRange(clickedUnit.id);
    } else if (selectedUnitId) {
      // 選択されたユニットがあり、空のタイルがクリックされた場合は移動
      if (state.activeUnitId === selectedUnitId) {
        gameSystem.moveUnit(selectedUnitId, clickedPosition);
        setSelectedUnitId(null);
        clearMoveRange();
      }
    }
  }

  // 移動可能範囲の表示
  function showMoveRange(unitId: string) {
    const gameSystem = gameSystemRef.current;
    const overlayContainer = overlayContainerRef.current;
    if (!gameSystem || !overlayContainer) return;

    // 以前の移動範囲表示をクリア
    clearMoveRange();

    // 移動可能範囲を取得
    const movePositions = gameSystem.getUnitMoveRange(unitId);
    
    // 移動可能範囲を描画
    movePositions.forEach(position => {
      const { x, y } = isoToScreen(position);
      
      const rangeMarker = new PIXI.Graphics();
      rangeMarker.beginFill(0x00ff00, 0.3);
      rangeMarker.lineStyle(1, 0x00ff00, 0.8);
      rangeMarker.drawPolygon([
        -TILE_WIDTH / 2, 0,
        0, -TILE_HEIGHT / 2,
        TILE_WIDTH / 2, 0,
        0, TILE_HEIGHT / 2
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

    moveRangeRef.current.forEach(marker => {
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
    tiles.forEach(tile => {
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
          -TILE_WIDTH / 2, 0,
          -TILE_WIDTH / 2, TILE_HEIGHT_OFFSET * tile.height,
          0, TILE_HEIGHT / 2 + TILE_HEIGHT_OFFSET * tile.height,
          0, TILE_HEIGHT / 2
        ]);
        tileGraphic.endFill();

        tileGraphic.beginFill(0x555577);
        tileGraphic.lineStyle(1, 0x333355, 1);
        tileGraphic.drawPolygon([
          TILE_WIDTH / 2, 0,
          TILE_WIDTH / 2, TILE_HEIGHT_OFFSET * tile.height,
          0, TILE_HEIGHT / 2 + TILE_HEIGHT_OFFSET * tile.height,
          0, TILE_HEIGHT / 2
        ]);
        tileGraphic.endFill();
      }
      
      // タイルの上面
      tileGraphic.beginFill(tile.passable ? 0x88aaff : 0x884444);
      tileGraphic.lineStyle(1, 0x333355, 1);
      tileGraphic.drawPolygon([
        -TILE_WIDTH / 2, 0,
        0, -TILE_HEIGHT / 2,
        TILE_WIDTH / 2, 0,
        0, TILE_HEIGHT / 2
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
      if (!state.units.some(unit => unit.id === id)) {
        unitContainer.removeChild(graphic);
        graphic.destroy();
        unitsRef.current.delete(id);
      }
    });

    // ユニットの描画
    state.units.forEach(unit => {
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
      const borderColor = isSelected ? 0xffff00 : (isActive ? 0x00ffff : 0x000000);
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
      unitGraphic.drawRect(-TILE_WIDTH / 5, -TILE_HEIGHT / 2, (TILE_WIDTH / 2.5) * ctRatio, 5);
      unitGraphic.endFill();

      // HPバーの描画
      const hpRatio = unit.stats.hp / unit.stats.maxHp;
      unitGraphic.beginFill(0x44ff44, 0.8);
      unitGraphic.lineStyle(1, 0x000000, 0.8);
      unitGraphic.drawRect(-TILE_WIDTH / 5, -TILE_HEIGHT / 2 + 7, (TILE_WIDTH / 2.5) * hpRatio, 5);
      unitGraphic.endFill();
    });
  }

  return { selectedUnitId, setSelectedUnitId };
}