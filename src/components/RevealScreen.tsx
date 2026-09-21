import { Typography } from 'antd';
import { useGameStore } from '../store/gameStore';
import { getCharacter } from '../data/characters';
import CharacterIcon from './CharacterIcon';

const { Title } = Typography;

export default function RevealScreen() {
  const turnOrder = useGameStore((s) => s.turnOrder);
  const racers = useGameStore((s) => s.racers);
  const players = useGameStore((s) => s.players);

  return (
    <div className="screen-center">
      <Title level={3}>The racers are revealed!</Title>
      <div className="card-grid">
        {turnOrder.map((cid) => {
          const owner = players.find((p) => p.id === racers[cid]?.ownerId);
          return (
            <div key={cid} className="reveal-card">
              <CharacterIcon characterId={cid} size={40} />
              <strong>{getCharacter(cid).name}</strong>
              <div>{owner?.name}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

