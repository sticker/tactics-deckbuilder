import React from 'react';
import { GameSystem } from 'game-logic';

interface GameUIProps {
  gameSystem: GameSystem | null;
  selectedUnitId: string | null;
  connectionState: {
    connected: boolean;
    teamId: number | null;
    error: string | null;
  };
}

const GameUI: React.FC<GameUIProps> = ({
  gameSystem,
  selectedUnitId,
  connectionState,
}) => {
  if (!gameSystem) return null;

  const state = gameSystem.getState();
  const selectedUnit = state.units.find((unit) => unit.id === selectedUnitId);
  const activeUnit = state.units.find((unit) => unit.id === state.activeUnitId);

  return (
    <>
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
        <div className='absolute top-28 left-3 bg-gray-900 bg-opacity-90 rounded-md p-2 shadow-md border border-gray-700 z-10'>
          <div className='flex items-center mb-1'>
            <div
              className={`w-5 h-5 rounded-full ${
                selectedUnit.teamId === 0 ? 'bg-blue-500' : 'bg-red-500'
              } flex items-center justify-center mr-2`}
            >
              <span className='text-white text-xs font-bold'>
                {selectedUnit.job?.charAt(0) || '?'}
              </span>
            </div>
            <div className='font-bold'>{selectedUnit.name}</div>
          </div>

          <div className='mb-1 text-xs'>
            <span className='text-gray-400'>ジョブ: </span>
            <span>{selectedUnit.job}</span>
          </div>

          <div className='grid grid-cols-2 gap-2 mb-1'>
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
          </div>

          <div className='flex justify-between text-xs'>
            <div>
              <span className='text-gray-400 mr-1'>攻撃:</span>
              <span className='font-bold'>{selectedUnit.stats.atk}</span>
            </div>
            <div>
              <span className='text-gray-400 mr-1'>防御:</span>
              <span className='font-bold'>{selectedUnit.stats.def}</span>
            </div>
            <div>
              <span className='text-gray-400 mr-1'>速度:</span>
              <span className='font-bold'>{selectedUnit.stats.spd}</span>
            </div>
          </div>
        </div>
      )}

      {/* 手札エリア - 底部中央に配置 */}
      <div className='absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-900 bg-opacity-90 px-2 py-1 rounded-md shadow-md z-10'>
        <div className='flex space-x-2'>
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className='w-12 h-16 rounded bg-gray-800 border border-gray-700 flex items-center justify-center'
            >
              <span className='text-gray-500 text-xs'>Card {i}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default GameUI;
