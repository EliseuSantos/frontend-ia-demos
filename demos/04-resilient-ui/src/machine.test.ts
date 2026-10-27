import { describe, expect, it } from 'vitest';
import { backoffMs, createSession, reduce, type SessionState } from './machine';

function apply(state: SessionState, events: Parameters<typeof reduce>[1][]): SessionState {
  return events.reduce(reduce, state);
}

describe('transições', () => {
  it('sai de idle para connecting', () => {
    const next = reduce(createSession(), { type: 'start' });
    expect(next.phase).toBe('connecting');
    expect(next.attempt).toBe(1);
  });

  it('falha na hora se estiver offline', () => {
    const offline = reduce(createSession(), { type: 'offline' });
    const next = reduce(offline, { type: 'start' });
    expect(next.phase).toBe('failed');
    expect(next.error).toBe('Sem rede.');
  });

  it('conecta, recebe token, pausa e conclui', () => {
    let state = createSession({ highWatermark: 3, lowWatermark: 1 });
    state = apply(state, [
      { type: 'start' },
      { type: 'connected' },
      { type: 'token', text: 'Olá' },
      { type: 'token', text: ' ' },
    ]);
    expect(state.phase).toBe('streaming');
    expect(state.paused).toBe(false);
    state = reduce(state, { type: 'token', text: 'mundo' });
    expect(state.paused).toBe(true);
    expect(state.pending).toBe(3);
    state = reduce(state, { type: 'flush', count: 1 });
    expect(state.paused).toBe(true);
    expect(state.text).toBe('Olá');
    state = reduce(state, { type: 'flush', count: 2 });
    expect(state.pending).toBe(0);
    expect(state.paused).toBe(false);
    expect(state.text).toBe('Olá mundo');
    state = reduce(state, { type: 'complete' });
    expect(state.phase).toBe('done');
  });

  it('entra em pausa e volta a receber', () => {
    let state = apply(createSession(), [
      { type: 'start' },
      { type: 'connected' },
      { type: 'token', text: 'a' },
      { type: 'stall' },
    ]);
    expect(state.phase).toBe('stalled');
    state = reduce(state, { type: 'token', text: 'b' });
    expect(state.phase).toBe('streaming');
    expect(state.received).toBe(2);
  });

  it('retenta enquanto houver tentativa e falha na última', () => {
    let state = createSession({ maxAttempts: 3 });
    state = apply(state, [{ type: 'start' }, { type: 'disconnect' }]);
    expect(state.phase).toBe('retrying');
    expect(state.attempt).toBe(1);
    expect(state.error).toBe('Conexão caiu.');

    state = reduce(state, { type: 'retry' });
    expect(state.phase).toBe('connecting');
    expect(state.attempt).toBe(2);

    state = reduce(state, { type: 'timeout' });
    expect(state.phase).toBe('retrying');
    expect(state.error).toBe('Tempo esgotado.');

    state = apply(state, [{ type: 'retry' }, { type: 'disconnect' }]);
    expect(state.attempt).toBe(3);
    expect(state.phase).toBe('failed');
  });

  it('preserva o texto parcial no retry automático', () => {
    let state = createSession();
    state = apply(state, [
      { type: 'start' },
      { type: 'connected' },
      { type: 'token', text: 'parcial' },
      { type: 'flush', count: 1 },
      { type: 'disconnect' },
      { type: 'retry' },
    ]);
    expect(state.phase).toBe('connecting');
    expect(state.text).toBe('parcial');
    expect(state.received).toBe(1);
  });

  it('recomeça do zero quando a falha é manual', () => {
    let state = apply(createSession({ maxAttempts: 1 }), [
      { type: 'start' },
      { type: 'connected' },
      { type: 'token', text: 'x' },
      { type: 'flush', count: 1 },
      { type: 'disconnect' },
    ]);
    expect(state.phase).toBe('failed');
    state = reduce(state, { type: 'online' });
    state = reduce(state, { type: 'start' });
    expect(state.phase).toBe('connecting');
    expect(state.text).toBe('');
    expect(state.attempt).toBe(1);
  });

  it('offline no meio do stream falha sem retry', () => {
    const state = apply(createSession(), [
      { type: 'start' },
      { type: 'connected' },
      { type: 'token', text: 'oi' },
      { type: 'offline' },
    ]);
    expect(state.phase).toBe('failed');
    expect(state.error).toBe('Sem rede.');
    expect(state.offline).toBe(true);
  });

  it('cancelar volta para idle e ignora token fora de hora', () => {
    let state = apply(createSession(), [{ type: 'start' }, { type: 'connected' }, { type: 'cancel' }]);
    expect(state.phase).toBe('idle');
    state = reduce(state, { type: 'token', text: 'não' });
    expect(state.received).toBe(0);
    expect(reduce(createSession(), { type: 'complete' }).phase).toBe('idle');
  });

  it('timeout na conexão também conta tentativa', () => {
    const state = apply(createSession(), [{ type: 'start' }, { type: 'timeout' }]);
    expect(state.phase).toBe('retrying');
    expect(state.error).toBe('Tempo esgotado.');
  });
});

describe('backoff', () => {
  it('dobra até o teto', () => {
    expect(backoffMs(1, 300, 1_000)).toBe(300);
    expect(backoffMs(2, 300, 1_000)).toBe(600);
    expect(backoffMs(3, 300, 1_000)).toBe(1_000);
  });
});
