import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import TopBar from '@/components/TopBar';
import HistoryClient from './HistoryClient';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Task } from '@/lib/types';

export default async function TasksHistoryPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role === 'orchestrator') redirect('/orchestrate');

  const now = new Date();
  const start = format(startOfMonth(now), 'yyyy-MM-dd');
  const end = format(endOfMonth(now), 'yyyy-MM-dd');

  const [userRes, tasksRes] = await Promise.all([
    supabaseAdmin.from('users').select('color').eq('id', session.userId).single(),
    supabaseAdmin
      .from('tasks')
      .select('*, client:clients(id, name)')
      .eq('user_id', session.userId)
      .gte('task_date', start)
      .lte('task_date', end)
      .order('task_date', { ascending: false })
      .order('created_at', { ascending: true }),
  ]);

  return (
    <div className="min-h-screen">
      <TopBar userName={session.fullName} role="member" color={userRes.data?.color} />
      <HistoryClient
        initialTasks={(tasksRes.data as Task[]) || []}
        initialMonth={format(now, 'yyyy-MM')}
      />
    </div>
  );
}
