import { motion } from 'motion/react';
import { Button, Typography, Tag, Tooltip } from 'antd';
import { useGameStore } from '../store/gameStore';
import { getCharacter } from '../data/characters';
import ActionLog from './ActionLog';
import CharacterIcon from './CharacterIcon';

const { Title } = Typography;

function hazardIcon(effect?: { type: string; delta?: number }) {
  if (!effect) return null;
  if (effect.type === 'rock') return '🪨';
  if (effect.type === 'star') return '⭐';
  if (effect.type === 'arrow') return (effect.delta ?? 0) > 0 ? '➡️' : '⬅️';
  return null;
}

/** Short always-visible badge text for a hazard, e.g. "TRIP", "★ +1", "+3", "-2". */
function hazardLabel(effect?: { type: string; delta?: number }) {
  if (!effect) return null;
  if (effect.type === 'rock') return 'TRIP';
  if (effect.type === 'star') return '★ +1';
  if (effect.type === 'arrow') {
    const delta = effect.delta ?? 0;
    return delta > 0 ? `+${delta}` : `${delta}`;
  }
  return null;
}

/** Consistent color per effect type so the same effect always reads the same color at a glance. */
function hazardColor(effect?: { type: string; delta?: number }): string | undefined {
  if (!effect) return undefined;
  if (effect.type === 'rock') return '#ef4444';
  if (effect.type === 'star') return '#eab308';
  if (effect.type === 'arrow') return (effect.delta ?? 0) > 0 ? '#22c55e' : '#6366f1';
  return undefined;
}

function hazardTooltip(effect?: { type: string; delta?: number }): string {
  if (!effect) return 'Plain space — no effect.';
  if (effect.type === 'rock') return '🪨 Trip! Landing here trips this racer — they skip their next turn.';
  if (effect.type === 'star') return '⭐ Star! Landing here earns a bonus point (bronze chip) at game end.';
  if (effect.type === 'arrow') {
    const delta = effect.delta ?? 0;
    return delta > 0
      ? `➡️ Arrow! Landing here moves the racer forward ${delta} more space${delta === 1 ? '' : 's'}.`
      : `⬅️ Arrow! Landing here moves the racer backward ${Math.abs(delta)} space${Math.abs(delta) === 1 ? '' : 's'}.`;
  }
  return '';
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
  const diceCharacterId = Object.keys(racers).find((id) => getCharacter(id).id === 'dice');
  const hasDice = !!diceCharacterId && !racers[diceCharacterId]?.finished;

  // Each racer keeps a fixed lane (row) for the whole race, based on their
  // stable position in turnOrder, so they're always easy to track visually
  // even when several racers share the same space.
  const laneIndexById = new Map<string, number>();
  turnOrder.forEach((cid, i) => laneIndexById.set(cid, i));
  const laneCount = Math.max(1, turnOrder.length);
  const laneHeight = 34;
  const laneTopOffset = 16;
  const trackLaneHeight = laneTopOffset * 2 + laneHeight * (laneCount - 1) + 30;

  // Tiles are laid out over (length + 1) slots (index 0..length); center each
  // racer within its tile rather than pinning it to the tile's left edge.
  const tileUnit = 100 / (track.length + 1);

  return (
    <div className="race-screen">
      <Title level={3}>
        Race {raceIndex + 1}: {track.name} {track.hazardous && <Tag color="volcano">Wild Wilds</Tag>}
      </Title>

      <div className="track-wrapper">
        <p className="track-hint">
          💡 Hover any space to see what it does, or hover a racer to see its ability.
        </p>
        <div className="track-lane" style={{ height: trackLaneHeight }}>
          {track.spaces.map((space) => (
            <Tooltip key={space.index} title={hazardTooltip(space.effect)} mouseEnterDelay={0.15}>
              <div
                className={`track-space${space.effect ? ' track-space-hazard' : ''}`}
                style={{
                  left: `${space.index * tileUnit}%`,
                  width: `${tileUnit}%`,
                  background: space.effect ? hazardColor(space.effect) : space.color,
                }}
              >
                {space.index === track.length && <span className="finish-flag">🏁</span>}
                {space.effect && (
                  <span className="effect-badge">
                    <span className="effect-badge-icon">{hazardIcon(space.effect)}</span>
                    <span className="effect-badge-label">{hazardLabel(space.effect)}</span>
                  </span>
                )}
              </div>
            </Tooltip>
          ))}
          {turnOrder.map((cid) => {
            const racer = racers[cid];
            if (!racer || racer.finished) return null;
            const owner = players.find((p) => p.id === racer.ownerId);
            const character = getCharacter(cid);
            const leftPct = (racer.position + 0.5) * tileUnit;
            const lane = laneIndexById.get(cid) ?? 0;
            return (
              <Tooltip
                key={cid}
                title={
                  <>
                    <strong>
                      {character.name} ({owner?.name})
                    </strong>
                    <div>{character.description}</div>
                  </>
                }
                mouseEnterDelay={0.15}
              >
                <motion.div
                  className={`racer-token${racer.tripped ? ' tripped' : ''}${cid === activeCharacterId ? ' active' : ''}`}
                  animate={{ left: `${leftPct}%`, top: laneTopOffset + lane * laneHeight }}
                  transition={{ type: 'spring', stiffness: 120, damping: 18 }}
                >
                  <CharacterIcon characterId={cid} size={28} />
                </motion.div>
              </Tooltip>
            );
          })}
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
          {hasDice && activeCharacterId !== diceCharacterId && (
            <Button onClick={() => useReroll()} disabled={isProcessingTurn || !!pendingDecision}>
              Use Dice reroll
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
        <span className="log-legend-title">Track legend:</span>
        <span className="legend-swatch" style={{ background: '#ef4444' }} /> TRIP
        <span className="legend-swatch" style={{ background: '#eab308' }} /> ★ +1 point
        <span className="legend-swatch" style={{ background: '#22c55e' }} /> Move forward
        <span className="legend-swatch" style={{ background: '#6366f1' }} /> Move backward
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
    </div>
  );
}
