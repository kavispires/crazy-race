import { Button, Popconfirm } from 'antd';
import { useGameStore } from './store/gameStore';
import SetupScreen from './components/SetupScreen';
import DraftScreen from './components/DraftScreen';
import SecretSelectScreen from './components/SecretSelectScreen';
import RevealScreen from './components/RevealScreen';
import RaceScreen from './components/RaceScreen';
import RaceResultScreen from './components/RaceResultScreen';
import FinalScreen from './components/FinalScreen';
import DecisionModal from './components/DecisionModal';
import { isNarrationSupported } from './narration/narrator';
import './App.css';

function App() {
  const phase = useGameStore((s) => s.phase);
  const restart = useGameStore((s) => s.restart);
  const narrationEnabled = useGameStore((s) => s.narrationEnabled);
  const toggleNarration = useGameStore((s) => s.toggleNarration);

  return (
    <div className="app-shell">
      {phase !== 'setup' && phase !== 'final' && (
        <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 1000, display: 'flex', gap: 8 }}>
          {isNarrationSupported() && (
            <Button
              size="small"
              type={narrationEnabled ? 'primary' : 'default'}
              onClick={() => toggleNarration()}
              title="Narrate the race aloud"
            >
              {narrationEnabled ? '🔊 Narration on' : '🔇 Narration off'}
            </Button>
          )}
          <Popconfirm
            title="Reset game?"
            description="This will end the current game and return to the home screen."
            onConfirm={() => restart()}
            okText="Reset"
            cancelText="Cancel"
          >
            <Button danger size="small">
              Reset
            </Button>
          </Popconfirm>
        </div>
      )}
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
