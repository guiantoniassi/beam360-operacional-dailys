'use client';

import { useMemo, useState } from 'react';
import { Task, TaskArea, TaskStatus } from '@/lib/types';
import { formatBR, formatLong } from '@/lib/dates';
import {
  addMonths,
  subMonths,
  format,
  startOfMonth,
  endOfMonth,
  parseISO,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  initialTasks: Task[];
  initialMonth: string; // YYYY-MM
}

const AREA_LABELS: Record<TaskArea, string> = {
  social: 'Social',
  trafego: 'Tráfego',
  criacao: 'Criação',
  interno: 'Interno',
};

const AREA_COLORS: Record<TaskArea, string> = {
  social: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  trafego: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  criacao: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
  interno: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/30',
};

const STATUS_META: Record<TaskStatus, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30' },
  in_progress: { label: 'Em andamento', color: 'bg-blue-500/10 text-blue-300 border-blue-500/30' },
  done: { label: 'Concluída', color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' },
  not_done: { label: 'Não feita', color: 'bg-red-500/10 text-red-300 border-red-500/30' },
  carryover: { label: 'Carryover', color: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
};

export default function HistoryClient({ initialTasks, initialMonth }: Props) {
  const [month, setMonth] = useState(parseISO(initialMonth + '-01'));
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [loading, setLoading] = useState(false);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  async function loadMonth(newMonth: Date) {
    setLoading(true);
    setMonth(newMonth);
    try {
      const start = format(startOfMonth(newMonth), 'yyyy-MM-dd');
      const end = format(endOfMonth(newMonth), 'yyyy-MM-dd');
      const res = await fetch(`/api/tasks?start=${start}&end=${end}`);
      const data = await res.json();
      setTasks(data.tasks || []);
      setExpandedDates(new Set());
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === 'done').length;
    const notDone = tasks.filter((t) => t.status === 'not_done').length;
    const carryover = tasks.filter((t) => t.status === 'carryover').length;
    const decided = done + notDone;
    const rate = decided > 0 ? Math.round((done / decided) * 100) : 0;
    return { total, done, notDone, carryover, rate };
  }, [tasks]);

  // Tarefas crônicas — agrupadas por raiz (parent_task_id || id) com 2+ dias na cadeia
  const chronic = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((t) => {
      const root = t.parent_task_id || t.id;
      const arr = map.get(root) || [];
      arr.push(t);
      map.set(root, arr);
    });
    return Array.from(map.entries())
      .filter(([, rows]) => rows.length >= 2)
      .map(([rootId, rows]) => {
        const sorted = [...rows].sort((a, b) => a.task_date.localeCompare(b.task_date));
        const last = sorted[sorted.length - 1];
        const anyDone = sorted.some((r) => r.status === 'done');
        return {
          rootId,
          description: last.description,
          clientName: last.client?.name || null,
          days: sorted.length,
          firstDate: sorted[0].task_date,
          lastDate: last.task_date,
          closed: anyDone,
        };
      })
      .sort((a, b) => b.days - a.days);
  }, [tasks]);

  // Agrupa tasks por data
  const byDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((t) => {
      const arr = map.get(t.task_date) || [];
      arr.push(t);
      map.set(t.task_date, arr);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [tasks]);

  function toggleDate(date: string) {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  return (
    <main className="max-w-5xl mx-auto px-4 md:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Meu histórico</h1>
        <p className="text-zinc-400 text-sm mt-2">
          Suas tarefas dos meses anteriores. Use pra revisar o que você entregou e o que arrastou.
        </p>
      </div>

      {/* Month navigator */}
      <div className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 mb-6">
        <button
          onClick={() => loadMonth(subMonths(month, 1))}
          disabled={loading}
          className="p-2 hover:bg-zinc-800 rounded-lg transition text-zinc-400 hover:text-white disabled:opacity-50"
        >
          ←
        </button>
        <h2 className="text-lg font-semibold capitalize">
          {format(month, "MMMM 'de' yyyy", { locale: ptBR })}
          {loading && <span className="text-zinc-500 text-sm ml-2">carregando...</span>}
        </h2>
        <button
          onClick={() => loadMonth(addMonths(month, 1))}
          disabled={loading}
          className="p-2 hover:bg-zinc-800 rounded-lg transition text-zinc-400 hover:text-white disabled:opacity-50"
        >
          →
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Concluídas" value={stats.done} tone="emerald" />
        <StatCard label="Não feitas" value={stats.notDone} tone="red" />
        <StatCard label="Carryovers" value={stats.carryover} tone="amber" />
        <StatCard label="Taxa" value={`${stats.rate}%`} tone="green" />
      </div>

      {/* Chronic tasks */}
      {chronic.length > 0 && (
        <section className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-3">
            ⚠️ Tarefas que arrastaram no mês
          </h2>
          <div className="space-y-2">
            {chronic.map((c) => (
              <div
                key={c.rootId}
                className="flex items-start justify-between gap-3 border border-zinc-800 rounded-lg p-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-100">{c.description}</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    {c.clientName && <>{c.clientName} · </>}
                    de {formatBR(c.firstDate)} até {formatBR(c.lastDate)}
                  </p>
                </div>
                <div className="flex-shrink-0 flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded border bg-amber-500/10 text-amber-300 border-amber-500/30">
                    {c.days} dias
                  </span>
                  {c.closed && (
                    <span className="text-xs px-2 py-0.5 rounded border bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                      ✓ fechada
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Days */}
      {byDate.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <p className="text-lg">Nenhuma tarefa registrada neste mês.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {byDate.map(([date, dayTasks]) => {
            const done = dayTasks.filter((t) => t.status === 'done').length;
            const total = dayTasks.length;
            const rate = total > 0 ? Math.round((done / total) * 100) : 0;
            const isExpanded = expandedDates.has(date);

            return (
              <div
                key={date}
                className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden"
              >
                <button
                  onClick={() => toggleDate(date)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-900/80 transition text-left"
                >
                  <div>
                    <p className="text-sm text-zinc-500 capitalize">{formatLong(date)}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {done}/{total} concluídas · {rate}%
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden md:flex gap-1">
                      {(['done', 'not_done', 'carryover'] as TaskStatus[]).map((s) => {
                        const count = dayTasks.filter((t) => t.status === s).length;
                        if (count === 0) return null;
                        return (
                          <span
                            key={s}
                            className={`text-xs px-2 py-0.5 rounded border ${STATUS_META[s].color}`}
                          >
                            {count} {STATUS_META[s].label.toLowerCase()}
                          </span>
                        );
                      })}
                    </div>
                    <span className="text-zinc-500">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-zinc-800 divide-y divide-zinc-800">
                    {dayTasks.map((task) => {
                      const status = STATUS_META[task.status];
                      return (
                        <div key={task.id} className="px-5 py-3">
                          <p className="text-sm text-zinc-100 leading-relaxed">
                            {task.description}
                          </p>
                          <div className="flex items-center flex-wrap gap-2 mt-2">
                            {task.client && (
                              <span className="text-xs text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded">
                                {task.client.name}
                              </span>
                            )}
                            {task.area && (
                              <span className={`text-xs px-2 py-0.5 rounded border ${AREA_COLORS[task.area]}`}>
                                {AREA_LABELS[task.area]}
                              </span>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded border ${status.color}`}>
                              {status.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: number | string;
  tone?: 'slate' | 'emerald' | 'amber' | 'green' | 'red';
}) {
  const colors: Record<string, string> = {
    slate: 'text-zinc-100',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
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
