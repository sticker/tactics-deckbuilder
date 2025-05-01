// src/components/GameUI.tsx
import React, { useEffect, useState, memo } from 'react';
import { GameSystem } from 'game-logic';
import { AbilityType } from 'game-logic/src/models/Ability';
import { ActionState } from 'game-logic/src/models/Unit';

// グローバルの通知関数定義
declare global {
  interface Window {
    showGameNotification?: (message: string) => void;
  }
}

// UIコンポーネントのプロパティ定義
interface GameUIProps {
  gameSystem: GameSystem | null;
  selectedUnitId: string | null;
  connectionState: {
    connected: boolean;
    teamId: number | null;
    error: string | null;
  };
  onActionSelect?: (abilityId: string, unitId: string) => void;
  currentAbilityId?: string | null;
}

// アビリティカードコンポーネント
interface AbilityCardProps {
  ability: any; // 型エラーを避けるため一時的にany型に変更
  isSelected: boolean;
  isDisabled: boolean;
  onClick: () => void;
}

const AbilityCard: React.FC<AbilityCardProps> = ({
  ability,
  isSelected,
  isDisabled,
  onClick,
}) => {
  // アビリティの種類に応じた色を設定
  let typeColor = 'text-gray-300';
  if (ability.type === AbilityType.WEAPON) typeColor = 'text-red-300';
  else if (ability.type === AbilityType.MAGIC) typeColor = 'text-blue-300';
  else if (ability.type === AbilityType.ITEM) typeColor = 'text-green-300';

  return (
    <div
      onClick={isDisabled ? undefined : onClick}
      className={`w-20 h-28 rounded ${
        isSelected
          ? 'bg-indigo-700 border-indigo-500'
          : 'bg-gray-800 border-gray-700'
      } border flex flex-col items-center justify-center cursor-pointer transition-colors ${
        isDisabled ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      <div className='w-12 h-12 bg-gray-700 rounded-full mb-1 flex items-center justify-center'>
        <span className={`text-lg font-bold ${typeColor}`}>
          {/* アビリティアイコンの頭文字 */}
          {ability.name.charAt(0)}
        </span>
      </div>
      <span className={`text-xs font-bold ${typeColor}`}>{ability.name}</span>
      <span className='text-xs text-gray-400 mt-1'>
        {ability.type === AbilityType.WEAPON
          ? `攻:${ability.power}`
          : ability.type === AbilityType.MAGIC
          ? `MP:${ability.mpCost}`
          : `回:${ability.power}`}
      </span>
      <span className='text-xs text-gray-400'>射程:{ability.range}</span>
    </div>
  );
};

// メインコンポーネント
const GameUI: React.FC<GameUIProps> = memo(
  ({
    gameSystem,
    selectedUnitId,
    connectionState,
    onActionSelect,
    currentAbilityId,
  }) => {
    if (!gameSystem) return null;

    const state = gameSystem.getState();
    const selectedUnit = state.units.find((unit) => unit.id === selectedUnitId);
    const activeUnit = state.units.find(
      (unit) => unit.id === state.activeUnitId
    );
    const [notification, setNotification] = useState<string | null>(null);

    // ユニットのアビリティ一覧を取得
    const getUnitAbilities = () => {
      if (!selectedUnit) return [];

      const allAbilities = gameSystem.getAllAbilities();
      const result: any[] = []; // 型エラーを避けるため一時的にany[]型に変更

      // 武器アビリティを追加
      if (
        selectedUnit.equippedAbilities.weapon &&
        allAbilities[selectedUnit.equippedAbilities.weapon]
      ) {
        result.push(allAbilities[selectedUnit.equippedAbilities.weapon]);
      }

      // 魔法アビリティを追加
      selectedUnit.equippedAbilities.magic.forEach((magicId) => {
        if (allAbilities[magicId]) {
          result.push(allAbilities[magicId]);
        }
      });

      // アイテムアビリティを追加
      selectedUnit.equippedAbilities.item.forEach((itemId) => {
        if (allAbilities[itemId]) {
          result.push(allAbilities[itemId]);
        }
      });

      return result;
    };

    // アビリティ一覧
    const availableAbilities = getUnitAbilities();

    // アクション選択時の処理
    const handleActionSelect = (abilityId: string) => {
      // 選択済みのアクションを再度クリックした場合は選択解除
      if (currentAbilityId === abilityId) {
        if (onActionSelect && selectedUnitId) {
          onActionSelect('', selectedUnitId); // 空文字でアクション解除
        }
        return;
      }

      // アクション選択
      if (onActionSelect && selectedUnitId) {
        onActionSelect(abilityId, selectedUnitId);
      }
    };

    // 通知メッセージの表示
    useEffect(() => {
      if (notification) {
        const timer = setTimeout(() => {
          setNotification(null);
        }, 3000); // 3秒後に消える

        return () => clearTimeout(timer);
      }
    }, [notification]);

    // 通知表示関数をグローバルに公開
    useEffect(() => {
      window.showGameNotification = (message: string) => {
        setNotification(message);
      };

      return () => {
        delete window.showGameNotification;
      };
    }, []);

    // アクションボタンが使用可能かのチェック
    const isActionEnabled = (): boolean => {
      if (!selectedUnit || !activeUnit) return false;

      // 選択されたユニットが現在のアクティブユニットではない場合
      if (selectedUnit.id !== activeUnit.id) return false;

      // ユニットがすでにターン終了している場合
      if (selectedUnit.actionState === ActionState.TURN_ENDED) return false;

      // アクションを既に使用済みの場合
      if (selectedUnit.actionState === ActionState.ACTION_USED) return false;

      // ここでさらに詳細なチェックも可能（MPが足りているかなど）

      return true;
    };

    return (
      <>
        {/* 通知メッセージ */}
        {notification && (
          <div className='absolute top-12 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-900 bg-opacity-90 text-white px-5 py-3 rounded-md shadow-lg z-20 text-center'>
            {notification}
          </div>
        )}

        {/* 上部バー（左側） - ターン情報 */}
        <div className='absolute top-0 left-0 bg-gray-900 bg-opacity-90 text-white px-3 py-1 flex items-center z-10 rounded-br-md shadow-md'>
          <div className='flex items-center space-x-3'>
            <div className='pr-3'>
              <span className='text-xs text-gray-400 mr-1'>ターン:</span>
              <span className='font-bold'>{state.turnCount}</span>
            </div>

            <div>
              <span className='text-xs text-gray-400 mr-1'>ティック:</span>
              <span className='font-bold'>{state.tickCount}</span>
            </div>
          </div>
        </div>

        {/* 右上 - チーム情報 */}
        {connectionState.teamId !== null && (
          <div className='absolute top-0 right-0 bg-gray-900 bg-opacity-90 px-3 py-1 flex items-center z-10 rounded-bl-md shadow-md'>
            <div className='text-xs text-gray-400 mr-2'>チーム:</div>
            <div
              className={`font-bold flex items-center ${
                connectionState.teamId === 0 ? 'text-blue-300' : 'text-red-300'
              }`}
            >
              {connectionState.teamId === 0 ? '青' : '赤'}
              <div
                className={`ml-2 w-3 h-3 rounded-full ${
                  connectionState.teamId === 0 ? 'bg-blue-500' : 'bg-red-500'
                }`}
              ></div>
            </div>
          </div>
        )}

        {/* エラーメッセージ（必要な場合） */}
        {connectionState.error && (
          <div className='absolute top-12 left-0 bg-red-800 p-2 rounded text-white z-10 shadow-md'>
            {connectionState.error}
          </div>
        )}

        {/* 中央上部 - アクティブユニット情報 */}
        {activeUnit && (
          <div className='absolute top-12 left-1/2 transform -translate-x-1/2 bg-gray-900 bg-opacity-90 text-white px-3 py-1 flex items-center z-10 rounded-md shadow-md'>
            <div className='text-xs text-cyan-300 mr-2'>行動中:</div>
            <div className='font-bold'>{activeUnit.name}</div>
            <div
              className={`ml-2 w-3 h-3 rounded-full ${
                activeUnit.teamId === 0 ? 'bg-blue-500' : 'bg-red-500'
              }`}
            ></div>
          </div>
        )}

        {/* 選択ユニット情報 - 左側に配置、十分に下げる */}
        {selectedUnit && (
          <div className='absolute top-28 left-3 bg-gray-900 bg-opacity-90 rounded-md p-3 shadow-md border border-gray-700 z-10 w-48'>
            <div className='flex items-center mb-2'>
              <div
                className={`w-8 h-8 rounded-full ${
                  selectedUnit.teamId === 0 ? 'bg-blue-500' : 'bg-red-500'
                } flex items-center justify-center mr-2`}
              >
                <span className='text-white text-xs font-bold'>
                  {selectedUnit.job?.charAt(0) || '?'}
                </span>
              </div>
              <div>
                <div className='font-bold'>{selectedUnit.name}</div>
                <div className='text-xs text-gray-400'>{selectedUnit.job}</div>
              </div>
            </div>

            <div className='grid grid-cols-2 gap-2 mb-2'>
              <div>
                <div className='text-xs text-gray-400'>HP</div>
                <div className='relative h-3 bg-gray-800 rounded-full overflow-hidden'>
                  <div
                    className='absolute top-0 left-0 h-full bg-green-500'
                    style={{
                      width: `${
                        (selectedUnit.stats.hp / selectedUnit.stats.maxHp) * 100
                      }%`,
                    }}
                  ></div>
                </div>
                <div className='text-xs'>
                  {selectedUnit.stats.hp}/{selectedUnit.stats.maxHp}
                </div>
              </div>

              <div>
                <div className='text-xs text-gray-400'>MP</div>
                <div className='relative h-3 bg-gray-800 rounded-full overflow-hidden'>
                  <div
                    className='absolute top-0 left-0 h-full bg-blue-500'
                    style={{
                      width: `${
                        (selectedUnit.stats.mp / selectedUnit.stats.maxMp) * 100
                      }%`,
                    }}
                  ></div>
                </div>
                <div className='text-xs'>
                  {selectedUnit.stats.mp}/{selectedUnit.stats.maxMp}
                </div>
              </div>
            </div>

            <div className='mb-2'>
              <div className='text-xs text-gray-400'>CT</div>
              <div className='relative h-3 bg-gray-800 rounded-full overflow-hidden'>
                <div
                  className='absolute top-0 left-0 h-full bg-yellow-500'
                  style={{ width: `${(selectedUnit.stats.ct / 100) * 100}%` }}
                ></div>
              </div>
              <div className='text-xs'>
                {Math.floor(selectedUnit.stats.ct)}/100
              </div>
            </div>

            <div className='grid grid-cols-3 gap-1 text-xs'>
              <div>
                <span className='text-gray-400'>攻撃:</span>
                <span className='font-bold ml-1'>{selectedUnit.stats.atk}</span>
              </div>
              <div>
                <span className='text-gray-400'>防御:</span>
                <span className='font-bold ml-1'>{selectedUnit.stats.def}</span>
              </div>
              <div>
                <span className='text-gray-400'>魔力:</span>
                <span className='font-bold ml-1'>{selectedUnit.stats.mag}</span>
              </div>
              <div>
                <span className='text-gray-400'>抵抗:</span>
                <span className='font-bold ml-1'>{selectedUnit.stats.res}</span>
              </div>
              <div>
                <span className='text-gray-400'>速度:</span>
                <span className='font-bold ml-1'>{selectedUnit.stats.spd}</span>
              </div>
              <div>
                <span className='text-gray-400'>移動:</span>
                <span className='font-bold ml-1'>{selectedUnit.stats.mov}</span>
              </div>
            </div>

            <div className='mt-2 text-xs'>
              <span className='text-gray-400'>状態: </span>
              <span
                className={`font-bold ${
                  selectedUnit.actionState === ActionState.IDLE
                    ? 'text-green-300'
                    : selectedUnit.actionState === ActionState.MOVED
                    ? 'text-yellow-300'
                    : selectedUnit.actionState === ActionState.ACTION_USED
                    ? 'text-orange-300'
                    : 'text-red-300'
                }`}
              >
                {selectedUnit.actionState === ActionState.IDLE
                  ? '待機中'
                  : selectedUnit.actionState === ActionState.MOVED
                  ? '移動済'
                  : selectedUnit.actionState === ActionState.ACTION_USED
                  ? 'アクション済'
                  : 'ターン終了'}
              </span>
            </div>
          </div>
        )}

        {/* アクションエリア - 底部中央に配置 */}
        <div className='absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-900 bg-opacity-90 px-3 py-2 rounded-md shadow-md z-10'>
          <div className='text-xs text-center mb-2 text-gray-400'>
            アクション
          </div>
          <div className='flex space-x-2 justify-center'>
            {availableAbilities.length > 0 ? (
              <>
                {availableAbilities.map((ability) => (
                  <AbilityCard
                    key={ability.id}
                    ability={ability}
                    isSelected={currentAbilityId === ability.id}
                    isDisabled={!isActionEnabled()}
                    onClick={() => handleActionSelect(ability.id)}
                  />
                ))}
                <div
                  className={`w-20 h-28 rounded ${
                    currentAbilityId === 'pass'
                      ? 'bg-indigo-700 border-indigo-500'
                      : 'bg-gray-800 border-gray-700'
                  } border flex flex-col items-center justify-center cursor-pointer transition-colors ${
                    !isActionEnabled() ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  onClick={() =>
                    isActionEnabled() && handleActionSelect('pass')
                  }
                >
                  <div className='w-12 h-12 bg-gray-700 rounded-full mb-1 flex items-center justify-center'>
                    <span className='text-lg font-bold text-gray-300'>P</span>
                  </div>
                  <span className='text-xs font-bold text-gray-300'>パス</span>
                  <span className='text-xs text-gray-400 mt-1'>行動終了</span>
                </div>
              </>
            ) : (
              <>
                <div className='text-gray-400 text-xs flex items-center'>
                  装備中のアビリティがありません
                </div>
                <div
                  className={`w-20 h-28 rounded ${
                    currentAbilityId === 'pass'
                      ? 'bg-indigo-700 border-indigo-500'
                      : 'bg-gray-800 border-gray-700'
                  } border flex flex-col items-center justify-center cursor-pointer transition-colors ${
                    !isActionEnabled() ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  onClick={() =>
                    isActionEnabled() && handleActionSelect('pass')
                  }
                >
                  <div className='w-12 h-12 bg-gray-700 rounded-full mb-1 flex items-center justify-center'>
                    <span className='text-lg font-bold text-gray-300'>P</span>
                  </div>
                  <span className='text-xs font-bold text-gray-300'>パス</span>
                  <span className='text-xs text-gray-400 mt-1'>行動終了</span>
                </div>
              </>
            )}
          </div>
        </div>
      </>
    );
  },
  (prevProps, nextProps) => {
    // 変更がない場合はレンダリングをスキップ
    return (
      prevProps.selectedUnitId === nextProps.selectedUnitId &&
      prevProps.currentAbilityId === nextProps.currentAbilityId &&
      prevProps.connectionState.connected ===
        nextProps.connectionState.connected &&
      prevProps.connectionState.teamId === nextProps.connectionState.teamId
    );
  }
);

// コンポーネント名を設定（デバッグ用）
GameUI.displayName = 'GameUI';

export default GameUI;
