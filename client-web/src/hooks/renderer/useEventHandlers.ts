// src/hooks/renderer/useEventHandlers.ts
import { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { GameSystem, Position, Unit, BattleState } from 'game-logic';
import {
  isoToScreen,
  screenToIso,
  isTileHit,
} from '../../utils/isoConversion';
import { findPath } from '../../utils/pathfinding';
import {
  TILE_HEIGHT,
  UNIT_HIT_RADIUS,
  UNIT_MOVE_STEP_DURATION,
} from '../../utils/constants';

// window拡張の型定義
declare global {
  interface Window {
    showGameNotification?: (message: string) => void;
  }
}

/**
 * イベントハンドラフック
 */
export function useEventHandlers(
  gameSystemRef: React.RefObject<GameSystem | null>,
  overlayContainerRef: React.RefObject<PIXI.Container | null>,
  mapContainerRef: React.RefObject<PIXI.Container | null>,
  unitContainerRef: React.RefObject<PIXI.Container | null>,
  selectedUnitId: string | null,
  setSelectedUnitId: (id: string | null) => void,
  currentActionType: string | null,
  moveUnit?: (unitId: string, targetPosition: Position) => void,
  executeAction?: (
    sourceUnitId: string,
    targetUnitId: string,
    targetPosition: Position,
    actionType: string
  ) => void,
  showMoveRange?: (unitId: string) => void,
  clearMoveRange?: () => void,
  _showActionRange?: (
    unitId: string,
    actionType: string,
    range: number
  ) => void,
  clearActionRange?: () => void,
  clearAllRanges?: () => void,
  startMoveAnimation?: (
    unitId: string,
    path: Position[],
    duration: number,
    onComplete?: () => void
  ) => void
) {
  // 選択中のユニットIDへの参照
  const selectedUnitIdRef = useRef<string | null>(selectedUnitId);

  // アクションタイプへの参照
  const currentActionTypeRef = useRef<string | null>(currentActionType);

  // ドラッグ関連の状態変数
  const isDraggingRef = useRef<boolean>(false);
  const dragStartX = useRef<number>(0);
  const dragStartY = useRef<number>(0);
  const lastX = useRef<number>(0);
  const lastY = useRef<number>(0);

  // ヒットエリアの参照
  const hitAreaRef = useRef<PIXI.Graphics | null>(null);

  // イベントが設定済みかどうかのフラグ
  const eventsSetupRef = useRef<boolean>(false);

  // 値が変わったら参照を更新
  useEffect(() => {
    selectedUnitIdRef.current = selectedUnitId;
  }, [selectedUnitId]);

  useEffect(() => {
    currentActionTypeRef.current = currentActionType;
  }, [currentActionType]);

  /**
   * イベントハンドラの設定
   */
  useEffect(() => {
    // コンテナが存在し、イベントが未設定の場合のみセットアップを実行
    if (overlayContainerRef.current && !eventsSetupRef.current) {
      console.log('イベントハンドラをセットアップしています...');
      setupEventHandlers();
      eventsSetupRef.current = true;
    }

    return () => {
      if (eventsSetupRef.current) {
        console.log('イベントハンドラをクリーンアップしています...');
        cleanupEventHandlers();
        eventsSetupRef.current = false;
      }
    };
  }, [overlayContainerRef.current]); // 依存配列を最小限に

  /**
   * イベントハンドラの設定
   */
  const setupEventHandlers = () => {
    const overlayContainer = overlayContainerRef.current;
    if (!overlayContainer) {
      console.error('オーバーレイコンテナが存在しません');
      return;
    }

    console.log('イベントハンドラを設定中...');

    try {
      // コンテナをインタラクティブに設定
      overlayContainer.eventMode = 'static';
      overlayContainer.cursor = 'pointer';

      // ヒットエリアが既に存在する場合は削除
      if (
        hitAreaRef.current &&
        overlayContainer.children.includes(hitAreaRef.current)
      ) {
        overlayContainer.removeChild(hitAreaRef.current);
        hitAreaRef.current.destroy();
      }

      // ヒットエリアを拡大して全体をカバー
      const hitArea = new PIXI.Graphics();
      hitArea.beginFill(0xffffff, 0.001); // ほぼ透明
      hitArea.drawRect(-2000, -2000, 4000, 4000); // 十分な大きさ
      hitArea.endFill();
      overlayContainer.addChild(hitArea);
      hitAreaRef.current = hitArea;

      // イベントリスナーを設定
      overlayContainer.on('pointerdown', handlePointerDown);
      overlayContainer.on('pointermove', handlePointerMove);
      overlayContainer.on('pointerup', handlePointerUp);
      overlayContainer.on('pointerupoutside', handlePointerUpOutside);

      // カメラ操作でのコンテキストメニュー抑制
      window.addEventListener('contextmenu', handleContextMenu);

      console.log('イベントハンドラの設定が完了しました');
    } catch (error) {
      console.error('イベントハンドラの設定中にエラーが発生しました:', error);
    }
  };

  /**
   * イベントハンドラのクリーンアップ
   */
  const cleanupEventHandlers = () => {
    const overlayContainer = overlayContainerRef.current;
    if (!overlayContainer) return;

    try {
      // すべてのイベントリスナーを削除
      overlayContainer.off('pointerdown', handlePointerDown);
      overlayContainer.off('pointermove', handlePointerMove);
      overlayContainer.off('pointerup', handlePointerUp);
      overlayContainer.off('pointerupoutside', handlePointerUpOutside);

      // ヒットエリアを削除
      if (
        hitAreaRef.current &&
        overlayContainer.children.includes(hitAreaRef.current)
      ) {
        overlayContainer.removeChild(hitAreaRef.current);
        hitAreaRef.current.destroy();
        hitAreaRef.current = null;
      }

      // コンテキストメニュー抑制の解除
      window.removeEventListener('contextmenu', handleContextMenu);
    } catch (error) {
      console.error(
        'イベントハンドラのクリーンアップ中にエラーが発生しました:',
        error
      );
    }
  };

  /**
   * コンテキストメニューの抑制
   */
  const handleContextMenu = (e: MouseEvent) => {
    if (isDraggingRef.current) {
      e.preventDefault();
    }
  };

  /**
   * マウスダウン時の処理
   */
  const handlePointerDown = (event: PIXI.FederatedPointerEvent) => {
    try {
      console.log('pointerdown イベント発生:', event.button, event.global);

      // 右クリックまたは中クリックの場合はドラッグモードを開始
      if (event.button === 2 || event.button === 1) {
        isDraggingRef.current = true;
        dragStartX.current = event.global.x;
        dragStartY.current = event.global.y;
        lastX.current = dragStartX.current;
        lastY.current = dragStartY.current;

        // ドラッグ中はカーソルを変更
        if (overlayContainerRef.current) {
          overlayContainerRef.current.cursor = 'grabbing';
        }

        // デフォルトの右クリックメニューを抑制
        event.preventDefault?.();
        return;
      }

      // 左クリックの場合は通常のマップクリック処理
      handleMapClick(event);
    } catch (error) {
      console.error('pointerdown イベント処理中にエラーが発生しました:', error);
    }
  };

  /**
   * マウス移動時の処理
   */
  const handlePointerMove = (event: PIXI.FederatedPointerEvent) => {
    try {
      if (
        isDraggingRef.current &&
        mapContainerRef.current &&
        unitContainerRef.current &&
        overlayContainerRef.current
      ) {
        // ドラッグ中の処理
        const dx = event.global.x - lastX.current;
        const dy = event.global.y - lastY.current;

        // すべてのコンテナを同時に移動
        mapContainerRef.current.position.x += dx;
        mapContainerRef.current.position.y += dy;
        unitContainerRef.current.position.x += dx;
        unitContainerRef.current.position.y += dy;
        overlayContainerRef.current.position.x += dx;
        overlayContainerRef.current.position.y += dy;

        // 現在位置を更新
        lastX.current = event.global.x;
        lastY.current = event.global.y;
      } else {
        // 通常のマウスホバー処理
        handleMouseMove(event);
      }
    } catch (error) {
      console.error('pointermove イベント処理中にエラーが発生しました:', error);
    }
  };

  /**
   * マウスアップ時の処理
   */
  const handlePointerUp = (_event: PIXI.FederatedPointerEvent) => {
    try {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        if (overlayContainerRef.current) {
          overlayContainerRef.current.cursor = 'pointer';
        }
      }
    } catch (error) {
      console.error('pointerup イベント処理中にエラーが発生しました:', error);
    }
  };

  /**
   * マウスが領域外に出た時の処理
   */
  const handlePointerUpOutside = (_event: PIXI.FederatedPointerEvent) => {
    try {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        if (overlayContainerRef.current) {
          overlayContainerRef.current.cursor = 'pointer';
        }
      }
    } catch (error) {
      console.error(
        'pointerupoutside イベント処理中にエラーが発生しました:',
        error
      );
    }
  };

  /**
   * マウスホバー時の処理
   */
  const handleMouseMove = (event: PIXI.FederatedPointerEvent) => {
    const gameSystem = gameSystemRef.current;
    if (!gameSystem || !mapContainerRef.current) return;

    try {
      const localPos = mapContainerRef.current.toLocal(event.global);

      // ユニット上にマウスがあるかチェック
      const unitUnderMouse = findUnitUnderClick(
        localPos.x,
        localPos.y,
        gameSystem.getState()
      );

      // カーソルスタイルを更新
      updateCursorStyle(unitUnderMouse, localPos, gameSystem.getState());
    } catch (error) {
      console.error('マウスムーブ処理中にエラーが発生しました:', error);
    }
  };

  /**
   * カーソルスタイルの更新
   */
  const updateCursorStyle = (
    unitUnderMouse: Unit | undefined,
    localPos: PIXI.Point,
    state: BattleState
  ) => {
    if (!overlayContainerRef.current) return;

    // ユニット上ならポインタをカーソルに変更
    if (unitUnderMouse) {
      overlayContainerRef.current.cursor = 'pointer';
    } else {
      // タイル上なら選択可能かどうかでカーソルを変更
      const position = screenToIso(localPos.x, localPos.y);
      if (isValidTilePosition(position, state)) {
        overlayContainerRef.current.cursor = 'pointer';
      } else {
        overlayContainerRef.current.cursor = 'default';
      }
    }
  };

  /**
   * タイル位置が有効かチェック
   */
  const isValidTilePosition = (
    position: Position,
    state: BattleState
  ): boolean => {
    return (
      position.x >= 0 &&
      position.y >= 0 &&
      position.x < state.map.getWidth() &&
      position.y < state.map.getHeight()
    );
  };

  /**
   * クリック位置のユニットを見つける
   */
  const findUnitUnderClick = (
    x: number,
    y: number,
    state: BattleState
  ): Unit | undefined => {
    return state.units.find((unit) => {
      const tile = state.map.getTile(unit.position);
      const height = tile ? tile.height : 0;
      const { x: unitX, y: unitY } = isoToScreen(unit.position, height);

      // ユニットの表示サイズを考慮した判定エリア
      const hitRadius = UNIT_HIT_RADIUS;
      const dx = x - unitX;
      const dy = y - unitY + TILE_HEIGHT / 4; // 少し上方向にオフセット

      // 円形の当たり判定
      return dx * dx + dy * dy <= hitRadius * hitRadius;
    });
  };

  /**
   * マップクリック処理
   */
  const handleMapClick = (event: PIXI.FederatedPointerEvent) => {
    const gameSystem = gameSystemRef.current;
    if (!gameSystem || !mapContainerRef.current) return;

    console.log('マップクリック処理開始');

    try {
      // グローバル座標からコンテナのローカル座標に変換
      const localPos = mapContainerRef.current.toLocal(event.global);
      console.log('ローカル座標:', localPos.x, localPos.y);

      // 1. まずユニットのクリック判定
      const clickedUnit = findUnitUnderClick(
        localPos.x,
        localPos.y,
        gameSystem.getState()
      );

      if (clickedUnit) {
        console.log('ユニットがクリックされました:', clickedUnit.id);
        handleUnitClick(clickedUnit);
        return;
      }

      // 2. ユニットがクリックされていない場合、タイルのクリック判定を行う
      const clickedTile = findTileUnderClick(localPos, gameSystem.getState());
      if (clickedTile) {
        console.log('タイルがクリックされました:', clickedTile.position);
        handleTileClick(clickedTile.position);
        return;
      }

      // 3. マップ範囲外のクリック
      console.log('マップ範囲外がクリックされました');
      handleOutOfMapClick();
    } catch (error) {
      console.error('マップクリック処理中にエラーが発生しました:', error);
    }
  };

  /**
   * クリック位置のタイルを見つける
   */
  const findTileUnderClick = (
    localPos: PIXI.Point,
    state: BattleState
  ): { position: Position; height: number } | null => {
    try {
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
        return {
          position: closestTile.position,
          height: closestTile.height,
        };
      }
    } catch (error) {
      console.error('タイル検索中にエラーが発生しました:', error);
    }

    return null;
  };

  // src/hooks/renderer/useEventHandlers.ts の修正部分

  // アクション実行の処理
  const handleActionClick = (targetUnitId: string) => {
    if (!gameSystemRef.current || !selectedUnitId || !currentActionType) return;

    console.log(
      `アクション実行: ${currentActionType} ${selectedUnitId} ${targetUnitId}`
    );

    const gameSystem = gameSystemRef.current;
    const state = gameSystem.getState();

    // 対象ユニットの位置を取得
    const targetUnit = state.units.find((unit) => unit.id === targetUnitId);
    if (!targetUnit) {
      console.error('対象ユニットが見つかりません');
      return;
    }

    // executeAction関数を呼び出し
    if (executeAction) {
      executeAction(
        selectedUnitId,
        targetUnitId,
        targetUnit.position, // ユニットの位置情報も渡す
        currentActionType
      );
    }
  };

  // ユニットクリック時の処理
  const handleUnitClick = (clickedUnit: Unit) => {
    // 既に選択されているユニットがあり、アクションが選択されている場合
    if (selectedUnitId && currentActionType && currentActionType !== 'move') {
      console.log('アクション対象が選択されました:', clickedUnit.id);

      // アクション実行処理に移行
      handleActionClick(clickedUnit.id);

      // アクション実行後、選択とアクション表示をクリア
      if (clearAllRanges) clearAllRanges();
      setSelectedUnitId(null);
      return;
    }

    // 既存の選択をクリア
    if (clearAllRanges) clearAllRanges();

    // ユニットを選択
    setSelectedUnitId(clickedUnit.id);

    // 移動範囲を表示
    if (showMoveRange) showMoveRange(clickedUnit.id);
  };

  /**
   * タイルクリック時の処理
   */
  const handleTileClick = (clickedPosition: Position) => {
    const gameSystem = gameSystemRef.current;
    if (!gameSystem) return;

    // 現在の選択状態をrefから安全に取得
    const currentSelectedId = selectedUnitIdRef.current;

    if (currentSelectedId) {
      handleSelectedUnitTileClick(currentSelectedId, clickedPosition);
    } else if (clearAllRanges) {
      // 選択されたユニットがない状態でもし範囲表示が残っていれば消去
      clearAllRanges();
    }
  };

  /**
   * 選択中のユニットがあるときのタイルクリック処理
   */
  const handleSelectedUnitTileClick = (
    unitId: string,
    clickedPosition: Position
  ) => {
    const gameSystem = gameSystemRef.current;
    if (!gameSystem) return;

    const state = gameSystem.getState();

    // 選択中のユニットとアクティブユニットをチェック
    const selectedUnit = state.units.find((unit) => unit.id === unitId);
    const isActiveUnit = selectedUnit && state.activeUnitId === unitId;

    if (!selectedUnit) {
      console.log('選択されたユニットが見つかりません');
      if (clearAllRanges) clearAllRanges();
      setSelectedUnitId(null);
      return;
    }

    // 現在のアクションタイプをチェック
    if (
      currentActionTypeRef.current === 'move' ||
      currentActionTypeRef.current === null
    ) {
      handleMoveAction(selectedUnit, clickedPosition, isActiveUnit as boolean);
    } else {
      // 移動以外のアクションの場合、クリックで選択解除
      if (clearAllRanges) clearAllRanges();
      setSelectedUnitId(null);
    }
  };

  // 移動アクション処理
  const handleMoveAction = (
    unit: Unit,
    targetPosition: Position,
    isActiveUnit: boolean
  ) => {
    const gameSystem = gameSystemRef.current;
    if (!gameSystem) return;

    console.log('移動処理開始:', {
      unitId: unit.id,
      isActive: isActiveUnit,
      targetPos: targetPosition,
    });

    // 移動可能範囲をチェック
    const movePositions = gameSystem.getUnitMoveRange(unit.id);
    console.log('移動可能範囲:', movePositions.length, '箇所');

    // 移動可能範囲内かチェック
    const canMoveToPosition = movePositions.some(
      (pos) => pos.x === targetPosition.x && pos.y === targetPosition.y
    );

    console.log('移動可能判定:', canMoveToPosition);

    if (isActiveUnit && canMoveToPosition) {
      executeUnitMove(unit.id, targetPosition);
    } else {
      // 移動できない場合は選択解除
      if (!isActiveUnit) {
        console.log('このユニットは現在行動できません');
        if (window.showGameNotification) {
          window.showGameNotification('このユニットは現在行動できません');
        }
      }
      if (!canMoveToPosition) {
        console.log('選択された位置は移動可能範囲外です');
        if (window.showGameNotification) {
          window.showGameNotification('移動可能範囲外です');
        }
      }

      // 選択を解除
      if (clearAllRanges) clearAllRanges();
      setSelectedUnitId(null);
    }
  };

  /**
   * ユニット移動の実行
   */
  const executeUnitMove = (unitId: string, targetPosition: Position) => {
    const gameSystem = gameSystemRef.current;
    if (!gameSystem || !startMoveAnimation) return;

    console.log(`ユニット ${unitId} を移動します:`, targetPosition);

    try {
      // 選択解除中であることを記録
      const unit = gameSystem.getState().units.find((u) => u.id === unitId);

      if (!unit) {
        console.error('移動するユニットが見つかりません');
        return;
      }

      // まず選択状態をクリア
      setSelectedUnitId(null);
      if (clearAllRanges) clearAllRanges();

      // パスを計算
      const path = findPath(
        gameSystem.getState(),
        unit.position,
        targetPosition
      );

      // パスが有効なら移動アニメーションを開始
      if (path && path.length > 0) {
        // アニメーション時間を計算（パスの長さに基づく、ただし上限あり）
        const animationDuration = Math.min(
          path.length * UNIT_MOVE_STEP_DURATION,
          800
        );

        // アニメーション開始
        startMoveAnimation(unitId, path, animationDuration, () => {
          // アニメーション完了後に実際のゲームロジックでユニットを移動
          const success = gameSystem.moveUnit(unitId, targetPosition);

          if (success) {
            console.log('移動成功');
            if (window.showGameNotification) {
              window.showGameNotification('移動完了');
            }

            // 必要に応じてサーバーに移動を通知
            if (moveUnit) {
              moveUnit(unitId, targetPosition);
            }
          } else {
            console.error('移動ロジックの実行に失敗');
            if (window.showGameNotification) {
              window.showGameNotification('移動に失敗しました');
            }
          }
        });
      } else {
        console.error('有効なパスが生成されませんでした');
        if (window.showGameNotification) {
          window.showGameNotification('移動経路を見つけられませんでした');
        }
      }
    } catch (error) {
      console.error('移動処理エラー:', error);
    }
  };

  /**
   * マップ範囲外クリック時の処理
   */
  const handleOutOfMapClick = () => {
    console.log('クリック位置がマップ範囲外です');
    // 選択解除
    if (
      selectedUnitIdRef.current ||
      (clearAllRanges && (clearMoveRange || clearActionRange))
    ) {
      if (clearAllRanges) clearAllRanges();
      setSelectedUnitId(null);
    }
  };

  // 外部に公開する関数
  return {
    handleMapClick,
    findUnitUnderClick,
    setupEventHandlers, // 明示的に再セットアップできるように公開
    cleanupEventHandlers,
  };
}
