// src/hooks/renderer/useCamera.ts
import { useRef, useEffect } from 'react';
import * as PIXI from 'pixi.js';
import { Unit } from 'game-logic';
import { isoToScreen } from '../../utils/isoConversion';
import { CAMERA_PAN_DURATION } from '../../utils/constants';

type ContainersRef = {
  mapContainer: React.RefObject<PIXI.Container | null>;
  unitContainer: React.RefObject<PIXI.Container | null>;
  overlayContainer: React.RefObject<PIXI.Container | null>;
};

/**
 * カメラ制御フック
 */
export function useCamera(
  appRef: React.RefObject<PIXI.Application | null>,
  containers: ContainersRef
) {
  // カメラアニメーション用の状態
  const cameraAnimationRef = useRef<number | null>(null);
  const cameraPanStartTimeRef = useRef<number>(0);
  const cameraPanDurationRef = useRef<number>(CAMERA_PAN_DURATION);
  const cameraPanStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cameraPanTargetPosRef = useRef<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  // コンポーネントのアンマウント時にカメラアニメーションを停止
  useEffect(() => {
    return () => {
      if (cameraAnimationRef.current !== null) {
        cancelAnimationFrame(cameraAnimationRef.current);
        cameraAnimationRef.current = null;
      }
    };
  }, []);

  /**
   * コンテナの位置を更新
   * @param x X座標
   * @param y Y座標
   */
  const updateContainerPositions = (x: number, y: number) => {
    const { mapContainer, unitContainer, overlayContainer } = containers;

    if (mapContainer.current) {
      mapContainer.current.position.set(x, y);
    }

    if (unitContainer.current) {
      unitContainer.current.position.set(x, y);
    }

    if (overlayContainer.current) {
      overlayContainer.current.position.set(x, y);
    }
  };

  /**
   * コンテナの位置を画面中央に再設定
   */
  const centerCamera = () => {
    const app = appRef.current;
    if (!app) return;

    const centerX = app.screen.width / 2;
    const centerY = app.screen.height * 0.3; // 画面の上から30%の位置に配置

    updateContainerPositions(centerX, centerY);
  };

  /**
   * カメラをユニットの位置にパンする
   * @param unit 対象ユニット
   * @param tileHeight タイルの高さ
   */
  const panCameraToUnit = (unit: Unit, tileHeight: number = 0) => {
    const app = appRef.current;
    if (!app || !containers.mapContainer.current) return;

    // 現在実行中のカメラアニメーションがあれば停止
    if (cameraAnimationRef.current !== null) {
      cancelAnimationFrame(cameraAnimationRef.current);
      cameraAnimationRef.current = null;
    }

    // ユニットの画面座標を計算
    const unitScreenPos = isoToScreen(unit.position, tileHeight);

    // 現在のカメラ位置（コンテナの中心位置）
    const currentCenterX = app.screen.width / 2;
    const currentCenterY = app.screen.height * 0.3;

    // 現在のマップコンテナのオフセット
    const currentOffsetX =
      containers.mapContainer.current.position.x - currentCenterX;
    const currentOffsetY =
      containers.mapContainer.current.position.y - currentCenterY;

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
    const animateCameraPan = (timestamp: number) => {
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
      updateContainerPositions(
        currentCenterX + newOffsetX,
        currentCenterY + newOffsetY
      );

      // アニメーションが完了していなければ続行
      if (progress < 1) {
        cameraAnimationRef.current = requestAnimationFrame(animateCameraPan);
      } else {
        cameraAnimationRef.current = null;
      }
    };

    // アニメーション開始
    cameraAnimationRef.current = requestAnimationFrame(animateCameraPan);
  };

  /**
   * カメラを指定位置に移動
   * @param screenX スクリーンX座標
   * @param screenY スクリーンY座標
   * @param useAnimation アニメーションするか
   */
  const moveCamera = (
    screenX: number,
    screenY: number,
    useAnimation: boolean = true
  ) => {
    const app = appRef.current;
    if (!app) return;

    const { mapContainer, unitContainer, overlayContainer } = containers;

    if (!useAnimation) {
      // アニメーションしない場合は直接移動
      if (mapContainer.current) mapContainer.current.position.x += screenX;
      if (mapContainer.current) mapContainer.current.position.y += screenY;
      if (unitContainer.current) unitContainer.current.position.x += screenX;
      if (unitContainer.current) unitContainer.current.position.y += screenY;
      if (overlayContainer.current)
        overlayContainer.current.position.x += screenX;
      if (overlayContainer.current)
        overlayContainer.current.position.y += screenY;
      return;
    }

    // アニメーションを使う場合
    const currentX = mapContainer.current?.position.x || 0;
    const currentY = mapContainer.current?.position.y || 0;

    // アニメーションの設定
    cameraPanStartPosRef.current = { x: currentX, y: currentY };
    cameraPanTargetPosRef.current = {
      x: currentX + screenX,
      y: currentY + screenY,
    };
    cameraPanStartTimeRef.current = performance.now();

    // 現在実行中のアニメーションがあれば停止
    if (cameraAnimationRef.current !== null) {
      cancelAnimationFrame(cameraAnimationRef.current);
    }

    // アニメーション関数
    const animateCameraMove = (timestamp: number) => {
      const elapsed = timestamp - cameraPanStartTimeRef.current;
      const progress = Math.min(elapsed / cameraPanDurationRef.current, 1);

      // イージング関数
      const smoothProgress = progress * progress * (3 - 2 * progress);

      // 新しい位置を計算
      const newX =
        cameraPanStartPosRef.current.x +
        (cameraPanTargetPosRef.current.x - cameraPanStartPosRef.current.x) *
          smoothProgress;
      const newY =
        cameraPanStartPosRef.current.y +
        (cameraPanTargetPosRef.current.y - cameraPanStartPosRef.current.y) *
          smoothProgress;

      // 位置を更新
      updateContainerPositions(newX, newY);

      // アニメーションが完了するまで繰り返し
      if (progress < 1) {
        cameraAnimationRef.current = requestAnimationFrame(animateCameraMove);
      } else {
        cameraAnimationRef.current = null;
      }
    };

    // アニメーション開始
    cameraAnimationRef.current = requestAnimationFrame(animateCameraMove);
  };

  /**
   * カメラズーム（未実装）
   * 必要に応じて実装できます
   */
  const zoomCamera = (scale: number) => {
    // 将来的な拡張のためのプレースホルダー
    console.log('カメラズーム機能は未実装です:', scale);
  };

  return {
    centerCamera,
    panCameraToUnit,
    moveCamera,
    zoomCamera,
    updateContainerPositions,
  };
}
