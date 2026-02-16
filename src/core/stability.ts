import type { StabilityLevel, StabilityCheck } from '../types.js';

export function checkMultiverseStability(universeCount: number): StabilityCheck {
  if (universeCount > 10) {
    return {
      level: 'REJECTED',
      message: `🕳️  Nice try. Even Supe has limits. The fabric of reality cannot sustain ${universeCount} universes. Maximum: 10.\n   (The multiverse thanks you for your restraint.)`,
      requiresConfirmation: false,
    };
  }
  if (universeCount >= 10) {
    return {
      level: 'COLLAPSE_IMMINENT',
      message: `💀 SPACETIME COLLAPSE IMMINENT\n   10 simultaneous universes has never been attempted.\n   The last person who tried was never seen again.\n   They say he still wanders between dimensions,\n   mumbling about token costs.\n   \n   Final warning — proceed? (y/N)`,
      requiresConfirmation: true,
    };
  }
  if (universeCount >= 8) {
    return {
      level: 'CRITICAL',
      message: `🔴 CRITICAL: The multiverse is groaning under the weight of ${universeCount} realities.\n   Reality anchors failing. Cost projections entering an unknown dimension.\n   Are you absolutely sure? (y/N)`,
      requiresConfirmation: true,
    };
  }
  if (universeCount >= 6) {
    return {
      level: 'UNSTABLE',
      message: `🟠 WARNING: Spacetime fabric is stretching.\n   ${universeCount} parallel realities may cause interdimensional interference.\n   Your wallet might also feel the distortion. Proceed? (y/N)`,
      requiresConfirmation: true,
    };
  }
  if (universeCount >= 4) {
    return {
      level: 'MINOR_FLUCTUATION',
      message: `🟡 Minor spacetime fluctuations detected. ${universeCount} universes is... ambitious. Proceeding.`,
      requiresConfirmation: false,
    };
  }
  return {
    level: 'STABLE',
    message: `🟢 Spacetime stable. ${universeCount} universes initialized.`,
    requiresConfirmation: false,
  };
}

// Greek letter symbols for universes
export const UNIVERSE_SYMBOLS = ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ'];

// Ambient flavor messages for dashboard/Slack
export const AMBIENT_MESSAGES = [
  '⚡ Interdimensional static detected between Universe {a} and {b}. Probably nothing.',
  '🌀 Minor reality leak near Universe {a}. Self-sealing in progress.',
  '👁️ Something briefly observed all universes simultaneously. It looked confused.',
  '🐈 A cat was observed alive in Universe {a} and dead in Universe {b}. Schrödinger sends his regards.',
  '💸 Universe {a} just mass-produced tokens. Your wallet felt a disturbance in the force.',
  '🧬 Universe {a}\'s DNA is showing up in Universe {b}. Evolution works in mysterious ways.',
  '📻 Faint whispers detected between dimensions. The universes are... talking?',
  '🌊 A ripple in the quantum foam. Universe {a}\'s discovery is echoing across realities.',
  '🌙 The multiverse hums quietly. All dimensions are working while you sleep.',
  '⏳ Time flows differently in each universe. What feels like minutes here is epochs there.',
  '🍕 Universe {a} just ordered pizza. Wait, that\'s not in the spec...',
  '📎 It looks like you\'re trying to solve a problem. Would you like to open 3 more dimensions?',
  '🎲 God does not play dice with the universe. But Supe does. With {n} of them.',
];

export function pickAmbientMessage(universeSymbols: string[]): string {
  const msg = AMBIENT_MESSAGES[Math.floor(Math.random() * AMBIENT_MESSAGES.length)];
  const a = universeSymbols[Math.floor(Math.random() * universeSymbols.length)] ?? 'α';
  const b = universeSymbols.filter(s => s !== a)[Math.floor(Math.random() * (universeSymbols.length - 1))] ?? 'β';
  return msg
    .replace(/\{a\}/g, a)
    .replace(/\{b\}/g, b)
    .replace(/\{n\}/g, String(universeSymbols.length));
}
