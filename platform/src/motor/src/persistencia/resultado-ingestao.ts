import type { Video } from '@contextflow/compartilhado';
import type { Banco } from './banco.ts';
import { RepositorioBibliotecaSqlite } from '../modulos/biblioteca/repositorio-sqlite.ts';
import { RepositorioTranscricoesSqlite, type TranscricaoGravavel } from './repositorio-transcricoes.ts';

/** Nenhum await dentro da transação: outra requisição não pode intercalar escrita. */
export function gravarResultadoIngestao(banco: Banco, video: Video, transcricao: TranscricaoGravavel): void {
  banco.executarTransacao(() => escreverResultadoIngestao(banco, video, transcricao));
}

/** Composição com a conclusão do trabalho: o chamador abre a transação e confere sua posse. */
export function escreverResultadoIngestao(banco: Banco, video: Video, transcricao: TranscricaoGravavel): void {
  new RepositorioBibliotecaSqlite(banco.db).atualizarSincrono(video);
  new RepositorioTranscricoesSqlite(banco.db).salvarSincrono(transcricao);
}
