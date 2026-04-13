'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isWeekend,
  isToday,
  isSameMonth,
  addMonths,
  subMonths,
  parseISO,
  startOfWeek,
  endOfWeek,
  isAfter,
  startOfDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DailySession } from '@/lib/types';

interface Member {
  id: string;
  username: string;
  full_name: string;
  color: string;
}

interface Props {
  initialSessions: DailySession[];
  members: Member[];
  initialMonth: string;
}

export default function CalendarClient({ initialSessions, members, initialMonth }: Props) {
  const [month, setMonth] = useState(parseISO(initialMonth + '-01'));
  const [sessions, setSessions] = useState<DailySession[]>(initialSessions);
  const [loading, setLoading] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [orchestratorName, setOrchestratorName] = useState('');

  const router = useRouter();

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, DailySession>();
    sessions.forEach((s) => map.set(s.session_date, s));
    return map;
  }, [sessions]);

  async function loadMonth(newMonth: Date) {
    setMonth(newMonth);
    const monthStr = format(newMonth, 'yyyy-MM');
    const res = await fetch(`/api/daily?month=${monthStr}`);
    const data = await res.json();
    setSessions(data.sessions || []);
  }

  function handleDayClick(day: Date) {
    if (isWeekend(day)) return;
    const dateStr = format(day, 'yyyy-MM-dd');
    const session = sessionsByDate.get(dateStr);

    if (session?.status === 'completed') {
      router.push(`/orchestrate/daily/${dateStr}?view=summary`);
      return;
    }
    if (session?.status === 'in_progress') {
      router.push(`/orchestrate/daily/${dateStr}`);
      return;
    }

    const today = startOfDay(new Date());
    if (isAfter(startOfDay(day), today)) {
      alert('Não é possível iniciar uma daily em data futura.');
      return;
    }

    setSelectedDate(dateStr);
    setShowStartModal(true);
  }

  async function handleDeleteDaily(dateStr: string) {
    if (!confirm(`Excluir a daily de ${format(parseISO(dateStr), "dd/MM/yyyy")}? Todas as tarefas e justificativas deste dia serão removidas.`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/daily/${dateStr}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Erro ao excluir daily');
        return;
      }
      setSessions((prev) => prev.filter((s) => s.session_date !== dateStr));
    } finally {
      setLoading(false);
    }
  }

  async function handleStartDaily(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDate || !orchestratorName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_date: selectedDate, orchestrator_name: orchestratorName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Erro ao iniciar daily');
        return;
      }
      router.push(`/orchestrate/daily/${selectedDate}`);
    } finally {
      setLoading(false);
    }
  }

  const totalDone = sessions.filter((s) => s.status === 'completed').length;
  const totalPending = sessions.filter((s) => s.status === 'in_progress').length;

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-6 py-8">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard do Orquestrador</h1>
          <p className="text-zinc-400 text-sm mt-2">
            Clique em um dia útil para iniciar ou retomar uma daily.
          </p>
        </div>
        <div className="flex gap-3">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3">
            <div className="text-xs text-zinc-500 uppercase tracking-wider">Concluídas</div>
            <div className="text-xl font-bold text-emerald-400">{totalDone}</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3">
            <div className="text-xs text-zinc-500 uppercase tracking-wider">Em andamento</div>
            <div className="text-xl font-bold text-amber-400">{totalPending}</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3">
            <div className="text-xs text-zinc-500 uppercase tracking-wider">Equipe</div>
            <div className="text-xl font-bold">{members.length}</div>
          </div>
        </div>
      </div>

      {/* Calendário */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => loadMonth(subMonths(month, 1))}
            className="p-2 hover:bg-zinc-800 rounded-lg transition text-zinc-400 hover:text-white"
          >
            ←
          </button>
          <h2 className="text-xl font-semibold capitalize">
            {format(month, "MMMM 'de' yyyy", { locale: ptBR })}
          </h2>
          <button
            onClick={() => loadMonth(addMonths(month, 1))}
            className="p-2 hover:bg-zinc-800 rounded-lg transition text-zinc-400 hover:text-white"
          >
            →
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
            <div key={d} className="text-center text-xs text-zinc-500 uppercase tracking-wider py-2">
              {d}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7 gap-2">
          {days.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const session = sessionsByDate.get(dateStr);
            const weekend = isWeekend(day);
            const outOfMonth = !isSameMonth(day, month);
            const today = isToday(day);
            const future = isAfter(startOfDay(day), startOfDay(new Date()));

            let bg = 'bg-zinc-950/40';
            let border = 'border-zinc-800';
            let textColor = 'text-zinc-400';
            let status = '';

            if (weekend) {
              bg = 'bg-zinc-950/20';
              textColor = 'text-zinc-700';
            } else if (session?.status === 'completed') {
              bg = 'bg-emerald-500/15';
              border = 'border-emerald-500/40';
              textColor = 'text-emerald-300';
              status = '✓ Feita';
            } else if (session?.status === 'in_progress') {
              bg = 'bg-amber-500/15';
              border = 'border-amber-500/40';
              textColor = 'text-amber-300';
              status = '⚡ Em andamento';
            } else if (today && !weekend && !outOfMonth) {
              bg = 'bg-blue-500/10';
              border = 'border-blue-500/30';
              textColor = 'text-blue-300';
              status = '◦ Em breve';
            } else if (!future && !weekend && !outOfMonth) {
              bg = 'bg-red-500/10';
              border = 'border-red-500/30';
              textColor = 'text-red-300';
              status = '✗ Não realizada';
            }

            if (outOfMonth) {
              bg += ' opacity-30';
            }
            if (today) {
              border = 'border-green-500 ring-2 ring-green-500/30';
            }

            return (
              <div key={dateStr} className="relative group/day">
                <button
                  onClick={() => handleDayClick(day)}
                  disabled={weekend || outOfMonth}
                  className={`w-full aspect-square p-2 rounded-xl border transition text-left ${bg} ${border} ${textColor} ${
                    weekend || outOfMonth ? 'cursor-default' : 'hover:scale-105 hover:shadow-lg cursor-pointer'
                  }`}
                >
                  <div className="text-sm font-semibold">{format(day, 'd')}</div>
                  {status && <div className="text-[10px] mt-1 leading-tight">{status}</div>}
                </button>
                {session && !outOfMonth && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteDaily(dateStr); }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none flex items-center justify-center opacity-0 group-hover/day:opacity-100 transition hover:bg-red-400 z-10"
                    title="Excluir daily"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-6 pt-6 border-t border-zinc-800 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-emerald-500/30 border border-emerald-500/40"></div>
            <span>Daily concluída</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-amber-500/30 border border-amber-500/40"></div>
            <span>Em andamento</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500/20 border border-blue-500/30"></div>
            <span>Em breve (hoje)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-500/20 border border-red-500/30"></div>
            <span>Não realizada</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-zinc-950 border border-zinc-800"></div>
            <span>Futuro / Fim de semana</span>
          </div>
        </div>
      </div>

      {/* Modal: iniciar daily */}
      {showStartModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-1">Iniciar Daily</h3>
            <p className="text-sm text-zinc-400 mb-5">
              {selectedDate &&
                format(parseISO(selectedDate), "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </p>

            <form onSubmit={handleStartDaily} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                  Quem está conduzindo hoje?
                </label>
                <select
                  value={orchestratorName}
                  onChange={(e) => setOrchestratorName(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Selecione...</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.full_name}>
                      {m.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-green-800 text-white font-medium py-2.5 rounded-lg transition"
                >
                  {loading ? 'Iniciando...' : 'Iniciar daily'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowStartModal(false);
                    setOrchestratorName('');
                  }}
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
