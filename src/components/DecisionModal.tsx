import { Modal, Button, Space } from 'antd';
import { useGameStore } from '../store/gameStore';
import { getCharacter } from '../data/characters';

export default function DecisionModal() {
  const pendingDecision = useGameStore((s) => s.pendingDecision);
  const resolveDecision = useGameStore((s) => s.resolveDecision);

  if (!pendingDecision) return null;
  const characterName = getCharacter(pendingDecision.characterId)?.name ?? pendingDecision.characterId;

  return (
    <Modal
      title={`${characterName}'s decision`}
      open
      closable={false}
      maskClosable={false}
      footer={null}
    >
      <p>{pendingDecision.message}</p>
      <Space direction="vertical" style={{ width: '100%' }}>
        {pendingDecision.options.map((opt) => (
          <Button
            key={opt.value}
            type="primary"
            block
            style={{ height: 'auto', whiteSpace: 'normal', textAlign: 'left', padding: '8px 12px' }}
            onClick={() => resolveDecision(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </Space>
    </Modal>
  );
}
