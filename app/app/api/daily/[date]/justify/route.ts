import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// POST /api/daily/[date]/justify — adiciona/atualiza justificativa de carryover
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'orchestrator') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { date } = await params;
  const body = await req.json();
  const { task_id, justification } = body;

  if (!task_id || !justification?.trim()) {
    return NextResponse.json({ error: 'task_id e justification obrigatórios' }, { status: 400 });
  }

  const { data: dailySession } = await supabaseAdmin
    .from('daily_sessions')
    .select('*')
    .eq('session_date', date)
    .single();

  if (!dailySession || dailySession.status !== 'in_progress') {
    return NextResponse.json({ error: 'Daily não está em andamento' }, { status: 400 });
  }

  // Verifica se já existe justificativa para essa task nessa daily (upsert)
  const { data: existing } = await supabaseAdmin
    .from('carryover_justifications')
    .select('id')
    .eq('task_id', task_id)
    .eq('daily_session_id', dailySession.id)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from('carryover_justifications')
      .update({ justification: justification.trim(), orchestrator_name: dailySession.orchestrator_name })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ justification: data });
  }

  const { data, error } = await supabaseAdmin
    .from('carryover_justifications')
    .insert({
      task_id,
      daily_session_id: dailySession.id,
      justification: justification.trim(),
      orchestrator_name: dailySession.orchestrator_name,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ justification: data });
}
