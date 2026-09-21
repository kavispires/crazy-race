import { Typography } from 'antd';
import { useGameStore } from '../store/gameStore';
import { CharacterCard } from './DraftScreen';

const { Title, Paragraph } = Typography;

export default function SecretSelectScreen() {
  const players = useGameStore((s) => s.players);
  const secretSelections = useGameStore((s) => s.secretSelections);
  const chooseSecretCharacter = useGameStore((s) => s.chooseSecretCharacter);
  const track = useGameStore((s) => s.track);
  const raceIndex = useGameStore((s) => s.raceIndex);

  const human = players.find((p) => p.isHuman)!;
  const alreadyPicked = human.id in secretSelections;

  return (
    <div className="screen-center">
      <Title level={3}>
        Race {raceIndex + 1}: {track.name}
      </Title>
      <Paragraph>Secretly choose which racer you'll enter into this race.</Paragraph>
      {alreadyPicked ? (
        <Paragraph>Waiting for other players to choose…</Paragraph>
      ) : (
        <div className="card-grid">
          {human.characterIds.map((cid) => (
            <CharacterCard key={cid} characterId={cid} clickable onClick={() => chooseSecretCharacter(cid)} />
          ))}
        </div>
      )}
    </div>
  );
}
