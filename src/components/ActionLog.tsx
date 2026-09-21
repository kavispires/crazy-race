import { useEffect, useRef } from 'react';
import { Card, Tag } from 'antd';
import { useGameStore } from '../store/gameStore';
import type { LogKind } from '../types';

const KIND_TAG: Record<LogKind, { color: string; label: string } | null> = {
  turn: { color: 'blue', label: 'Turn' },
  move: { color: 'default', label: 'Move' },
  ability: { color: 'purple', label: 'Ability' },
  hazard: { color: 'orange', label: 'Hazard' },
  finish: { color: 'gold', label: 'Finish' },
  system: null,
};

export default function ActionLog() {
  const actionLog = useGameStore((s) => s.actionLog);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [actionLog.length]);

  return (
    <Card size="small" title="Action Log" className="action-log">
      <div className="action-log-scroll">
        {actionLog.slice(-100).map((entry) => {
          const tag = KIND_TAG[entry.kind ?? 'system'];
          return (
            <div key={entry.id} className={`action-log-entry action-log-${entry.kind ?? 'system'}`}>
              {tag && (
                <Tag color={tag.color} className="action-log-tag">
                  {tag.label}
                </Tag>
              )}
              {entry.message}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </Card>
  );
}

