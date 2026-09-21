import { useEffect, useMemo, useRef } from 'react';
import { Card, Tag } from 'antd';
import { useGameStore } from '../store/gameStore';
import { CHARACTERS } from '../data/characters';
import CharacterIcon from './CharacterIcon';
import type { LogKind } from '../types';

const KIND_TAG: Record<LogKind, { color: string; label: string } | null> = {
  turn: { color: 'blue', label: 'Turn' },
  move: { color: 'default', label: 'Move' },
  ability: { color: 'purple', label: 'Ability' },
  hazard: { color: 'orange', label: 'Hazard' },
  finish: { color: 'gold', label: 'Finish' },
  system: null,
};

// Log messages embed a character's display name (e.g. "Snowman (Bot A) ...", see
// `describe()` in raceEngine.ts). Longest-name-first avoids partial-name collisions.
const NAMES_BY_LENGTH = [...CHARACTERS].sort((a, b) => b.name.length - a.name.length);
const NAME_TO_ID = new Map(CHARACTERS.map((c) => [c.name, c.id]));
const NAME_PATTERN = new RegExp(
  `(?:${NAMES_BY_LENGTH.map((c) => c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?= \\()`,
);

/** Finds the first character named in a log message, for showing its icon alongside the entry. */
function findEntryCharacterId(message: string): string | null {
  const match = message.match(NAME_PATTERN);
  return match ? (NAME_TO_ID.get(match[0]) ?? null) : null;
}

export default function ActionLog() {
  const actionLog = useGameStore((s) => s.actionLog);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [actionLog.length]);

  // Newest entries first, so the most recent action is always visible without scrolling.
  const recentEntries = useMemo(() => [...actionLog.slice(-100)].reverse(), [actionLog]);

  return (
    <Card size="small" title="Action Log" className="action-log">
      <div className="action-log-scroll">
        <div ref={topRef} />
        {recentEntries.map((entry) => {
          const tag = KIND_TAG[entry.kind ?? 'system'];
          const characterId = findEntryCharacterId(entry.message);
          return (
            <div key={entry.id} className={`action-log-entry action-log-${entry.kind ?? 'system'}`}>
              {characterId && <CharacterIcon characterId={characterId} size={20} className="action-log-icon" />}
              {tag && (
                <Tag color={tag.color} className="action-log-tag">
                  {tag.label}
                </Tag>
              )}
              {entry.message}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

