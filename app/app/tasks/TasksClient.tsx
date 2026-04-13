'use client';

import { useState, FormEvent } from 'react';
import { Task, Client, DailySession, TaskArea, TaskType } from '@/lib/types';
import { formatLong } from '@/lib/dates';

interface Props {
  initialTasks: Task[];
  clients: Client[];
  today: string;
  dailySession: DailySession | null;
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

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30' },
  in_progress: { label: 'Em andamento', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  done: { label: 'Concluída', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  not_done: { label: 'Não feita', color: 'bg-red-500/10 text-red-400 border-red-500/30' },
  carryover: { label: 'Carryover', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
};

export default function TasksClient({ initialTasks, clients, today, dailySession }: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form state
  const [description, setDescription] = useState('');
  const [clientId, setClientId] = useState('');
  const [area, setArea] = useState<TaskArea | ''>('');
  const [taskType, setTaskType] = useState<TaskType>('pontual');

  const canEdit = !dailySession || dailySession.status !== 'in_progress';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          client_id: clientId || null,
          area: area || null,
          task_type: taskType,
          task_date: today,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Erro ao criar tarefa');
        return;
      }
      setTasks([...tasks, data.task]);
      setDescription('');
      setClientId('');
      setArea('');
      setTaskType('pontual');
      setShowForm(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta tarefa?')) return;
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Erro ao excluir');
      return;
    }
    setTasks(tasks.filter((t) => t.id !== id));
  }

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === 'done').length;
  const pendingTasks = tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress').length;

  return (
    <main className="max-w-5xl mx-auto px-4 md:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <p className="text-sm text-zinc-500 capitalize">{formatLong(today)}</p>
        <h1 className="text-3xl font-bold mt-1">Minhas tarefas</h1>
        <p className="text-zinc-400 text-sm mt-2">
          Mapeie aqui as demandas que vai executar hoje. Adicione com folga antes da daily.
        </p>
      </div>

      {/* Daily status banner */}
      {dailySession?.status === 'in_progress' && (
        <div className="mb-6 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <p className="text-amber-300 text-sm font-medium">
            ⚡ Daily em andamento pelo orquestrador — alterações bloqueadas até o fim da apresentação.
          </p>
        </div>
      )}
      {dailySession?.status === 'completed' && (
        <div className="mb-6 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
          <p className="text-emerald-300 text-sm font-medium">
            ✓ Daily de hoje já foi concluída. Você pode adicionar novas demandas que surgirem durante o dia.
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wider">Total hoje</div>
          <div className="text-2xl font-bold mt-1">{totalTasks}</div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wider">Concluídas</div>
          <div className="text-2xl font-bold mt-1 text-emerald-400">{doneTasks}</div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wider">Em aberto</div>
          <div className="text-2xl font-bold mt-1 text-amber-400">{pendingTasks}</div>
        </div>
      </div>

      {/* Add task button / form */}
      {canEdit && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full mb-6 bg-green-500/10 border border-dashed border-green-500/40 hover:bg-green-500/20 hover:border-green-500/60 rounded-xl py-4 text-green-300 font-medium transition"
        >
          + Adicionar tarefa
        </button>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
              Demanda
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={2}
              autoFocus
              placeholder="Ex: Criar criativos para campanha do Grupo Real"
              className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-700 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                Cliente
              </label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
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
                value={area}
                onChange={(e) => setArea(e.target.value as TaskArea | '')}
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
                value={taskType}
                onChange={(e) => setTaskType(e.target.value as TaskType)}
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
              disabled={loading}
              className="bg-green-500 hover:bg-green-600 disabled:bg-green-800 text-white font-medium px-4 py-2 rounded-lg transition text-sm"
            >
              {loading ? 'Salvando...' : 'Adicionar'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setDescription('');
              }}
              className="text-zinc-400 hover:text-white px-4 py-2 rounded-lg transition text-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Task list */}
      <div className="space-y-2">
        {tasks.length === 0 ? (
          <div className="text-center py-16 text-zinc-500">
            <p className="text-lg">Nenhuma tarefa para hoje ainda.</p>
            <p className="text-sm mt-1">Comece adicionando suas demandas.</p>
          </div>
        ) : (
          tasks.map((task) => {
            const status = STATUS_LABELS[task.status];
            return (
              <div
                key={task.id}
                className="bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 transition group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-zinc-100 leading-relaxed">{task.description}</p>
                    <div className="flex items-center flex-wrap gap-2 mt-2.5">
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
                  {canEdit && task.status === 'pending' && (
                    <button
                      onClick={() => handleDelete(task.id)}
                      className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition text-sm px-2"
                      title="Excluir"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
