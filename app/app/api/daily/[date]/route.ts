import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { format, subDays, parseISO, isWeekend } from 'date-fns';

// GET /api/daily/[date] — retorna dados completos da daily
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { date } = await params;

  // Daily session
  const { data: dailySession } = await supabaseAdmin
    .from('daily_sessions')
    .select('*')
    .eq('session_date', date)
    .maybeSingle();

  // Tasks do dia (todas de todos os membros)
  const { data: tasks } = await supabaseAdmin
    .from('tasks')
    .select('*, client:clients(id, name), user:users(id, username, full_name, color)')
    .eq('task_date', date)
    .order('user_id', { ascending: true })
    .order('created_at', { ascending: true });

  // Calcular data do dia útil anterior
  let prev = subDays(parseISO(date), 1);
  while (isWeekend(prev)) prev = subDays(prev, 1);
  const prevDate = format(prev, 'yyyy-MM-dd');

  // Carryovers de ontem = tasks de ontem ainda pendentes/em progresso
  // OU carryovers já marcados hoje que vieram de ontem
  const { data: yesterdayIncomplete } = await supabaseAdmin
    .from('tasks')
    .select('*, client:clients(id, name), user:users(id, username, full_name, color)')
    .eq('task_date', prevDate)
    .in('status', ['pending', 'in_progress', 'carryover', 'not_done']);

  // Justificativas já dadas nesta daily (se em progresso)
  let justifications: Record<string, string> = {};
  if (dailySession) {
    const { data: justs } = await supabaseAdmin
      .from('carryover_justifications')
      .select('*')
      .eq('daily_session_id', dailySession.id);
    if (justs) {
      justs.forEach((j) => {
        justifications[j.task_id] = j.justification;
      });
    }
  }

  return NextResponse.json({
    session: dailySession,
    tasks: tasks || [],
    yesterday_carryovers: yesterdayIncomplete || [],
    justifications,
    previous_date: prevDate,
  });
}
