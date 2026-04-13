import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { todayISO } from '@/lib/dates';
import TopBar from '@/components/TopBar';
import TasksClient from './TasksClient';

export default async function TasksPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role === 'orchestrator') redirect('/orchestrate');

  const today = todayISO();

  const [userRes, tasksRes, clientsRes, dailyRes, membersRes] = await Promise.all([
    supabaseAdmin.from('users').select('id, full_name, color').eq('id', session.userId).single(),
    supabaseAdmin
      .from('tasks')
      .select('*, client:clients(id, name), user:users(id, full_name)')
      .eq('user_id', session.userId)
      .eq('task_date', today)
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('clients')
      .select('*')
      .eq('status', 'active')
      .order('name', { ascending: true }),
    supabaseAdmin.from('daily_sessions').select('*').eq('session_date', today).maybeSingle(),
    supabaseAdmin
      .from('users')
      .select('id, full_name')
      .eq('role', 'member')
      .eq('is_active', true)
      .order('full_name'),
  ]);

  return (
    <div className="min-h-screen">
      <TopBar userName={session.fullName} role="member" color={userRes.data?.color} />
      <TasksClient
        initialTasks={tasksRes.data || []}
        clients={clientsRes.data || []}
        today={today}
        dailySession={dailyRes.data}
        currentUserId={session.userId}
        role={session.role}
        members={membersRes.data || []}
      />
    </div>
  );
}
