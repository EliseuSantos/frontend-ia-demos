export function answerFor(prompt: string): string {
  const clean = prompt.trim().replace(/\s+/g, ' ');
  const asked = clean.length > 0 ? clean : '(sem texto)';
  return [
    `Você perguntou: ${asked}.`,
    '',
    'Uma interface que consome um modelo grande não espera a resposta inteira.',
    'Os tokens chegam em ordem, com pausas, e a conexão pode cair no meio.',
    'Eu leio o corpo da resposta como um fluxo, guardo os pedaços e pinto o DOM uma vez por frame.',
    'Se a conexão cair, eu retomo do último token confirmado, com uma espera que dobra a cada tentativa.',
    'Cancelar é um AbortController. O fetch para, e quem está gerando o fluxo percebe que o cliente foi embora.',
    'Nada disso precisa de uma chave. Este texto sai de um gerador local, com latência e falhas que eu escolho.',
  ].join('\n');
}

export function tokenize(text: string): string[] {
  return text.match(/\s+|\S+/g) ?? [];
}

export function buildTokens(prompt: string): string[] {
  return tokenize(answerFor(prompt));
}
