/** Points animés « interaction en cours » (message différé, bouton ou select). */
export function InteractionDots({
  variant = 'message',
}: {
  variant?: 'message' | 'button' | 'select';
}) {
  return (
    <span className={`interaction-dots interaction-dots--${variant}`} aria-hidden>
      <span />
      <span />
      <span />
    </span>
  );
}
