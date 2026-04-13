export type UserRole = 'member' | 'orchestrator';

export interface User {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  color: string;
  is_active: boolean;
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
  type: 'regular' | 'event';
  status: 'active' | 'paused' | 'ended';
  demand_level: 'low' | 'medium' | 'high' | null;
  deadline: string | null;
  notes: string | null;
  created_at: string;
}

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'not_done' | 'carryover';
export type TaskArea = 'social' | 'trafego' | 'criacao' | 'interno';
export type TaskType = 'recorrente' | 'pontual' | 'evento';

export interface Task {
  id: string;
  user_id: string;
  client_id: string | null;
  daily_session_id: string | null;
  description: string;
  area: TaskArea | null;
  task_type: TaskType;
  status: TaskStatus;
  task_date: string;
  origin_date: string;
  parent_task_id: string | null;
  created_at: string;
  completed_at: string | null;
  // Relations
  user?: User;
  client?: Client;
}

export type DailySessionStatus = 'pending' | 'in_progress' | 'completed';

export interface DailySession {
  id: string;
  session_date: string;
  status: DailySessionStatus;
  started_at: string | null;
  completed_at: string | null;
  orchestrator_name: string | null;
  notes: string | null;
  created_at: string;
}

export interface CarryoverJustification {
  id: string;
  task_id: string;
  daily_session_id: string;
  justification: string;
  orchestrator_name: string;
  created_at: string;
}

export interface WeeklyReview {
  id: string;
  week_start: string;
  week_end: string;
  status: 'pending' | 'in_progress' | 'completed';
  metrics: WeeklyMetrics | null;
  notes: string | null;
  action_items: string | null;
  orchestrator_name: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface WeeklyMetrics {
  total_tasks: number;
  completed_tasks: number;
  not_done_tasks: number;
  carryover_events: number;
  completion_rate: number;
  per_user: Record<string, {
    user_id: string;
    full_name: string;
    total: number;
    done: number;
    not_done: number;
    carryover: number;
    completion_rate: number;
  }>;
  per_client: Record<string, {
    client_id: string;
    name: string;
    total: number;
    done: number;
    carryover: number;
  }>;
  top_carryover_tasks: Array<{
    task_id: string;
    description: string;
    user_name: string;
    client_name: string | null;
    carryover_count: number;
    justifications: string[];
  }>;
  daily_breakdown: Array<{
    date: string;
    total: number;
    done: number;
    carryover: number;
  }>;
}

export interface SessionPayload {
  userId: string;
  username: string;
  fullName: string;
  role: UserRole;
}
