import { Typography, Table, Button } from 'antd';
import { useGameStore } from '../store/gameStore';

const { Title } = Typography;

export default function FinalScreen() {
  const players = useGameStore((s) => s.players); // already sorted by score desc
  const restart = useGameStore((s) => s.restart);

  const columns = [
    { title: 'Rank', dataIndex: 'rank', key: 'rank' },
    { title: 'Player', dataIndex: 'name', key: 'name' },
    { title: 'Final Score', dataIndex: 'score', key: 'score' },
  ];
  const data = players.map((p, i) => ({ key: p.id, rank: i + 1, name: p.name, score: p.score }));

  return (
    <div className="screen-center">
      <Title level={2}>🏆 {players[0]?.name} wins the Magical Athlete!</Title>
      <Table columns={columns} dataSource={data} pagination={false} />
      <Button type="primary" size="large" style={{ marginTop: 16 }} onClick={() => restart()}>
        Play Again
      </Button>
    </div>
  );
}
