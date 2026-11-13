export type GenerationChatLocation = 'home' | 'target' | 'other';

export interface GenerationTarget {
  chatIdentity: string;
  floor: number;
}

export function classifyGenerationChat(
  targetChatIdentity: string,
  currentChatIdentity: string,
): GenerationChatLocation {
  if (!currentChatIdentity) return 'home';
  return currentChatIdentity === targetChatIdentity ? 'target' : 'other';
}

export function isGenerationTargetOpen(
  target: GenerationTarget | null,
  currentChatIdentity: string,
  currentFloor: number | null,
): boolean {
  return (
    !!target &&
    !!currentChatIdentity &&
    target.chatIdentity === currentChatIdentity &&
    target.floor === currentFloor
  );
}
