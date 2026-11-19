import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Banco, MIGRACOES } from '../../src/motor/src/persistencia/banco.ts';

test('banco vazio sobe para a versão atual e registra a migração', () => {
  const banco = Banco.abrir({ arquivo: ':memory:' });
  try {
    assert.equal(banco.versaoAtual(), 0);
    const aplicadas = banco.migrar();
    assert.equal(aplicadas, MIGRACOES.length);
    assert.equal(banco.versaoAtual(), MIGRACOES.at(-1)!.versao);

    const registro = banco.db.prepare('SELECT versao, descricao FROM _migracoes').all() as {
      versao: number;
      descricao: string;
    }[];
    assert.equal(registro.length, MIGRACOES.length);
    assert.ok(registro.every((r) => r.descricao.length > 0));
  } finally {
    banco.fechar();
  }
});

test('migrar duas vezes é idempotente', () => {
  const banco = Banco.abrir({ arquivo: ':memory:' });
  try {
    const primeira = banco.migrar();
    const segunda = banco.migrar();
    assert.ok(primeira > 0);
    assert.equal(segunda, 0, 'reaplicou migração já aplicada');
    assert.equal(banco.versaoAtual(), MIGRACOES.at(-1)!.versao);
  } finally {
    banco.fechar();
  }
});

test('tabelas esperadas existem após migrar', () => {
  const banco = Banco.abrir({ arquivo: ':memory:' });
  try {
    banco.migrar();
    const nomes = (
      banco.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
    ).map((r) => r.name);
    for (const tabela of ['videos', 'transcricoes', 'segmentos', 'resumos', 'colecoes', 'colecao_videos', '_migracoes']) {
      assert.ok(nomes.includes(tabela), `faltou a tabela ${tabela}`);
    }
  } finally {
    banco.fechar();
  }
});

test('foreign_keys está ligado: filho órfão é rejeitado', () => {
  const banco = Banco.abrir({ arquivo: ':memory:' });
  try {
    banco.migrar();
    assert.throws(() =>
      banco.db
        .prepare(
          `INSERT INTO transcricoes (id, video_id, idioma, origem, estado, atualizado_em)
           VALUES ('t1','video-que-nao-existe','pt-BR','manual','pronta','2026-01-01')`,
        )
        .run(),
    );
  } finally {
    banco.fechar();
  }
});

test('ON DELETE CASCADE remove filhos ao apagar o vídeo', () => {
  const banco = Banco.abrir({ arquivo: ':memory:' });
  try {
    banco.migrar();
    const agora = new Date().toISOString();
    banco.db
      .prepare(
        `INSERT INTO videos (id,youtube_id,titulo,url,estado,criado_em,atualizado_em)
         VALUES ('v1','dQw4w9WgXcQ','Título','https://youtu.be/dQw4w9WgXcQ','pronto',?,?)`,
      )
      .run(agora, agora);
    banco.db
      .prepare(
        `INSERT INTO transcricoes (id,video_id,idioma,origem,estado,atualizado_em)
         VALUES ('t1','v1','pt-BR','manual','pronta',?)`,
      )
      .run(agora);
    banco.db.prepare(`INSERT INTO segmentos (transcricao_id,ordem,inicio_ms,fim_ms,texto) VALUES ('t1',0,0,1000,'oi')`).run();

    banco.db.prepare("DELETE FROM videos WHERE id='v1'").run();

    const t = banco.db.prepare('SELECT COUNT(*) AS n FROM transcricoes').get() as { n: number };
    const s = banco.db.prepare('SELECT COUNT(*) AS n FROM segmentos').get() as { n: number };
    assert.equal(t.n, 0, 'transcrição órfã ficou para trás');
    assert.equal(s.n, 0, 'segmento órfão ficou para trás');
  } finally {
    banco.fechar();
  }
});

test('reverter remove o schema e volta a versão 0', () => {
  const banco = Banco.abrir({ arquivo: ':memory:' });
  try {
    banco.migrar();
    banco.reverterPara(0);
    assert.equal(banco.versaoAtual(), 0);
    const videos = banco.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='videos'")
      .get();
    assert.equal(videos, undefined);
    // E pode migrar de novo (reversão não deixa estado sujo).
    assert.ok(banco.migrar() > 0);
  } finally {
    banco.fechar();
  }
});

test('CHECK constraint impede estado inválido', () => {
  const banco = Banco.abrir({ arquivo: ':memory:' });
  try {
    banco.migrar();
    const agora = new Date().toISOString();
    assert.throws(() =>
      banco.db
        .prepare(
          `INSERT INTO videos (id,youtube_id,titulo,url,estado,criado_em,atualizado_em)
           VALUES ('v1','dQw4w9WgXcQ','T','u','estado-inventado',?,?)`,
        )
        .run(agora, agora),
    );
  } finally {
    banco.fechar();
  }
});
