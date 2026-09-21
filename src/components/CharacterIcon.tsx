import { baseCharacterId, getCharacter } from '../data/characters';

/**
 * Renders a character's icon. Drop replacement art into `public/racers/<id>.svg`
 * (see README) — this component picks it up automatically with no code changes.
 */
export default function CharacterIcon({
  characterId,
  size = 32,
  className,
}: {
  characterId: string;
  size?: number;
  className?: string;
}) {
  const baseId = baseCharacterId(characterId);
  const name = getCharacter(characterId).name;
  return (
    <img
      src={`/racers/${baseId}.svg`}
      alt={name}
      title={name}
      width={size}
      height={size}
      className={className}
      onError={(e) => {
        // Falls back to a plain colored initial if no custom SVG exists yet.
        e.currentTarget.onerror = null;
        e.currentTarget.src =
          'data:image/svg+xml;utf8,' +
          encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#999"/><text x="32" y="40" font-size="26" text-anchor="middle" fill="#fff">${name[0]}</text></svg>`,
          );
      }}
    />
  );
}
