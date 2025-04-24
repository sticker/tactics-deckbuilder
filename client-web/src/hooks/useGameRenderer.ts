import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { GameSystem, BattleState, Position, Unit } from 'game-logic';
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

    // ヒットエリアを拡大して全体をカバー
    const hitArea = new PIXI.Graphics();
    hitArea.beginFill(0xffffff, 0.001); // ほぼ透明
    hitArea.drawRect(-2000, -2000, 4000, 4000); // 十分な大きさ
    hitArea.endFill();
    overlayContainer.addChild(hitArea);

    // イベントリスナーを設定
    overlayContainer.on('pointerdown', handleMapClick);

    // ホバーイベントも設定
    overlayContainer.on('pointerdown', handleMapClick);
    overlayContainer.on('pointermove', handleMouseMove);
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

    overlayContainer.off('pointerdown', handleMapClick);
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
      // 既に選択されているユニットを再度クリックした場合は選択解除
      if (selectedUnitIdRef.current === clickedUnit.id) {
        console.log('ユニット選択を解除します');
        clearMoveRange();
        setSelectedUnitId(null);
        return;
      }

      console.log('ユニットが選択されました:', clickedUnit.id);
      // 既存の選択をクリア
      clearMoveRange();
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
            // ユニット移動を実行する前に、フラグを設定して選択解除中であることを記録
            const movingUnitId = currentSelectedId;

            // まず選択状態をクリア（重要: 移動前に行う）
            setSelectedUnitId(null);
            clearMoveRange();

            // 少し遅延させてから移動処理を実行（重要）
            setTimeout(() => {
              const success = gameSystem.moveUnit(
                movingUnitId,
                clickedPosition
              );
              if (success) {
                console.log('移動成功');

                // 選択状態が再度設定されないように防止策を追加
                // （この時点で選択状態は既にnullになっているはず）
                if (selectedUnitIdRef.current === movingUnitId) {
                  setSelectedUnitId(null);
                }
              }
            }, 50);
          } catch (error) {
            console.error('移動エラー:', error);
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
          setSelectedUnitId(null);
        }
      } else if (moveRangeRef.current.length > 0) {
        // 選択されたユニットがない状態でもし移動範囲表示が残っていれば消去
        clearMoveRange();
      }
    } else {
      console.log('クリック位置がマップ範囲外です');
      // マップ範囲外をクリックした場合も選択解除
      if (selectedUnitIdRef.current || moveRangeRef.current.length > 0) {
        clearMoveRange();
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

  return { selectedUnitId, setSelectedUnitId };
}
