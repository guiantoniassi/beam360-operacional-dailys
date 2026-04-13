'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CompiledWeekly, WeeklyDay } from '@/lib/weekly';
import { formatBR } from '@/lib/dates';

type Tab = 'overview' | 'days' | 'team' | 'clients' | 'chronic' | 'notes';

const AREA_LABELS: Record<string, string> = {
  social: 'Social',
  trafego: 'Tráfego',
  criacao: 'Criação',
  interno: 'Interno',
  sem_area: 'Sem área',
};

const AREA_COLORS: Record<string, string> = {
  social: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  trafego: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  criacao: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
  interno: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/30',
  sem_area: 'bg-zinc-700/20 text-zinc-400 border-zinc-700/30',
};

interface Member {
  id: string;
  full_name: string;
}

export default function WeeklyPresentation({
  compiled,
  members,
}: {
  compiled: CompiledWeekly;
  members: Member[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
  const [notes, setNotes] = useState(compiled.review.notes || '');
  const [actionItems, setActionItems] = useState(compiled.review.actionItems || '');
  const [orchestratorName, setOrchestratorName] = useState(
    compiled.review.orchestratorName || ''
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const isCompleted = compiled.review.status === 'completed';
  const { summary } = compiled;

  async function saveDraft() {
    setBusy('draft');
    setError(null);
    try {
      const res = await fetch(`/api/weekly/${compiled.weekStart}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes,
          action_items: actionItems,
          orchestrator_name: orchestratorName || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erro ao salvar rascunho');
        return;
      }
      setSavedAt(new Date().toLocaleTimeString('pt-BR'));
    } finally {
      setBusy(null);
    }
  }

  async function finalize() {
    if (!orchestratorName) {
      setError('Informe quem está conduzindo a weekly antes de finalizar.');
      setTab('notes');
      return;
    }
    if (!confirm('Finalizar weekly? Após finalizar, as anotações ficam congeladas.')) return;
    setBusy('finalize');
    setError(null);
    try {
      const res = await fetch(`/api/weekly/${compiled.weekStart}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes,
          action_items: actionItems,
          orchestrator_name: orchestratorName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erro ao finalizar weekly');
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wider">
            Weekly Review
            {isCompleted && <span className="text-emerald-400 ml-2">· finalizada</span>}
          </p>
          <h1 className="text-3xl font-bold mt-1">
            {formatBR(compiled.weekStart)} → {formatBR(compiled.weekEnd)}
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            {summary.completedDailys}/5 dailys concluídas
            {summary.notHeldDailys > 0 && (
              <> · {summary.notHeldDailys} não {summary.notHeldDailys === 1 ? 'realizada' : 'realizadas'}</>
            )}
            {compiled.review.orchestratorName && (
              <> · conduzida por <span className="text-zinc-200">{compiled.review.orchestratorName}</span></>
            )}
          </p>
        </div>
        <Link
          href="/orchestrate/weekly"
          className="text-sm text-zinc-400 hover:text-white transition self-start md:self-auto"
        >
          ← Voltar para weeklies
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatCard label="Task-eventos" value={summary.totalTaskEvents} />
        <StatCard label="Concluídas" value={summary.done} tone="emerald" />
        <StatCard label="Não feitas" value={summary.notDone} tone="red" />
        <StatCard label="Carryovers" value={summary.carryover} tone="amber" />
        <StatCard label="Taxa" value={`${summary.completionRate}%`} tone="green" />
      </div>

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-zinc-900/50 border border-zinc-800 rounded-xl p-1 overflow-x-auto">
        <TabBtn active={tab === 'overview'} onClick={() => setTab('overview')} label="Visão geral" />
        <TabBtn active={tab === 'days'} onClick={() => setTab('days')} label="Dia a dia" />
        <TabBtn active={tab === 'team'} onClick={() => setTab('team')} label="Por membro" />
        <TabBtn active={tab === 'clients'} onClick={() => setTab('clients')} label="Por cliente" />
        <TabBtn
          active={tab === 'chronic'}
          onClick={() => setTab('chronic')}
          label={`Crônicos (${compiled.chronicCarryovers.length})`}
        />
        <TabBtn active={tab === 'notes'} onClick={() => setTab('notes')} label="Ações & fechamento" />
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Daily strip */}
          <section className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4">A semana em 5 dias</h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {compiled.days.map((day) => (
                <DayCard key={day.date} day={day} />
              ))}
            </div>
          </section>

          {/* Por área */}
          {compiled.perArea.length > 0 && (
            <section className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4">Distribuição por área</h2>
              <div className="space-y-2">
                {compiled.perArea.map((a) => {
                  const pct = a.total > 0 ? Math.round((a.done / a.total) * 100) : 0;
                  return (
                    <div key={a.area} className="flex items-center gap-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded border ${AREA_COLORS[a.area]} w-20 text-center flex-shrink-0`}
                      >
                        {AREA_LABELS[a.area] || a.area}
                      </span>
                      <div className="flex-1 bg-zinc-950 rounded-full h-6 overflow-hidden border border-zinc-800">
                        <div
                          className="h-full bg-emerald-500/40 flex items-center justify-end pr-2 text-xs text-emerald-100 font-medium"
                          style={{ width: `${pct}%` }}
                        >
                          {a.done}
                        </div>
                      </div>
                      <div className="text-xs text-zinc-400 w-20 text-right flex-shrink-0">
                        {a.done}/{a.total} · {pct}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Resumo executivo */}
          <section className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4">Highlights</h2>
            <ul className="space-y-2 text-sm text-zinc-300">
              <li>
                📊 <strong>{summary.completionRate}%</strong> de taxa de conclusão nas tarefas decididas
                ({summary.done} de {summary.done + summary.notDone}).
              </li>
              {summary.carryover > 0 && (
                <li>
                  ⚠️ <strong>{summary.carryover}</strong> eventos de carryover ao longo da semana.
                </li>
              )}
              {compiled.chronicCarryovers.length > 0 && (
                <li>
                  🔁 <strong>{compiled.chronicCarryovers.length}</strong> tarefa(s) crônica(s) detectada(s)
                  — arrastando por 2+ dias. Veja a aba &ldquo;Crônicos&rdquo;.
                </li>
              )}
              {summary.notHeldDailys > 0 && (
                <li>
                  🚫 <strong>{summary.notHeldDailys}</strong> daily(s) não realizada(s) nesta semana.
                </li>
              )}
              {compiled.perMember.length > 0 && (
                <li>
                  👥 {compiled.perMember[0].fullName} foi quem mais operou tarefas (
                  {compiled.perMember[0].total} no total).
                </li>
              )}
            </ul>
          </section>
        </div>
      )}

      {/* DAYS */}
      {tab === 'days' && (
        <section className="space-y-3">
          {compiled.days.map((day) => (
            <div
              key={day.date}
              className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <h3 className="text-lg font-semibold capitalize">
                    {day.weekday} · {formatBR(day.date)}
                  </h3>
                  <p className="text-sm text-zinc-400 mt-0.5">
                    {day.orchestrator ? `Conduzida por ${day.orchestrator}` : 'Sem registro'}
                  </p>
                </div>
                <DayStatusBadge status={day.status} />
              </div>
              {day.status === 'not_held' ? (
                <p className="text-sm text-zinc-500 italic">
                  Daily não realizada — sem dados para compilar.
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-3">
                  <Mini label="Total" value={day.totalTasks} />
                  <Mini label="Feitas" value={day.done} tone="emerald" />
                  <Mini label="Não feitas" value={day.notDone} tone="red" />
                  <Mini label="Carryover" value={day.carryover} tone="amber" />
                </div>
              )}
              {day.status === 'completed' && (
                <div className="mt-4">
                  <Link
                    href={`/orchestrate/daily/${day.date}?view=summary`}
                    className="text-xs text-green-400 hover:text-green-300"
                  >
                    Ver detalhes da daily →
                  </Link>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {/* TEAM */}
      {tab === 'team' && (
        <section className="space-y-3">
          {compiled.perMember.length === 0 ? (
            <Empty text="Nenhum dado por membro nesta semana." />
          ) : (
            compiled.perMember.map((m) => (
              <div
                key={m.userId}
                className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5"
                style={{ borderLeftWidth: 4, borderLeftColor: m.color }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold">{m.fullName}</h3>
                  <span className="text-sm text-zinc-400">
                    {m.completionRate}% de conclusão
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <Mini label="Total" value={m.total} />
                  <Mini label="Feitas" value={m.done} tone="emerald" />
                  <Mini label="Não feitas" value={m.notDone} tone="red" />
                  <Mini label="Carryover" value={m.carryover} tone="amber" />
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {/* CLIENTS */}
      {tab === 'clients' && (
        <section className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
          {compiled.perClient.length === 0 ? (
            <Empty text="Nenhum cliente com atividade nesta semana." />
          ) : (
            <table className="w-full">
              <thead className="bg-zinc-950/60 border-b border-zinc-800 text-left text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-5 py-3">Cliente</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3 text-right">Feitas</th>
                  <th className="px-5 py-3 text-right">Não feitas</th>
                  <th className="px-5 py-3 text-right">Carryover</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 text-sm">
                {compiled.perClient.map((c) => (
                  <tr key={c.clientId || 'none'} className="hover:bg-zinc-900/30">
                    <td className="px-5 py-3 font-medium">{c.name}</td>
                    <td className="px-5 py-3 text-right">{c.total}</td>
                    <td className="px-5 py-3 text-right text-emerald-400">{c.done}</td>
                    <td className="px-5 py-3 text-right text-red-400">{c.notDone}</td>
                    <td className="px-5 py-3 text-right text-amber-400">{c.carryover}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* CHRONIC */}
      {tab === 'chronic' && (
        <section className="space-y-4">
          {compiled.chronicCarryovers.length === 0 ? (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 text-center">
              <p className="text-lg font-medium text-emerald-400">🎉 Nenhum gargalo detectado</p>
              <p className="text-sm text-zinc-400 mt-1">
                Nenhuma tarefa ficou arrastando por 2+ dias nesta semana.
              </p>
            </div>
          ) : (
            compiled.chronicCarryovers.map((c) => (
              <div
                key={c.rootId}
                className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5"
                style={{ borderLeftWidth: 4, borderLeftColor: c.userColor }}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-zinc-100 font-medium">{c.description}</p>
                    <div className="flex items-center flex-wrap gap-2 mt-2">
                      <span className="text-xs text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded">
                        {c.userName}
                      </span>
                      {c.clientName && (
                        <span className="text-xs text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded">
                          {c.clientName}
                        </span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded border bg-amber-500/10 text-amber-300 border-amber-500/30">
                        {c.daysDragged} {c.daysDragged === 1 ? 'dia' : 'dias'} na semana
                      </span>
                      {c.draggingFromBefore && (
                        <span className="text-xs px-2 py-0.5 rounded border bg-red-500/10 text-red-300 border-red-500/30">
                          arrasta desde {formatBR(c.originDate)}
                        </span>
                      )}
                      {c.finalStatus === 'done' && (
                        <span className="text-xs px-2 py-0.5 rounded border bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                          ✓ fechada na semana
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {c.justifications.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider">
                      Histórico de justificativas
                    </p>
                    {c.justifications.map((j, i) => (
                      <div
                        key={i}
                        className="bg-zinc-950/60 border border-zinc-800 rounded-lg p-3"
                      >
                        <p className="text-xs text-zinc-500 mb-1">
                          {formatBR(j.date)} · {j.orchestratorName}
                        </p>
                        <p className="text-sm text-zinc-300">{j.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </section>
      )}

      {/* NOTES / FINALIZE */}
      {tab === 'notes' && (
        <section className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-5">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
              Quem está conduzindo a weekly?
            </label>
            <select
              value={orchestratorName}
              onChange={(e) => setOrchestratorName(e.target.value)}
              disabled={isCompleted}
              className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-60"
            >
              <option value="">Selecione...</option>
              {members.map((m) => (
                <option key={m.id} value={m.full_name}>
                  {m.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
              Observações gerais
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isCompleted}
              rows={4}
              placeholder="O que chamou atenção nesta semana? Padrões, bloqueios, conquistas..."
              className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-700 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
              Ações para a próxima semana
            </label>
            <textarea
              value={actionItems}
              onChange={(e) => setActionItems(e.target.value)}
              disabled={isCompleted}
              rows={5}
              placeholder={'- Revisar processo de aprovação de criativos\n- Bloquear 2h de foco em [cliente X] na segunda'}
              className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-700 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-60 font-mono text-sm"
            />
          </div>

          {!isCompleted && (
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={saveDraft}
                disabled={busy === 'draft'}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium px-4 py-2.5 rounded-lg transition disabled:opacity-60"
              >
                {busy === 'draft' ? 'Salvando...' : 'Salvar rascunho'}
              </button>
              <button
                onClick={finalize}
                disabled={busy === 'finalize'}
                className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-medium px-5 py-2.5 rounded-lg transition"
              >
                {busy === 'finalize' ? 'Finalizando...' : 'Finalizar weekly'}
              </button>
              {savedAt && (
                <span className="text-xs text-zinc-500">Rascunho salvo às {savedAt}</span>
              )}
            </div>
          )}
          {isCompleted && compiled.review.completedAt && (
            <div className="pt-2 text-sm text-emerald-400">
              ✓ Weekly finalizada em {formatBR(compiled.review.completedAt, "dd/MM 'às' HH:mm")}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

// —— Subcomponents ——————————————————————————————————————

function StatCard({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: number | string;
  tone?: 'slate' | 'emerald' | 'amber' | 'blue' | 'green' | 'red';
}) {
  const colors: Record<string, string> = {
    slate: 'text-zinc-100',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    blue: 'text-blue-400',
    green: 'text-green-400',
    red: 'text-red-400',
  };
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${colors[tone]}`}>{value}</div>
    </div>
  );
}

function Mini({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: number;
  tone?: 'slate' | 'emerald' | 'amber' | 'red';
}) {
  const colors: Record<string, string> = {
    slate: 'text-zinc-100',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
  };
  return (
    <div className="bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2">
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</div>
      <div className={`text-lg font-bold ${colors[tone]}`}>{value}</div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap py-2 px-3 rounded-lg text-sm font-medium transition ${
        active
          ? 'bg-green-500/20 text-green-300 border border-green-500/40'
          : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60 border border-transparent'
      }`}
    >
      {label}
    </button>
  );
}

function DayCard({ day }: { day: WeeklyDay }) {
  const meta =
    day.status === 'completed'
      ? { bg: 'bg-emerald-500/10', border: 'border-emerald-500/40', text: 'text-emerald-300' }
      : day.status === 'in_progress'
      ? { bg: 'bg-amber-500/10', border: 'border-amber-500/40', text: 'text-amber-300' }
      : day.status === 'pending'
      ? { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-300' }
      : { bg: 'bg-zinc-950/40', border: 'border-zinc-800', text: 'text-zinc-500' };

  return (
    <div className={`rounded-xl border p-4 ${meta.bg} ${meta.border}`}>
      <div className="text-[10px] uppercase tracking-wider text-zinc-400 capitalize">
        {day.weekday}
      </div>
      <div className="text-lg font-semibold mt-0.5">{formatBR(day.date, 'dd/MM')}</div>
      <div className={`text-xs mt-2 ${meta.text}`}>
        {day.status === 'completed' && `${day.done}/${day.totalTasks} feitas`}
        {day.status === 'in_progress' && 'Em andamento'}
        {day.status === 'pending' && 'Pendente'}
        {day.status === 'not_held' && 'Não realizada'}
      </div>
      {day.status === 'completed' && day.totalTasks > 0 && (
        <div className="mt-2 h-1 bg-zinc-950 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-400" style={{ width: `${day.rate}%` }} />
        </div>
      )}
    </div>
  );
}

function DayStatusBadge({ status }: { status: WeeklyDay['status'] }) {
  const meta = {
    completed: { label: '✓ Concluída', color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' },
    in_progress: { label: '⚡ Em andamento', color: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
    pending: { label: '✗ Pendente', color: 'bg-red-500/10 text-red-300 border-red-500/30' },
    not_held: { label: 'Não realizada', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30' },
  }[status];
  return (
    <span className={`text-xs px-2.5 py-1 rounded border ${meta.color} whitespace-nowrap`}>
      {meta.label}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-500">{text}</div>;
}
