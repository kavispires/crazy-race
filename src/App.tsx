import { useGameStore } from './store/gameStore';
import SetupScreen from './components/SetupScreen';
import DraftScreen from './components/DraftScreen';
import SecretSelectScreen from './components/SecretSelectScreen';
import RevealScreen from './components/RevealScreen';
import RaceScreen from './components/RaceScreen';
import RaceResultScreen from './components/RaceResultScreen';
import FinalScreen from './components/FinalScreen';
import DecisionModal from './components/DecisionModal';
import './App.css';

function App() {
  const phase = useGameStore((s) => s.phase);

  return (
    <div className="app-shell">
      {phase === 'setup' && <SetupScreen />}
      {phase === 'draft' && <DraftScreen />}
      {phase === 'secret-select' && <SecretSelectScreen />}
      {phase === 'reveal' && <RevealScreen />}
      {phase === 'race' && <RaceScreen />}
      {phase === 'race-result' && <RaceResultScreen />}
      {phase === 'final' && <FinalScreen />}
      <DecisionModal />
    </div>
  );
}

export default App;
