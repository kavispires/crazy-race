import { Card, Tag, Typography } from 'antd';
import { useGameStore } from '../store/gameStore';
import { getCharacter } from '../data/characters';
import CharacterIcon from './CharacterIcon';

const { Title } = Typography;

export default function DraftScreen() {
  const draftPool = useGameStore((s) => s.draftPool);
  const draftPickQueue = useGameStore((s) => s.draftPickQueue);
  const players = useGameStore((s) => s.players);
  const draftPick = useGameStore((s) => s.draftPick);
  const draftRound = useGameStore((s) => s.draftRound);

  const current = draftPickQueue[0];
  const currentPlayer = players.find((p) => p.id === current?.playerId);
  const isHumanTurn = !!currentPlayer?.isHuman;

  return (
    <div className="draft-screen">
      <Title level={3}>
        Draft — Round {draftRound + 1} of 2
        {currentPlayer && (
          <span className="draft-turn"> · {isHumanTurn ? 'Your pick!' : `${currentPlayer.name} is picking…`}</span>
        )}
      </Title>

      <div className="card-grid">
        {draftPool.map((characterId) => (
          <CharacterCard
            key={characterId}
            characterId={characterId}
            clickable={isHumanTurn}
            onClick={() => isHumanTurn && draftPick(characterId)}
          />
        ))}
      </div>

      <Title level={4} style={{ marginTop: 24 }}>
        Rosters
      </Title>
      <div className="roster-grid">
        {players.map((p) => (
          <Card key={p.id} size="small" title={p.name} className="roster-card">
            {p.characterIds.length === 0 && <Tag>No picks yet</Tag>}
            {p.characterIds.map((cid) => (
              <Tag key={cid} color={p.isHuman ? 'gold' : 'blue'}>
                {cid}
              </Tag>
            ))}
          </Card>
        ))}
      </div>
    </div>
  );
}

export function CharacterCard({
  characterId,
  clickable,
  onClick,
  hidden,
}: {
  characterId: string;
  clickable?: boolean;
  onClick?: () => void;
  hidden?: boolean;
}) {
  const character = getCharacter(characterId);
  return (
    <Card
      size="small"
      hoverable={clickable}
      onClick={onClick}
      className={`character-card${clickable ? ' clickable' : ''}`}
    >
      {!hidden && <CharacterIcon characterId={characterId} size={40} className="character-card-icon" />}
      <div className="character-name">{hidden ? '???' : character.name}</div>
      {!hidden && <div className="character-desc">{character.description}</div>}
      {!hidden && <Tag color="purple">Tier {character.tier}</Tag>}
    </Card>
  );
}
