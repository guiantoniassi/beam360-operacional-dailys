'use client';

import { useMemo, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Task,
  Client,
  DailySession,
  CarryoverJustification,
  TaskArea,
  TaskType,
  TaskStatus,
} from '@/lib/types';
import { formatLong, formatBR } from '@/lib/dates';

interface Member {
  id: string;
  username: string;
  full_name: string;
  color: string;
}

interface Props {
  date: string;
  previousDate: string;
  dailySession: DailySession;
  initialTasks: Task[];
  members: Member[];
  clients: Client[];
  initialJustifications: CarryoverJustification[];
  viewMode: 'live' | 'summary';
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

const STATUS_META: Record<TaskStatus, { label: string; color: string; dot: string }> = {
  pending: {
    label: 'Pendente',
    color: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/30',
    dot: 'bg-zinc-400',
  },
  in_progress: {
    label: 'Em andamento',
    color: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
    dot: 'bg-blue-400',
  },
  done: {
    label: 'Concluída',
    color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    dot: 'bg-emerald-400',
  },
  not_done: {
    label: 'Não feita',
    color: 'bg-red-500/10 text-red-300 border-red-500/30',
    dot: 'bg-red-400',
  },
  carryover: {
    label: 'Carryover',
    color: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    dot: 'bg-amber-400',
  },
};

type Step = 'carryovers' | 'team' | 'finalize';

export default function DailyPresentation({
  date,
  previousDate,
  dailySession,
  initialTasks,
  members,
  clients,
  initialJustifications,
  viewMode,
}: Props) {
  const router = useRouter();
  const isLive = viewMode === 'live' && dailySession.status === 'in_progress';

  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [justifications, setJustifications] = useState<CarryoverJustification[]>(initialJustifications);
  const [step, setStep] = useState<Step>('carryovers');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Add-task-live modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForUserId, setAddForUserId] = useState<string>('');
  const [addDescription, setAddDescription] = useState('');
  const [addClientId, setAddClientId] = useState('');
  const [addArea, setAddArea] = useState<TaskArea | ''>('');
  const [addType, setAddType] = useState<TaskType>('pontual');

  const justifMap = useMemo(() => {
    const m = new Map<string, CarryoverJustification>();
    justifications.forEach((j) => m.set(j.task_id, j));
    return m;
  }, [justifications]);

  // Draft justifications being edited
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    initialJustifications.forEach((j) => (d[j.task_id] = j.justification));
    return d;
  });

  const carryovers = useMemo(
    () => tasks.filter((t) => t.status === 'carryover'),
    [tasks]
  );

  const tasksByMember = useMemo(() => {
    const map = new Map<string, Task[]>();
    members.forEach((m) => map.set(m.id, []));
    tasks.forEach((t) => {
      if (t.status === 'carryover') return; // shown separately
      const arr = map.get(t.user_id) || [];
      arr.push(t);
      map.set(t.user_id, arr);
    });
    return map;
  }, [tasks, members]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === 'done').length;
    const notDone = tasks.filter((t) => t.status === 'not_done').length;
    const pending = tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress').length;
    const carryCount = tasks.filter((t) => t.status === 'carryover').length;
    const rate = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, notDone, pending, carryCount, rate };
  }, [tasks]);

  const allCarryoversJustified = carryovers.every((c) => justifMap.has(c.id));

  async function saveJustification(taskId: string) {
    const text = drafts[taskId]?.trim();
    if (!text) {
      setError('Justificativa não pode estar vazia.');
      return;
    }
    setBusy(taskId);
    setError(null);
    try {
      const res = await fetch(`/api/daily/${date}/justify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, justification: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erro ao salvar justificativa');
        return;
      }
      const saved: CarryoverJustification = data.justification;
      setJustifications((prev) => {
        const filtered = prev.filter((j) => j.task_id !== taskId);
        return [...filtered, saved];
      });
    } finally {
      setBusy(null);
    }
  }

  async function updateTaskStatus(taskId: string, status: TaskStatus) {
    setBusy(taskId);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erro ao atualizar tarefa');
        return;
      }
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, ...data.task, user: t.user } : t))
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleAddLiveTask(e: FormEvent) {
    e.preventDefault();
    if (!addForUserId || !addDescription.trim()) return;
    setBusy('add');
    setError(null);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: addForUserId,
          description: addDescription.trim(),
          client_id: addClientId || null,
          area: addArea || null,
          task_type: addType,
          task_date: date,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erro ao criar tarefa');
        return;
      }
      // Refresh — the API returns the task without relations, reload all
      router.refresh();
      setTasks((prev) => [...prev, { ...data.task, user: members.find((m) => m.id === addForUserId) }]);
      setShowAddModal(false);
      setAddDescription('');
      setAddClientId('');
      setAddArea('');
      setAddType('pontual');
    } finally {
      setBusy(null);
    }
  }

  async function handleFinalize() {
    if (!allCarryoversJustified) {
      setError('Todos os carryovers precisam de justificativa antes de finalizar.');
      setStep('carryovers');
      return;
    }
    if (!confirm('Finalizar a daily de hoje? Tarefas não concluídas serão marcadas como não feitas e migradas para o próximo dia útil como carryover.')) {
      return;
    }
    setBusy('finalize');
    setError(null);
    try {
      const res = await fetch(`/api/daily/${date}/complete`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erro ao finalizar daily');
        return;
      }
      router.push('/orchestrate');
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
            {isLive ? 'Daily em andamento' : 'Daily concluída'}
          </p>
          <h1 className="text-3xl font-bold capitalize mt-1">{formatLong(date)}</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Conduzida por <span className="text-zinc-200 font-medium">{dailySession.orchestrator_name || '—'}</span>
            {dailySession.completed_at && (
              <> · Finalizada em {formatBR(dailySession.completed_at, "dd/MM 'às' HH:mm")}</>
            )}
          </p>
        </div>
        <button
          onClick={() => router.push('/orchestrate')}
          className="text-sm text-zinc-400 hover:text-white transition self-start md:self-auto"
        >
          ← Voltar ao calendário
        </button>
      </div>

      {/* Stats dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatCard label="Total de tarefas" value={stats.total} />
        <StatCard label="Concluídas" value={stats.done} tone="emerald" />
        <StatCard label="Em aberto" value={stats.pending} tone="blue" />
        <StatCard label="Carryovers" value={stats.carryCount} tone="amber" />
        <StatCard label="Taxa de conclusão" value={`${stats.rate}%`} tone="green" />
      </div>

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Step navigation (live) */}
      {isLive && (
        <div className="flex gap-2 mb-6 bg-zinc-900/50 border border-zinc-800 rounded-xl p-1.5">
          <StepTab
            active={step === 'carryovers'}
            onClick={() => setStep('carryovers')}
            label={`1. Carryovers (${carryovers.length})`}
            done={carryovers.length > 0 && allCarryoversJustified}
          />
          <StepTab
            active={step === 'team'}
            onClick={() => setStep('team')}
            label="2. Time"
          />
          <StepTab
            active={step === 'finalize'}
            onClick={() => setStep('finalize')}
            label="3. Finalizar"
          />
        </div>
      )}

      {/* SUMMARY VIEW */}
      {!isLive && (
        <div className="space-y-6">
          {carryovers.length > 0 && (
            <section className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4">Carryovers do dia</h2>
              <div className="space-y-3">
                {carryovers.map((c) => {
                  const j = justifMap.get(c.id);
                  return (
                    <div key={c.id} className="border border-zinc-800 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <UserDot color={c.user?.color || '#64748b'} />
                        <div className="flex-1 min-w-0">
                          <p className="text-zinc-100">{c.description}</p>
                          <TaskMeta task={c} />
                          {j && (
                            <div className="mt-3 bg-zinc-950/60 border border-zinc-800 rounded-lg p-3">
                              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
                                Justificativa · {j.orchestrator_name}
                              </p>
                              <p className="text-zinc-300 text-sm">{j.justification}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <TeamSection
            members={members}
            tasksByMember={tasksByMember}
            readOnly
          />
        </div>
      )}

      {/* LIVE: Carryovers step */}
      {isLive && step === 'carryovers' && (
        <section className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Carryovers de {formatBR(previousDate)}</h2>
              <p className="text-sm text-zinc-400 mt-0.5">
                Cada tarefa que não foi concluída no dia anterior precisa de uma justificativa nova.
              </p>
            </div>
            <button
              onClick={() => setStep('team')}
              disabled={carryovers.length > 0 && !allCarryoversJustified}
              className="bg-green-500 hover:bg-green-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-medium px-4 py-2 rounded-lg transition text-sm"
            >
              Avançar →
            </button>
          </div>

          {carryovers.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <p>Nenhum carryover hoje. 🎉</p>
              <p className="text-sm mt-1">Pode seguir direto para o planejamento do time.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {carryovers.map((c) => {
                const saved = justifMap.get(c.id);
                const draft = drafts[c.id] ?? '';
                const isDirty = draft.trim() !== (saved?.justification || '');
                return (
                  <div key={c.id} className="border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <UserDot color={c.user?.color || '#64748b'} />
                      <div className="flex-1 min-w-0">
                        <p className="text-zinc-100 font-medium">{c.description}</p>
                        <TaskMeta task={c} />
                      </div>
                      {saved && (
                        <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded">
                          ✓ justificado
                        </span>
                      )}
                    </div>
                    <textarea
                      value={draft}
                      onChange={(e) => setDrafts({ ...drafts, [c.id]: e.target.value })}
                      rows={2}
                      placeholder="Por que essa tarefa não foi concluída? O que muda hoje?"
                      className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-700 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                    />
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={() => saveJustification(c.id)}
                        disabled={busy === c.id || !isDirty || !draft.trim()}
                        className="bg-green-500 hover:bg-green-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-medium px-3 py-1.5 rounded-lg transition text-xs"
                      >
                        {busy === c.id ? 'Salvando...' : saved ? 'Atualizar' : 'Salvar justificativa'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* LIVE: Team step */}
      {isLive && step === 'team' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Planejamento do time</h2>
              <p className="text-sm text-zinc-400">
                Marque o status real de cada tarefa conforme o time apresenta.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium px-3 py-2 rounded-lg transition text-sm"
              >
                + Tarefa ao vivo
              </button>
              <button
                onClick={() => setStep('finalize')}
                className="bg-green-500 hover:bg-green-600 text-white font-medium px-4 py-2 rounded-lg transition text-sm"
              >
                Avançar →
              </button>
            </div>
          </div>

          <TeamSection
            members={members}
            tasksByMember={tasksByMember}
            onUpdateStatus={updateTaskStatus}
            busy={busy}
          />
        </div>
      )}

      {/* LIVE: Finalize step */}
      {isLive && step === 'finalize' && (
        <section className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-1">Finalizar daily</h2>
          <p className="text-sm text-zinc-400 mb-6">
            Revise o resumo antes de fechar. Após finalizar, tarefas não concluídas viram carryovers do próximo dia útil.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard label="Total" value={stats.total} />
            <StatCard label="Concluídas" value={stats.done} tone="emerald" />
            <StatCard label="Não feitas" value={stats.notDone + stats.pending} tone="red" />
            <StatCard label="Taxa" value={`${stats.rate}%`} tone="green" />
          </div>

          {carryovers.length > 0 && !allCarryoversJustified && (
            <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-amber-200 text-sm">
              Há carryovers sem justificativa. Volte para a etapa 1 antes de finalizar.
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleFinalize}
              disabled={busy === 'finalize' || !allCarryoversJustified}
              className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-medium px-5 py-2.5 rounded-lg transition"
            >
              {busy === 'finalize' ? 'Finalizando...' : 'Finalizar daily'}
            </button>
            <button
              onClick={() => setStep('team')}
              className="text-zinc-400 hover:text-white px-4 py-2.5 rounded-lg transition"
            >
              ← Voltar
            </button>
          </div>
        </section>
      )}

      {/* Add live task modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-lg w-full">
            <h3 className="text-xl font-bold mb-4">Adicionar tarefa ao vivo</h3>
            <form onSubmit={handleAddLiveTask} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                  Para quem?
                </label>
                <select
                  value={addForUserId}
                  onChange={(e) => setAddForUserId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Selecione o membro...</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                  Demanda
                </label>
                <textarea
                  value={addDescription}
                  onChange={(e) => setAddDescription(e.target.value)}
                  required
                  rows={2}
                  className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-700 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Cliente
                  </label>
                  <select
                    value={addClientId}
                    onChange={(e) => setAddClientId(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">—</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Área
                  </label>
                  <select
                    value={addArea}
                    onChange={(e) => setAddArea(e.target.value as TaskArea | '')}
                    className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">—</option>
                    <option value="social">Social</option>
                    <option value="trafego">Tráfego</option>
                    <option value="criacao">Criação</option>
                    <option value="interno">Interno</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Tipo
                  </label>
                  <select
                    value={addType}
                    onChange={(e) => setAddType(e.target.value as TaskType)}
                    className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="pontual">Pontual</option>
                    <option value="recorrente">Recorrente</option>
                    <option value="evento">Evento</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={busy === 'add'}
                  className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-green-800 text-white font-medium py-2.5 rounded-lg transition"
                >
                  {busy === 'add' ? 'Adicionando...' : 'Adicionar tarefa'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="text-zinc-400 hover:text-white px-4 py-2.5 rounded-lg transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
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

function StepTab({
  active,
  onClick,
  label,
  done,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  done?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition ${
        active
          ? 'bg-green-500/20 text-green-300 border border-green-500/40'
          : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60 border border-transparent'
      }`}
    >
      {done && <span className="text-emerald-400 mr-1">✓</span>}
      {label}
    </button>
  );
}

function UserDot({ color }: { color: string }) {
  return (
    <div
      className="w-2 h-2 rounded-full flex-shrink-0 mt-2"
      style={{ backgroundColor: color }}
    />
  );
}

function TaskMeta({ task }: { task: Task }) {
  const status = STATUS_META[task.status];
  return (
    <div className="flex items-center flex-wrap gap-2 mt-2">
      {task.user && (
        <span className="text-xs text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded">
          {task.user.full_name}
        </span>
      )}
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
      <span className={`text-xs px-2 py-0.5 rounded border ${status.color}`}>{status.label}</span>
    </div>
  );
}

function TeamSection({
  members,
  tasksByMember,
  onUpdateStatus,
  busy,
  readOnly,
}: {
  members: Member[];
  tasksByMember: Map<string, Task[]>;
  onUpdateStatus?: (taskId: string, status: TaskStatus) => void;
  busy?: string | null;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-4">
      {members.map((member) => {
        const memberTasks = tasksByMember.get(member.id) || [];
        const done = memberTasks.filter((t) => t.status === 'done').length;
        const total = memberTasks.length;
        const rate = total > 0 ? Math.round((done / total) * 100) : 0;

        return (
          <div
            key={member.id}
            className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden"
          >
            <div
              className="flex items-center justify-between px-5 py-4 border-b border-zinc-800"
              style={{ borderLeftWidth: 4, borderLeftColor: member.color }}
            >
              <div>
                <h3 className="font-semibold text-zinc-100">{member.full_name}</h3>
                <p className="text-xs text-zinc-500">
                  {done}/{total} concluídas · {rate}%
                </p>
              </div>
              <div className="text-xs text-zinc-500">
                {total === 0 ? 'sem tarefas' : `${total} ${total === 1 ? 'tarefa' : 'tarefas'}`}
              </div>
            </div>

            <div className="divide-y divide-zinc-800">
              {memberTasks.length === 0 ? (
                <div className="px-5 py-6 text-center text-sm text-zinc-500">
                  Nenhuma tarefa registrada para hoje.
                </div>
              ) : (
                memberTasks.map((task) => {
                  const status = STATUS_META[task.status];
                  return (
                    <div key={task.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${status.dot}`} />
                            <p className="text-zinc-100 text-sm leading-relaxed">
                              {task.description}
                            </p>
                          </div>
                          <div className="flex items-center flex-wrap gap-2 mt-2 ml-3.5">
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

                        {!readOnly && onUpdateStatus && (
                          <div className="flex gap-1 flex-shrink-0">
                            <StatusBtn
                              active={task.status === 'done'}
                              onClick={() => onUpdateStatus(task.id, 'done')}
                              disabled={busy === task.id}
                              tone="emerald"
                              title="Concluída"
                            >
                              ✓
                            </StatusBtn>
                            <StatusBtn
                              active={task.status === 'in_progress'}
                              onClick={() => onUpdateStatus(task.id, 'in_progress')}
                              disabled={busy === task.id}
                              tone="blue"
                              title="Em andamento"
                            >
                              ◐
                            </StatusBtn>
                            <StatusBtn
                              active={task.status === 'not_done'}
                              onClick={() => onUpdateStatus(task.id, 'not_done')}
                              disabled={busy === task.id}
                              tone="red"
                              title="Não feita"
                            >
                              ✕
                            </StatusBtn>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusBtn({
  active,
  onClick,
  disabled,
  tone,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  tone: 'emerald' | 'blue' | 'red';
  title: string;
  children: React.ReactNode;
}) {
  const tones: Record<string, { active: string; idle: string }> = {
    emerald: {
      active: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300',
      idle: 'border-zinc-800 text-zinc-500 hover:text-emerald-300 hover:border-emerald-500/40',
    },
    blue: {
      active: 'bg-blue-500/20 border-blue-500/50 text-blue-300',
      idle: 'border-zinc-800 text-zinc-500 hover:text-blue-300 hover:border-blue-500/40',
    },
    red: {
      active: 'bg-red-500/20 border-red-500/50 text-red-300',
      idle: 'border-zinc-800 text-zinc-500 hover:text-red-300 hover:border-red-500/40',
    },
  };
  const style = active ? tones[tone].active : tones[tone].idle;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`w-8 h-8 rounded-lg border text-sm font-bold transition disabled:opacity-50 ${style}`}
    >
      {children}
    </button>
  );
}
