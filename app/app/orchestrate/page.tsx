import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import TopBar from '@/components/TopBar';
import CalendarClient from './CalendarClient';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export default async function OrchestrateHome() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'orchestrator') redirect('/tasks');

  const now = new Date();
  const month = format(now, 'yyyy-MM');
  const start = format(startOfMonth(now), 'yyyy-MM-dd');
  const end = format(endOfMonth(now), 'yyyy-MM-dd');

  const [sessionsRes, usersRes] = await Promise.all([
    supabaseAdmin
      .from('daily_sessions')
      .select('*')
      .gte('session_date', start)
      .lte('session_date', end),
    supabaseAdmin
      .from('users')
      .select('id, username, full_name, color')
      .eq('role', 'member')
      .eq('is_active', true)
      .order('full_name'),
  ]);

  return (
    <div className="min-h-screen">
      <TopBar userName="Orquestrador" role="orchestrator" color="#f59e0b" />
      <CalendarClient
        initialSessions={sessionsRes.data || []}
        members={usersRes.data || []}
        initialMonth={month}
      />
    </div>
  );
}
