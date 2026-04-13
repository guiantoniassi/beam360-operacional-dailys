import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { listRecentWeeks, toWeekStart } from '@/lib/weekly';
import TopBar from '@/components/TopBar';
import { formatBR } from '@/lib/dates';
import { format } from 'date-fns';

export default async function WeeklyListPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'orchestrator') redirect('/tasks');

  const weeks = await listRecentWeeks();
  const currentWeekStart = toWeekStart(format(new Date(), 'yyyy-MM-dd'));
  const hasCurrent = weeks.some((w) => w.weekStart === currentWeekStart);

  const allWeeks = hasCurrent
    ? weeks
    : [
        {
          weekStart: currentWeekStart,
          weekEnd: format(
            new Date(new Date(currentWeekStart).setDate(new Date(currentWeekStart).getDate() + 4)),
            'yyyy-MM-dd'
          ),
          completedDailys: 0,
          reviewStatus: 'pending' as const,
        },
        ...weeks,
      ];

  return (
    <div className="min-h-screen">
      <TopBar userName="Orquestrador" role="orchestrator" color="#f59e0b" />
      <main className="max-w-5xl mx-auto px-4 md:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Weekly Reviews</h1>
          <p className="text-zinc-400 text-sm mt-2">
            Compilação semanal das dailys. Cada semana pode ser revisada independentemente,
            mesmo que nem todas as dailys tenham acontecido.
          </p>
        </div>

        <div className="space-y-3">
          {allWeeks.map((week) => {
            const statusMeta =
              week.reviewStatus === 'completed'
                ? { label: 'Revisão feita', color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' }
                : week.reviewStatus === 'in_progress'
                ? { label: 'Rascunho', color: 'bg-blue-500/10 text-blue-300 border-blue-500/30' }
                : { label: 'Aguardando revisão', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30' };

            return (
              <Link
                key={week.weekStart}
                href={`/orchestrate/weekly/${week.weekStart}`}
                className="block bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/70 rounded-2xl p-5 transition"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {formatBR(week.weekStart)} → {formatBR(week.weekEnd)}
                    </h2>
                    <p className="text-sm text-zinc-400 mt-0.5">
                      {week.completedDailys}/5 dailys concluídas
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2.5 py-1 rounded border ${statusMeta.color}`}>
                      {statusMeta.label}
                    </span>
                    <span className="text-zinc-500 text-xl">→</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
