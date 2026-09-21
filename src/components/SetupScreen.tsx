import { useState } from 'react';
import { Button, Form, InputNumber, Input, Typography, Card, Space, List, Tag, Tooltip } from 'antd';
import { useGameStore } from '../store/gameStore';
import { TRACKS } from '../data/tracks';
import { CHARACTERS } from '../data/characters';
import CharacterIcon from './CharacterIcon';

const { Title, Paragraph } = Typography;

const MAX_AI_OPPONENTS = 11; // + the human player = 12 total

export default function SetupScreen() {
  const startGame = useGameStore((s) => s.startGame);
  const [humanName, setHumanName] = useState('You');
  const [aiCount, setAiCount] = useState(3);

  return (
    <div className="screen-center">
      <Card style={{ maxWidth: 640, width: '100%' }}>
        <Title level={2}>Magical Athlete</Title>
        <Paragraph>
          Draft racers, keep their abilities secret, and win chips across four races. Set up your
          solo game against AI opponents below.
        </Paragraph>
        <Form layout="vertical">
          <Form.Item label="Your name">
            <Input value={humanName} onChange={(e) => setHumanName(e.target.value)} maxLength={20} />
          </Form.Item>
          <Form.Item label="Number of AI opponents" extra={`Up to ${MAX_AI_OPPONENTS} opponents (${MAX_AI_OPPONENTS + 1} players total).`}>
            <InputNumber
              min={1}
              max={MAX_AI_OPPONENTS}
              value={aiCount}
              onChange={(v) => setAiCount(Math.min(MAX_AI_OPPONENTS, Math.max(1, v ?? 1)))}
            />
          </Form.Item>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button type="primary" block size="large" onClick={() => startGame(humanName, aiCount)}>
              Start Game
            </Button>
          </Space>
        </Form>

        <Title level={4} style={{ marginTop: 32 }}>
          Races in this game
        </Title>
        <List
          size="small"
          dataSource={TRACKS}
          renderItem={(track, i) => (
            <List.Item>
              <Space>
                <Tag>{`Race ${i + 1}`}</Tag>
                <span>{track.name}</span>
                <Tag color="default">{`${track.length} spaces`}</Tag>
                {track.hazardous ? <Tag color="volcano">Hazards</Tag> : <Tag color="green">Calm</Tag>}
              </Space>
            </List.Item>
          )}
        />

        <Title level={4} style={{ marginTop: 32 }}>
          Racers in this game ({CHARACTERS.length})
        </Title>
        <Paragraph type="secondary" style={{ marginTop: -8 }}>
          Hover a racer to see their ability. Everyone drafts from this roster and keeps their
          picks secret until each race starts.
        </Paragraph>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))',
            gap: 8,
          }}
        >
          {[...CHARACTERS].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
            <Tooltip key={c.id} title={`${c.name}: ${c.description}`}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'help',
                }}
              >
                <CharacterIcon characterId={c.id} size={40} />
                <span style={{ fontSize: 11, textAlign: 'center', lineHeight: 1.1 }}>{c.name}</span>
              </div>
            </Tooltip>
          ))}
        </div>
      </Card>
    </div>
  );
}
