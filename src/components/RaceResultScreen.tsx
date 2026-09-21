import { Typography, Table, Button } from 'antd';
import { useGameStore } from '../store/gameStore';
import { getCharacter } from '../data/characters';

const { Title, Paragraph } = Typography;

export default function RaceResultScreen() {
  const lastRaceResult = useGameStore((s) => s.lastRaceResult);
  const players = useGameStore((s) => s.players);
  const raceIndex = useGameStore((s) => s.raceIndex);
  const proceedToNextRace = useGameStore((s) => s.proceedToNextRace);

  const columns = [
    { title: 'Player', dataIndex: 'name', key: 'name' },
    { title: 'Chips this race', dataIndex: 'raceChips', key: 'raceChips' },
    { title: 'Total score', dataIndex: 'score', key: 'score' },
  ];

  const data = players.map((p) => ({
    key: p.id,
    name: p.name,
    raceChips: p.chips
      .filter((c) => c.raceIndex === raceIndex)
      .map((c) => `${c.type} (+${c.points})`)
      .join(', ') || '—',
    score: p.score,
  }));

  return (
    <div className="screen-center">
      <Title level={3}>Race {raceIndex + 1} Results</Title>
      {lastRaceResult?.first && (
        <Paragraph>
          🥇 {getCharacter(lastRaceResult.first)?.name} takes gold!
          {lastRaceResult.second && <> 🥈 {getCharacter(lastRaceResult.second)?.name} takes silver.</>}
        </Paragraph>
      )}
      <Table columns={columns} dataSource={data} pagination={false} size="small" />
      <Button type="primary" size="large" style={{ marginTop: 16 }} onClick={() => proceedToNextRace()}>
        {raceIndex + 1 >= 4 ? 'See Final Results' : 'Next Race →'}
      </Button>
    </div>
  );
}
