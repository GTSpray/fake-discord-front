/** Points animés « interaction en cours » (message différé ou bouton). */
export function InteractionDots({ variant = 'message' }: { variant?: 'message' | 'button' }) {
  return (
    <span className={`interaction-dots interaction-dots--${variant}`} aria-hidden>
      <span />
      <span />
      <span />
    </span>
  );
}
