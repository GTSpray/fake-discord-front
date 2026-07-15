import type { SlashCommandParam } from './types.ts';

/** Commande affichée dans DiscordCommand (sans slash initial). */
export function formatSlashInvocationCommand(
  input: string,
  params?: SlashCommandParam[],
): string {
  const base = input.startsWith('/') ? input.slice(1).trim() : input.trim();
  if (!params?.length) return base;

  const suffix = params
    .filter((param) => param.value)
    .map((param) => `${param.name}:${param.value}`)
    .join(' ');

  return suffix ? `${base} ${suffix}` : base;
}
