import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { format, subDays, parseISO, isWeekend } from 'date-fns';
import TopBar from '@/components/TopBar';
import DailyPresentation from './DailyPresentation';

export default async function DailyPage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'orchestrator') redirect('/tasks');

  const { date } = await params;
  const sp = await searchParams;

  const { data: dailySession } = await supabaseAdmin
    .from('daily_sessions')
    .select('*')
    .eq('session_date', date)
    .maybeSingle();

  if (!dailySession) {
    redirect('/orchestrate');
  }

  // Tasks do dia com user e client
  const { data: tasks } = await supabaseAdmin
    .from('tasks')
    .select('*, client:clients(id, name), user:users(id, username, full_name, color)')
    .eq('task_date', date)
    .order('user_id', { ascending: true })
    .order('created_at', { ascending: true });

  // Membros ativos
  const { data: members } = await supabaseAdmin
    .from('users')
    .select('id, username, full_name, color')
    .eq('role', 'member')
    .eq('is_active', true)
    .order('full_name');

  // Clientes ativos (para orquestrador adicionar tarefas ao vivo)
  const { data: clients } = await supabaseAdmin
    .from('clients')
    .select('*')
    .eq('status', 'active')
    .order('name');

  // Justificativas desta sessão
  const { data: justifications } = await supabaseAdmin
    .from('carryover_justifications')
    .select('*')
    .eq('daily_session_id', dailySession.id);

  // Dia útil anterior (para contexto)
  let prev = subDays(parseISO(date), 1);
  while (isWeekend(prev)) prev = subDays(prev, 1);
  const prevDate = format(prev, 'yyyy-MM-dd');

  return (
    <div className="min-h-screen">
      <TopBar userName={dailySession.orchestrator_name || 'Orquestrador'} role="orchestrator" color="#f59e0b" />
      <DailyPresentation
        date={date}
        previousDate={prevDate}
        dailySession={dailySession}
        initialTasks={tasks || []}
        members={members || []}
        clients={clients || []}
        initialJustifications={justifications || []}
        viewMode={sp.view === 'summary' ? 'summary' : 'live'}
      />
    </div>
  );
}
