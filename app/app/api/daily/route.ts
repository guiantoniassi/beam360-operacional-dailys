import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/daily?month=YYYY-MM — lista daily sessions de um mês
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');
  if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 });

  const start = `${month}-01`;
  const [year, m] = month.split('-').map(Number);
  const endDate = new Date(year, m, 0);
  const end = endDate.toISOString().split('T')[0];

  const { data, error } = await supabaseAdmin
    .from('daily_sessions')
    .select('*')
    .gte('session_date', start)
    .lte('session_date', end)
    .order('session_date', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sessions: data });
}

// POST /api/daily — cria/inicia uma daily (apenas orquestrador)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'orchestrator')
    return NextResponse.json({ error: 'Apenas orquestrador pode iniciar dailys' }, { status: 403 });

  const body = await req.json();
  const { session_date, orchestrator_name } = body;
  if (!session_date || !orchestrator_name) {
    return NextResponse.json({ error: 'session_date e orchestrator_name são obrigatórios' }, { status: 400 });
  }

  // Validar dia útil
  const [year, month, day] = session_date.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const dow = d.getDay();
  if (dow === 0 || dow === 6) {
    return NextResponse.json({ error: 'Dailys só podem ser em dias úteis (seg–sex)' }, { status: 400 });
  }

  // Verificar se já existe
  const { data: existing } = await supabaseAdmin
    .from('daily_sessions')
    .select('*')
    .eq('session_date', session_date)
    .maybeSingle();

  if (existing) {
    if (existing.status === 'completed') {
      return NextResponse.json({ error: 'Daily deste dia já foi concluída' }, { status: 400 });
    }
    // Retomar sessão existente
    const { data, error } = await supabaseAdmin
      .from('daily_sessions')
      .update({
        status: 'in_progress',
        started_at: existing.started_at || new Date().toISOString(),
        orchestrator_name,
      })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ session: data, resumed: true });
  }

  const { data, error } = await supabaseAdmin
    .from('daily_sessions')
    .insert({
      session_date,
      status: 'in_progress',
      started_at: new Date().toISOString(),
      orchestrator_name,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ session: data });
}
