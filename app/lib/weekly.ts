import { supabaseAdmin } from './supabase';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/** Normaliza qualquer data ISO para a segunda-feira da semana (ISO, weekStartsOn=1). */
export function toWeekStart(iso: string): string {
  const d = parseISO(iso);
  const mon = startOfWeek(d, { weekStartsOn: 1 });
  return format(mon, 'yyyy-MM-dd');
}

export function weekDates(weekStart: string): string[] {
  const start = parseISO(weekStart);
  return [0, 1, 2, 3, 4].map((i) => format(addDays(start, i), 'yyyy-MM-dd'));
}

// —— Tipos ————————————————————————————————————————————

export type WeeklyDayStatus =
  | 'completed'
  | 'in_progress'
  | 'pending'
  | 'not_held';

export interface WeeklyDay {
  date: string;
  weekday: string; // "Segunda" etc
  status: WeeklyDayStatus;
  orchestrator: string | null;
  totalTasks: number;
  done: number;
  notDone: number;
  carryover: number;
  rate: number; // 0–100
}

export interface WeeklyMemberBreakdown {
  userId: string;
  fullName: string;
  color: string;
  total: number;
  done: number;
  notDone: number;
  carryover: number;
  completionRate: number;
}

export interface WeeklyClientBreakdown {
  clientId: string | null;
  name: string;
  total: number;
  done: number;
  notDone: number;
  carryover: number;
}

export interface WeeklyAreaBreakdown {
  area: 'social' | 'trafego' | 'criacao' | 'interno' | 'sem_area';
  total: number;
  done: number;
  notDone: number;
  carryover: number;
}

export interface ChronicCarryover {
  rootId: string;
  description: string;
  userName: string;
  userColor: string;
  clientName: string | null;
  daysDragged: number;
  originDate: string;
  draggingFromBefore: boolean;
  justifications: Array<{
    date: string;
    text: string;
    orchestratorName: string;
  }>;
  finalStatus: 'done' | 'not_done' | 'carryover';
}

export interface CompiledWeekly {
  weekStart: string;
  weekEnd: string;
  days: WeeklyDay[];
  summary: {
    totalDailys: number;
    completedDailys: number;
    notHeldDailys: number;
    totalTaskEvents: number;
    done: number;
    notDone: number;
    carryover: number;
    completionRate: number;
  };
  perMember: WeeklyMemberBreakdown[];
  perClient: WeeklyClientBreakdown[];
  perArea: WeeklyAreaBreakdown[];
  chronicCarryovers: ChronicCarryover[];
  review: {
    id: string | null;
    status: 'pending' | 'in_progress' | 'completed';
    notes: string | null;
    actionItems: string | null;
    orchestratorName: string | null;
    completedAt: string | null;
  };
}

// —— Compilação ———————————————————————————————————————

interface TaskRow {
  id: string;
  user_id: string;
  client_id: string | null;
  daily_session_id: string | null;
  description: string;
  area: 'social' | 'trafego' | 'criacao' | 'interno' | null;
  status: 'pending' | 'in_progress' | 'done' | 'not_done' | 'carryover';
  task_date: string;
  origin_date: string;
  parent_task_id: string | null;
  user: { id: string; full_name: string; color: string } | null;
  client: { id: string; name: string } | null;
}

function rootOf(task: Pick<TaskRow, 'id' | 'parent_task_id'>): string {
  return task.parent_task_id || task.id;
}

export async function compileWeekly(weekStart: string): Promise<CompiledWeekly> {
  const dates = weekDates(weekStart);
  const weekEnd = dates[4];

  const [sessionsRes, tasksRes, reviewRes, membersRes] = await Promise.all([
    supabaseAdmin
      .from('daily_sessions')
      .select('*')
      .gte('session_date', weekStart)
      .lte('session_date', weekEnd),
    supabaseAdmin
      .from('tasks')
      .select(
        '*, user:users(id, full_name, color), client:clients(id, name)'
      )
      .gte('task_date', weekStart)
      .lte('task_date', weekEnd),
    supabaseAdmin
      .from('weekly_reviews')
      .select('*')
      .eq('week_start', weekStart)
      .maybeSingle(),
    supabaseAdmin
      .from('users')
      .select('id, full_name, color')
      .eq('role', 'member')
      .eq('is_active', true),
  ]);

  const sessions = sessionsRes.data || [];
  const tasks = (tasksRes.data || []) as TaskRow[];
  const review = reviewRes.data;
  const members = membersRes.data || [];

  const sessionByDate = new Map<string, (typeof sessions)[number]>();
  sessions.forEach((s) => sessionByDate.set(s.session_date, s));

  // —— Days ——
  const days: WeeklyDay[] = dates.map((date) => {
    const session = sessionByDate.get(date) || null;
    const dayTasks = tasks.filter((t) => t.task_date === date);

    let status: WeeklyDayStatus = 'not_held';
    if (session) {
      if (session.status === 'completed') status = 'completed';
      else if (session.status === 'in_progress') status = 'in_progress';
      else status = 'pending';
    }

    const done = dayTasks.filter((t) => t.status === 'done').length;
    const notDone = dayTasks.filter((t) => t.status === 'not_done').length;
    const carryover = dayTasks.filter((t) => t.status === 'carryover').length;
    const total = dayTasks.length;
    const rate = total > 0 ? Math.round((done / total) * 100) : 0;

    return {
      date,
      weekday: format(parseISO(date), 'EEEE', { locale: ptBR }),
      status,
      orchestrator: session?.orchestrator_name || null,
      totalTasks: total,
      done,
      notDone,
      carryover,
      rate,
    };
  });

  // —— Summary ——
  const totalTaskEvents = tasks.length;
  const done = tasks.filter((t) => t.status === 'done').length;
  const notDone = tasks.filter((t) => t.status === 'not_done').length;
  const carryover = tasks.filter((t) => t.status === 'carryover').length;
  const decided = done + notDone;
  const completionRate = decided > 0 ? Math.round((done / decided) * 100) : 0;

  // —— Per member ——
  const memberMap = new Map<string, WeeklyMemberBreakdown>();
  members.forEach((m) => {
    memberMap.set(m.id, {
      userId: m.id,
      fullName: m.full_name,
      color: m.color,
      total: 0,
      done: 0,
      notDone: 0,
      carryover: 0,
      completionRate: 0,
    });
  });
  tasks.forEach((t) => {
    const key = t.user_id;
    const entry =
      memberMap.get(key) ||
      ({
        userId: key,
        fullName: t.user?.full_name || 'Desconhecido',
        color: t.user?.color || '#64748b',
        total: 0,
        done: 0,
        notDone: 0,
        carryover: 0,
        completionRate: 0,
      } as WeeklyMemberBreakdown);
    entry.total += 1;
    if (t.status === 'done') entry.done += 1;
    else if (t.status === 'not_done') entry.notDone += 1;
    else if (t.status === 'carryover') entry.carryover += 1;
    memberMap.set(key, entry);
  });
  memberMap.forEach((m) => {
    const dec = m.done + m.notDone;
    m.completionRate = dec > 0 ? Math.round((m.done / dec) * 100) : 0;
  });
  const perMember = Array.from(memberMap.values()).sort(
    (a, b) => b.total - a.total
  );

  // —— Per client ——
  const clientMap = new Map<string, WeeklyClientBreakdown>();
  tasks.forEach((t) => {
    const key = t.client_id || '__none__';
    const entry =
      clientMap.get(key) ||
      ({
        clientId: t.client_id,
        name: t.client?.name || 'Sem cliente',
        total: 0,
        done: 0,
        notDone: 0,
        carryover: 0,
      } as WeeklyClientBreakdown);
    entry.total += 1;
    if (t.status === 'done') entry.done += 1;
    else if (t.status === 'not_done') entry.notDone += 1;
    else if (t.status === 'carryover') entry.carryover += 1;
    clientMap.set(key, entry);
  });
  const perClient = Array.from(clientMap.values()).sort(
    (a, b) => b.total - a.total
  );

  // —— Per area ——
  const areaMap = new Map<WeeklyAreaBreakdown['area'], WeeklyAreaBreakdown>();
  tasks.forEach((t) => {
    const key = (t.area || 'sem_area') as WeeklyAreaBreakdown['area'];
    const entry =
      areaMap.get(key) ||
      ({ area: key, total: 0, done: 0, notDone: 0, carryover: 0 } as WeeklyAreaBreakdown);
    entry.total += 1;
    if (t.status === 'done') entry.done += 1;
    else if (t.status === 'not_done') entry.notDone += 1;
    else if (t.status === 'carryover') entry.carryover += 1;
    areaMap.set(key, entry);
  });
  const perArea = Array.from(areaMap.values()).sort((a, b) => b.total - a.total);

  // —— Chronic carryovers (agrupados por raiz) ——
  const rootMap = new Map<
    string,
    {
      rows: TaskRow[];
      originDate: string;
    }
  >();
  tasks.forEach((t) => {
    const root = rootOf(t);
    const entry = rootMap.get(root) || { rows: [], originDate: t.origin_date };
    entry.rows.push(t);
    if (t.origin_date < entry.originDate) entry.originDate = t.origin_date;
    rootMap.set(root, entry);
  });

  // Só consideramos crônicos: rows com status 'carryover' ou 'not_done' em 2+ datas
  const candidateRoots: Array<{
    root: string;
    rows: TaskRow[];
    originDate: string;
    distinctDays: Set<string>;
  }> = [];
  rootMap.forEach((entry, root) => {
    const dragRows = entry.rows.filter(
      (r) => r.status === 'carryover' || r.status === 'not_done'
    );
    const distinctDays = new Set(dragRows.map((r) => r.task_date));
    if (distinctDays.size >= 1) {
      candidateRoots.push({
        root,
        rows: entry.rows,
        originDate: entry.originDate,
        distinctDays,
      });
    }
  });

  // Busca justificativas
  const sessionIdByDate = new Map<string, string>();
  sessions.forEach((s) => sessionIdByDate.set(s.session_date, s.id));
  const candidateTaskIds = candidateRoots.flatMap((c) => c.rows.map((r) => r.id));

  let justifications: Array<{
    task_id: string;
    daily_session_id: string;
    justification: string;
    orchestrator_name: string;
  }> = [];
  if (candidateTaskIds.length > 0) {
    const { data: justsData } = await supabaseAdmin
      .from('carryover_justifications')
      .select('task_id, daily_session_id, justification, orchestrator_name')
      .in('task_id', candidateTaskIds);
    justifications = justsData || [];
  }
  const justByTaskId = new Map<string, (typeof justifications)[number]>();
  justifications.forEach((j) => justByTaskId.set(j.task_id, j));

  const dateBySessionId = new Map<string, string>();
  sessions.forEach((s) => dateBySessionId.set(s.id, s.session_date));

  const chronicCarryovers: ChronicCarryover[] = candidateRoots
    .map((c) => {
      // Usa a row mais recente do período como "representante" (tem metadados atualizados)
      const sortedRows = [...c.rows].sort((a, b) =>
        a.task_date.localeCompare(b.task_date)
      );
      const last = sortedRows[sortedRows.length - 1];

      // Final status: o status mais "final" dentro da semana
      let finalStatus: 'done' | 'not_done' | 'carryover' = 'carryover';
      if (sortedRows.some((r) => r.status === 'done')) finalStatus = 'done';
      else if (last.status === 'not_done') finalStatus = 'not_done';
      else if (last.status === 'carryover') finalStatus = 'carryover';
      else finalStatus = 'not_done';

      const justs = sortedRows
        .map((r) => {
          const j = justByTaskId.get(r.id);
          if (!j) return null;
          return {
            date: r.task_date,
            text: j.justification,
            orchestratorName: j.orchestrator_name,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      return {
        rootId: c.root,
        description: last.description,
        userName: last.user?.full_name || 'Desconhecido',
        userColor: last.user?.color || '#64748b',
        clientName: last.client?.name || null,
        daysDragged: c.distinctDays.size,
        originDate: c.originDate,
        draggingFromBefore: c.originDate < weekStart,
        justifications: justs,
        finalStatus,
      };
    })
    // Mostra só tarefas que efetivamente arrastaram (2+ dias OU vêm de antes da semana)
    .filter((c) => c.daysDragged >= 2 || c.draggingFromBefore)
    .sort((a, b) => {
      if (b.daysDragged !== a.daysDragged) return b.daysDragged - a.daysDragged;
      return a.originDate.localeCompare(b.originDate);
    });

  // —— Summary final ——
  const completedDailys = days.filter((d) => d.status === 'completed').length;
  const notHeldDailys = days.filter((d) => d.status === 'not_held').length;

  return {
    weekStart,
    weekEnd,
    days,
    summary: {
      totalDailys: 5,
      completedDailys,
      notHeldDailys,
      totalTaskEvents,
      done,
      notDone,
      carryover,
      completionRate,
    },
    perMember,
    perClient,
    perArea,
    chronicCarryovers,
    review: {
      id: review?.id || null,
      status: review?.status || 'pending',
      notes: review?.notes || null,
      actionItems: review?.action_items || null,
      orchestratorName: review?.orchestrator_name || null,
      completedAt: review?.completed_at || null,
    },
  };
}

/** Lista as semanas que tiveram alguma atividade (daily ou review) — para o index. */
export async function listRecentWeeks(limit = 12): Promise<
  Array<{
    weekStart: string;
    weekEnd: string;
    completedDailys: number;
    reviewStatus: 'pending' | 'in_progress' | 'completed';
  }>
> {
  const [sessionsRes, reviewsRes] = await Promise.all([
    supabaseAdmin
      .from('daily_sessions')
      .select('session_date, status')
      .order('session_date', { ascending: false }),
    supabaseAdmin
      .from('weekly_reviews')
      .select('week_start, week_end, status')
      .order('week_start', { ascending: false }),
  ]);

  const sessions = sessionsRes.data || [];
  const reviews = reviewsRes.data || [];

  // Agrupa por weekStart
  const weekMap = new Map<
    string,
    { weekEnd: string; completedDailys: number; reviewStatus: 'pending' | 'in_progress' | 'completed' }
  >();

  sessions.forEach((s) => {
    const ws = toWeekStart(s.session_date);
    const existing = weekMap.get(ws) || {
      weekEnd: format(addDays(parseISO(ws), 4), 'yyyy-MM-dd'),
      completedDailys: 0,
      reviewStatus: 'pending' as const,
    };
    if (s.status === 'completed') existing.completedDailys += 1;
    weekMap.set(ws, existing);
  });

  reviews.forEach((r) => {
    const existing = weekMap.get(r.week_start) || {
      weekEnd: r.week_end,
      completedDailys: 0,
      reviewStatus: 'pending' as const,
    };
    existing.reviewStatus = r.status;
    weekMap.set(r.week_start, existing);
  });

  return Array.from(weekMap.entries())
    .map(([weekStart, v]) => ({ weekStart, ...v }))
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
    .slice(0, limit);
}
