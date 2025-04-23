import React from 'react';
import { GameSystem } from 'game-logic';

interface GameUIProps {
  gameSystem: GameSystem | null;
  selectedUnitId: string | null;
}

const GameUI: React.FC<GameUIProps> = ({ gameSystem, selectedUnitId }) => {
  if (!gameSystem) return null;

  const state = gameSystem.getState();
  const selectedUnit = state.units.find((unit) => unit.id === selectedUnitId);
  const activeUnit = state.units.find((unit) => unit.id === state.activeUnitId);

  return (
    <div className='absolute bottom-0 left-0 right-0 bg-gray-900 bg-opacity-80 text-white p-2'>
      <div className='flex justify-between items-center'>
        <div>
          <div>ターン: {state.turnCount}</div>
          <div>ティック: {state.tickCount}</div>
        </div>

        {activeUnit && (
          <div className='text-center'>
            <div className='text-cyan-300 font-bold'>行動ユニット</div>
            <div>
              {activeUnit.name} ({activeUnit.job})
            </div>
          </div>
        )}

        {selectedUnit && (
          <div className='bg-gray-800 p-2 rounded'>
            <div className='font-bold'>{selectedUnit.name}</div>
            <div className='text-xs'>
              {selectedUnit.job} (Team {selectedUnit.teamId})
            </div>
            <div className='flex gap-2 text-xs mt-1'>
              <div>
                HP: {selectedUnit.stats.hp}/{selectedUnit.stats.maxHp}
              </div>
              <div>ATK: {selectedUnit.stats.atk}</div>
              <div>DEF: {selectedUnit.stats.def}</div>
              <div>SPD: {selectedUnit.stats.spd}</div>
              <div>CT: {Math.floor(selectedUnit.stats.ct)}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameUI;
