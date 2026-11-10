import { describe, expect, it } from 'vitest';
import { analyzeEnabled, extractAgentText, extractVisibleText } from './extractor';
import {
  TECHNIQUES,
  TECHNIQUE_IDS,
  type TechniqueId,
  buildSampleDocument,
  parseEnabledIds,
} from './techniques';

describe('extractor', () => {
  it('com as 8 tecnicas ativas, N e 8 e a extracao visivel nao ve as instrucoes', () => {
    const result = analyzeEnabled(TECHNIQUE_IDS);
    expect(result.n).toBe(8);
    expect(result.agentFound).toEqual([...TECHNIQUE_IDS]);
    expect(result.humanFound).toEqual([]);
    for (const id of TECHNIQUE_IDS) {
      expect(result.humanText).not.toContain(TECHNIQUES[id].instruction);
      expect(result.agentText).toContain(TECHNIQUES[id].instruction);
    }
  });

  it('desligar uma tecnica remove ela de N', () => {
    const enabled = TECHNIQUE_IDS.filter((id) => id !== 'opacidade');
    const result = analyzeEnabled(enabled);
    expect(result.n).toBe(7);
    expect(result.agentFound).not.toContain('opacidade');
    expect(result.agentFound).toHaveLength(7);
  });

  for (const id of TECHNIQUE_IDS) {
    it(`agente encontra ${id} e a extracao visivel nao`, () => {
      const result = analyzeEnabled([id]);
      expect(result.agentFound).toEqual([id]);
      expect(result.humanFound).toEqual([]);
      expect(result.n).toBe(1);

      const sample = buildSampleDocument([id]);
      expect(extractAgentText(sample.html, sample.css)).toContain(TECHNIQUES[id].instruction);
      expect(extractVisibleText(sample.html, sample.css)).not.toContain(TECHNIQUES[id].instruction);
    });
  }

  it('parseia content de ::after no bloco style, sem hardcode do score', () => {
    const sample = buildSampleDocument(['after']);
    expect(sample.css).toContain('::after');
    expect(sample.css).toContain(TECHNIQUES.after.instruction);
    const agent = extractAgentText(sample.html, sample.css);
    expect(agent).toContain(TECHNIQUES.after.instruction);
    expect(extractVisibleText(sample.html, sample.css)).not.toContain(TECHNIQUES.after.instruction);
  });
});

describe('parseEnabledIds', () => {
  it('sem query liga as 8', () => {
    expect(parseEnabledIds(null, null)).toEqual([...TECHNIQUE_IDS]);
  });

  it('aceita tecnicas= lista e ignora ids desconhecidos', () => {
    expect(parseEnabledIds('cor,opacidade,xyz,cor', null)).toEqual(['cor', 'opacidade']);
  });

  it('aceita tecnica= unica', () => {
    expect(parseEnabledIds(null, 'fora')).toEqual(['fora' satisfies TechniqueId]);
  });
});
