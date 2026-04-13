import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { compileWeekly, toWeekStart } from '@/lib/weekly';

// POST /api/weekly/[weekStart]/complete — finaliza a weekly e persiste métricas no JSONB
export async function POST(
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

  const body = await req.json().catch(() => ({}));
  const { notes, action_items, orchestrator_name } = body;

  const compiled = await compileWeekly(normalized);

  // Persiste snapshot das métricas em metrics (JSONB)
  const start = new Date(normalized + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 4);
  const weekEnd = end.toISOString().split('T')[0];

  const { data: existing } = await supabaseAdmin
    .from('weekly_reviews')
    .select('*')
    .eq('week_start', normalized)
    .maybeSingle();

  const payload = {
    week_start: normalized,
    week_end: weekEnd,
    status: 'completed' as const,
    metrics: compiled as unknown as Record<string, unknown>,
    notes: notes ?? existing?.notes ?? null,
    action_items: action_items ?? existing?.action_items ?? null,
    orchestrator_name: orchestrator_name ?? existing?.orchestrator_name ?? null,
    completed_at: new Date().toISOString(),
  };

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from('weekly_reviews')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ review: data });
  }

  const { data, error } = await supabaseAdmin
    .from('weekly_reviews')
    .insert(payload)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ review: data });
}
