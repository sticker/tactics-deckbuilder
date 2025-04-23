import GameCanvas from './components/GameCanvas';

function App() {
  return (
    <div className='h-screen w-screen flex flex-col'>
      <header className='bg-gray-800 p-4 text-white'>
        <h1 className='text-xl font-bold'>FF Tactics-like Game</h1>
      </header>

      <main className='flex-grow flex relative overflow-hidden'>
        <GameCanvas />
      </main>

      <footer className='bg-gray-800 p-2 text-center text-white text-sm'>
        © 2025 FF Tactics-like Game
      </footer>
    </div>
  );
}

export default App;
