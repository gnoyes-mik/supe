import { readFile } from 'fs/promises';
import { join } from 'path';
import type { Pollen, PollenResponse, PollenTarget, Session, Universe } from '../types.js';
import { logger } from '../utils/logger.js';

export class PollenTracker {
  private session: Session;
  private missedCycles: Map<string, number> = new Map();

  constructor(session: Session) {
    this.session = session;
  }

  async trackAdoption(pollen: Pollen, target: PollenTarget, universe: Universe): Promise<void> {
    const responses = await this.readPollenResponses(universe);
    const response = responses.find((entry) => entry.pollenId === pollen.id);

    if (response) {
      switch (response.decision) {
        case 'applied':
          target.status = 'applied';
          target.appliedAt = new Date().toISOString();
          target.mutation = null;
          this.emitApplied(pollen, target);
          break;
        case 'adapted':
          target.status = 'adapted';
          target.appliedAt = new Date().toISOString();
          target.mutation = response.detail;
          this.emitApplied(pollen, target);
          break;
        case 'skipped':
          target.status = 'rejected';
          target.rejectionReason = response.detail;
          break;
      }

      logger.info(
        'pollen-tracker',
        `[${this.session.id}] Pollen ${pollen.id} -> ${target.universeSymbol}: ${response.decision}`,
        universe.id
      );
      return;
    }

    const key = `${pollen.id}:${universe.id}`;
    const missed = (this.missedCycles.get(key) ?? 0) + 1;
    this.missedCycles.set(key, missed);

    if (missed >= 2) {
      target.status = 'rejected';
      target.rejectionReason = 'Not adopted after 2 cycles';
      logger.info(
        'pollen-tracker',
        `[${this.session.id}] Pollen ${pollen.id} rejected by ${target.universeSymbol}: no response after 2 cycles`,
        universe.id
      );
    }
  }

  private async readPollenResponses(universe: Universe): Promise<PollenResponse[]> {
    try {
      const content = await readFile(join(universe.workdir, 'POLLEN_RESPONSE.md'), 'utf-8');
      return this.parsePollenResponseMd(content);
    } catch {
      return [];
    }
  }

  private parsePollenResponseMd(content: string): PollenResponse[] {
    const responses: PollenResponse[] = [];
    const sections = content.split(/^## /m).filter(Boolean);

    for (const section of sections) {
      const lines = section.trim().split('\n');
      const header = lines[0]?.trim() ?? '';

      const idMatch = header.match(/\[?(pol_[^\]:\s]+)\]?[:\s]+(.+)/);
      if (!idMatch) {
        continue;
      }

      const pollenId = idMatch[1];
      const title = idMatch[2].trim();
      const body = lines.slice(1).join('\n');

      const decisionMatch = body.match(/Decision:\s*(APPLIED|ADAPTED|SKIPPED)/i);
      if (!decisionMatch) {
        continue;
      }

      const decision = decisionMatch[1].toLowerCase() as 'applied' | 'adapted' | 'skipped';
      const detailMatch = body.match(/(?:How|Reason)\s*:\s*(.+)/i);
      const detail = detailMatch?.[1]?.trim() ?? '';

      responses.push({ pollenId, title, decision, detail });
    }

    return responses;
  }

  private emitApplied(pollen: Pollen, target: PollenTarget): void {
    void pollen;
    void target;
  }
}
