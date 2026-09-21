import { useState } from 'react';
import { Button, Form, InputNumber, Input, Typography, Card, Space } from 'antd';
import { useGameStore } from '../store/gameStore';

const { Title, Paragraph } = Typography;

export default function SetupScreen() {
  const startGame = useGameStore((s) => s.startGame);
  const [humanName, setHumanName] = useState('You');
  const [aiCount, setAiCount] = useState(3);

  return (
    <div className="screen-center">
      <Card style={{ maxWidth: 480, width: '100%' }}>
        <Title level={2}>Magical Athlete</Title>
        <Paragraph>
          Draft racers, keep their abilities secret, and win chips across four races. Set up your
          solo game against AI opponents below.
        </Paragraph>
        <Form layout="vertical">
          <Form.Item label="Your name">
            <Input value={humanName} onChange={(e) => setHumanName(e.target.value)} maxLength={20} />
          </Form.Item>
          <Form.Item label="Number of AI opponents">
            <InputNumber min={1} max={19} value={aiCount} onChange={(v) => setAiCount(v ?? 1)} />
          </Form.Item>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button type="primary" block size="large" onClick={() => startGame(humanName, aiCount)}>
              Start Game
            </Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
}
