/**
 * Erros de domínio.
 *
 * O código é estável e é o que a interface usa para decidir comportamento.
 * A mensagem é para humanos e pode mudar.
 */
export class ErroDominio extends Error {
  readonly codigo: string;
  readonly statusHttp: number;

  constructor(codigo: string, mensagem: string, statusHttp = 400) {
    super(mensagem);
    this.name = 'ErroDominio';
    this.codigo = codigo;
    this.statusHttp = statusHttp;
  }
}

export class ErroNaoEncontrado extends ErroDominio {
  constructor(mensagem = 'Recurso não encontrado') {
    super('nao_encontrado', mensagem, 404);
  }
}

export class ErroValidacao extends ErroDominio {
  constructor(mensagem: string) {
    super('validacao', mensagem, 422);
  }
}

export class ErroIndisponivel extends ErroDominio {
  constructor(mensagem: string) {
    super('indisponivel', mensagem, 503);
  }
}
