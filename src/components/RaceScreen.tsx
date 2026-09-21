import { motion } from 'motion/react';
import { Button, Typography, Tag } from 'antd';
import { useGameStore } from '../store/gameStore';
import { getCharacter } from '../data/characters';
import ActionLog from './ActionLog';
import DecisionModal from './DecisionModal';
import CharacterIcon from './CharacterIcon';

const { Title } = Typography;

function hazardIcon(effect?: { type: string; delta?: number }) {
  if (!effect) return null;
  if (effect.type === 'rock') return '🪨';
  if (effect.type === 'star') return '⭐';
  if (effect.type === 'arrow') return (effect.delta ?? 0) > 0 ? '➡️' : '⬅️';
  return null;
}

function hazardLabel(effect?: { type: string; delta?: number }) {
  if (!effect) return null;
  if (effect.type === 'star') return '1';
  if (effect.type === 'arrow') return `${Math.abs(effect.delta ?? 0)}`;
  return null;
}

export default function RaceScreen() {
  const track = useGameStore((s) => s.track);
  const racers = useGameStore((s) => s.racers);
  const turnOrder = useGameStore((s) => s.turnOrder);
  const turnPointer = useGameStore((s) => s.turnPointer);
  const players = useGameStore((s) => s.players);
  const advanceTurn = useGameStore((s) => s.advanceTurn);
  const useReroll = useGameStore((s) => s.useReroll);
  const isProcessingTurn = useGameStore((s) => s.isProcessingTurn);
  const raceIndex = useGameStore((s) => s.raceIndex);
  const pendingDecision = useGameStore((s) => s.pendingDecision);

  const activeCharacterId = turnOrder[turnPointer % turnOrder.length];
  const activeRacer = racers[activeCharacterId];
  const activeOwner = players.find((p) => p.id === activeRacer?.ownerId);
  const dicemongerCharacterId = Object.keys(racers).find((id) => getCharacter(id).id === 'dicemonger');
  const hasDicemonger = !!dicemongerCharacterId && !racers[dicemongerCharacterId]?.finished;

  const racersByPosition = new Map<number, string[]>();
  for (const cid of turnOrder) {
    const r = racers[cid];
    if (!r || r.finished) continue;
    const list = racersByPosition.get(r.position) ?? [];
    list.push(cid);
    racersByPosition.set(r.position, list);
  }

  return (
    <div className="race-screen">
      <Title level={3}>
        Race {raceIndex + 1}: {track.name} {track.hazardous && <Tag color="volcano">Wild Wilds</Tag>}
      </Title>

      <div className="track-wrapper">
        <div className="track-lane">
          {track.spaces.map((space) => (
            <div
              key={space.index}
              className={`track-space${space.effect ? ' track-space-hazard' : ''}`}
              style={{
                left: `${(space.index / track.length) * 100}%`,
                width: `${(1 / (track.length + 1)) * 100}%`,
                background: space.effect ? undefined : space.color,
              }}
            >
              {space.index === track.length && <span className="finish-flag">🏁</span>}
              {space.effect && (
                <span className="hazard-icon">
                  {hazardIcon(space.effect)}
                  {hazardLabel(space.effect) && <span className="hazard-label">{hazardLabel(space.effect)}</span>}
                </span>
              )}
            </div>
          ))}
          {[...racersByPosition.entries()].map(([position, cids]) =>
            cids.map((cid, stackIndex) => {
              const racer = racers[cid];
              const owner = players.find((p) => p.id === racer.ownerId);
              const leftPct = (position / track.length) * 100;
              return (
                <motion.div
                  key={cid}
                  className={`racer-token${racer.tripped ? ' tripped' : ''}${cid === activeCharacterId ? ' active' : ''}`}
                  animate={{ left: `${leftPct}%`, top: 20 + stackIndex * 34 }}
                  transition={{ type: 'spring', stiffness: 120, damping: 18 }}
                  title={`${getCharacter(cid).name} (${owner?.name})`}
                >
                  <CharacterIcon characterId={cid} size={28} />
                </motion.div>
              );
            }),
          )}
        </div>
      </div>

      <div className="race-controls">
        <div className="turn-info">
          {activeRacer && (
            <>
              Now up: <CharacterIcon characterId={activeCharacterId} size={22} />{' '}
              <strong>{getCharacter(activeCharacterId).name}</strong> ({activeOwner?.name})
              {activeRacer.tripped && <Tag color="red">Tripped — will skip turn</Tag>}
            </>
          )}
        </div>
        <div className="control-buttons">
          {hasDicemonger && activeCharacterId !== dicemongerCharacterId && (
            <Button onClick={() => useReroll()} disabled={isProcessingTurn || !!pendingDecision}>
              Use Dicemonger reroll
            </Button>
          )}
          <Button
            type="primary"
            size="large"
            loading={isProcessingTurn}
            disabled={!!pendingDecision}
            onClick={() => advanceTurn()}
          >
            {activeOwner?.isHuman ? 'Roll Die' : `Next → (${activeOwner?.name})`}
          </Button>
        </div>
      </div>

      <div className="log-legend">
        <span className="log-legend-title">Log legend:</span>
        <Tag color="blue">Turn</Tag> whose go it is
        <Tag color="default">Move</Tag> die roll & distance
        <Tag color="purple">Ability</Tag> character power triggers
        <Tag color="orange">Hazard</Tag> rocks/stars/arrows
        <Tag color="gold">Finish</Tag> crossing the line
      </div>

      <ActionLog />
      <DecisionModal />
    </div>
  );
}
