-- ============================================================================
-- BEAM360 OPERACIONAL DAILYS — SCHEMA
-- ============================================================================
-- Execute este script no SQL Editor do Supabase após criar o projeto.
-- Ordem de execução: schema.sql → seed.sql
-- ============================================================================

-- Limpa tudo (cuidado em produção!)
DROP TABLE IF EXISTS weekly_reviews CASCADE;
DROP TABLE IF EXISTS carryover_justifications CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS daily_sessions CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================================================
-- USERS — Membros + Orquestrador (auth custom, sem email)
-- ============================================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('member', 'orchestrator')),
  color TEXT DEFAULT '#6366f1',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);

-- ============================================================================
-- CLIENTS — Base de clientes + eventos
-- ============================================================================
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('regular', 'event')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
  demand_level TEXT CHECK (demand_level IN ('low', 'medium', 'high')),
  deadline DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_type ON clients(type);

-- ============================================================================
-- DAILY_SESSIONS — Cada daily realizada
-- ============================================================================
CREATE TABLE daily_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_date DATE UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  orchestrator_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_daily_sessions_date ON daily_sessions(session_date);
CREATE INDEX idx_daily_sessions_status ON daily_sessions(status);

-- ============================================================================
-- TASKS — Demandas individuais
-- ============================================================================
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  daily_session_id UUID REFERENCES daily_sessions(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  area TEXT CHECK (area IN ('social', 'trafego', 'criacao', 'interno')),
  task_type TEXT DEFAULT 'pontual' CHECK (task_type IN ('recorrente', 'pontual', 'evento')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done', 'not_done', 'carryover')),
  task_date DATE NOT NULL,
  origin_date DATE NOT NULL,
  parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_client_id ON tasks(client_id);
CREATE INDEX idx_tasks_task_date ON tasks(task_date);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_daily_session_id ON tasks(daily_session_id);

-- ============================================================================
-- CARRYOVER_JUSTIFICATIONS — Justificativas (nova a cada dia que vira carryover)
-- ============================================================================
CREATE TABLE carryover_justifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  daily_session_id UUID NOT NULL REFERENCES daily_sessions(id) ON DELETE CASCADE,
  justification TEXT NOT NULL,
  orchestrator_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_carryover_task_id ON carryover_justifications(task_id);
CREATE INDEX idx_carryover_daily_id ON carryover_justifications(daily_session_id);

-- ============================================================================
-- WEEKLY_REVIEWS — Compilação semanal
-- ============================================================================
CREATE TABLE weekly_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  metrics JSONB,
  notes TEXT,
  action_items TEXT,
  orchestrator_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(week_start)
);

CREATE INDEX idx_weekly_week_start ON weekly_reviews(week_start);

-- ============================================================================
-- FUNCTIONS — Helpers de negócio
-- ============================================================================

-- Função: verifica se uma data é dia útil (segunda a sexta)
CREATE OR REPLACE FUNCTION is_weekday(d DATE) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXTRACT(DOW FROM d) BETWEEN 1 AND 5;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função: valida que daily só pode ser em dia útil
CREATE OR REPLACE FUNCTION validate_daily_weekday() RETURNS TRIGGER AS $$
BEGIN
  IF NOT is_weekday(NEW.session_date) THEN
    RAISE EXCEPTION 'Dailys só podem ser criadas em dias úteis (segunda a sexta)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_daily_weekday
  BEFORE INSERT OR UPDATE ON daily_sessions
  FOR EACH ROW EXECUTE FUNCTION validate_daily_weekday();
