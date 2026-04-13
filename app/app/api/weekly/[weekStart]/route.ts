import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { compileWeekly, toWeekStart } from '@/lib/weekly';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/weekly/[weekStart] — compila métricas ao vivo
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ weekStart: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'orchestrator') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { weekStart } = await params;
  const normalized = toWeekStart(weekStart);

  const compiled = await compileWeekly(normalized);
  return NextResponse.json({ weekly: compiled });
}

// PATCH /api/weekly/[weekStart] — salva rascunho de notes/action_items sem finalizar
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ weekStart: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'orchestrator') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { weekStart } = await params;
  const normalized = toWeekStart(weekStart);
  const body = await req.json();
  const { notes, action_items, orchestrator_name } = body;

  // Calcula week_end
  const start = new Date(normalized + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 4);
  const weekEnd = end.toISOString().split('T')[0];

  const { data: existing } = await supabaseAdmin
    .from('weekly_reviews')
    .select('*')
    .eq('week_start', normalized)
    .maybeSingle();

  if (existing && existing.status === 'completed') {
    return NextResponse.json(
      { error: 'Weekly já finalizada, não pode ser alterada.' },
      { status: 400 }
    );
  }

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from('weekly_reviews')
      .update({
        status: 'in_progress',
        notes: notes ?? existing.notes,
        action_items: action_items ?? existing.action_items,
        orchestrator_name: orchestrator_name ?? existing.orchestrator_name,
      })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ review: data });
  }

  const { data, error } = await supabaseAdmin
    .from('weekly_reviews')
    .insert({
      week_start: normalized,
      week_end: weekEnd,
      status: 'in_progress',
      notes: notes || null,
      action_items: action_items || null,
      orchestrator_name: orchestrator_name || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ review: data });
}
