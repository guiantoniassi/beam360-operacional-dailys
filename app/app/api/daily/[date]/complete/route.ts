import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { format, addDays, parseISO, isWeekend } from 'date-fns';

// POST /api/daily/[date]/complete — finaliza a daily
// Regras:
// 1. Todos os carryovers do dia anterior precisam ter justificativa
// 2. Tasks pending/in_progress de hoje que não foram marcadas como done viram not_done
// 3. Tasks not_done viram carryover para o próximo dia útil (duplicadas)
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'orchestrator') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { date } = await params;

  // Buscar daily
  const { data: dailySession } = await supabaseAdmin
    .from('daily_sessions')
    .select('*')
    .eq('session_date', date)
    .single();

  if (!dailySession) return NextResponse.json({ error: 'Daily não encontrada' }, { status: 404 });
  if (dailySession.status === 'completed')
    return NextResponse.json({ error: 'Daily já está concluída' }, { status: 400 });

  // Verificar carryovers: todos precisam de justificativa
  const { data: tasksToday } = await supabaseAdmin
    .from('tasks')
    .select('id, status, parent_task_id')
    .eq('task_date', date)
    .eq('status', 'carryover');

  const carryoverIds = (tasksToday || []).map((t) => t.id);

  if (carryoverIds.length > 0) {
    const { data: justifications } = await supabaseAdmin
      .from('carryover_justifications')
      .select('task_id')
      .eq('daily_session_id', dailySession.id)
      .in('task_id', carryoverIds);

    const justifiedIds = new Set((justifications || []).map((j) => j.task_id));
    const missing = carryoverIds.filter((id) => !justifiedIds.has(id));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `${missing.length} carryover(s) ainda sem justificativa`, missing },
        { status: 400 }
      );
    }
  }

  // Passo 1: atualizar daily_session
  await supabaseAdmin
    .from('daily_sessions')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', dailySession.id);

  // Passo 2: associar todas as tarefas do dia à daily session
  await supabaseAdmin
    .from('tasks')
    .update({ daily_session_id: dailySession.id })
    .eq('task_date', date)
    .is('daily_session_id', null);

  // Passo 3: calcular próximo dia útil
  let next = addDays(parseISO(date), 1);
  while (isWeekend(next)) next = addDays(next, 1);
  const nextDate = format(next, 'yyyy-MM-dd');

  // Passo 4: identificar tarefas não concluídas de hoje (incluindo carryovers não feitos)
  const { data: incompleteTasks } = await supabaseAdmin
    .from('tasks')
    .select('*')
    .eq('task_date', date)
    .in('status', ['pending', 'in_progress', 'not_done', 'carryover']);

  if (incompleteTasks && incompleteTasks.length > 0) {
    // Marcar como not_done
    await supabaseAdmin
      .from('tasks')
      .update({ status: 'not_done' })
      .eq('task_date', date)
      .in('status', ['pending', 'in_progress']);

    // Criar duplicatas com status carryover para o próximo dia útil
    const carryoverRows = incompleteTasks.map((t) => ({
      user_id: t.user_id,
      client_id: t.client_id,
      description: t.description,
      area: t.area,
      task_type: t.task_type,
      status: 'carryover',
      task_date: nextDate,
      origin_date: t.origin_date,
      parent_task_id: t.parent_task_id || t.id,
    }));

    if (carryoverRows.length > 0) {
      await supabaseAdmin.from('tasks').insert(carryoverRows);
    }
  }

  return NextResponse.json({ ok: true, nextDate });
}
