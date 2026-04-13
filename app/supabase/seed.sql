-- ============================================================================
-- BEAM360 OPERACIONAL DAILYS — SEED DATA
-- ============================================================================
-- Execute após schema.sql
-- Senhas padrão (TROQUE DEPOIS NO PRIMEIRO LOGIN):
--   orquestrador / orquestrador2026
--   guilherme    / guilherme2026
--   barbara      / barbara2026
--   marco        / marco2026
--   samuel       / samuel2026
-- ============================================================================

-- Usuários
INSERT INTO users (username, password_hash, full_name, role, color) VALUES
  ('orquestrador', '$2b$10$ynFXCSV8OYY.qfg/2OeMteRnh0jqw.3w1sKZsrykHhHMNI9MOmfmm', 'Orquestrador', 'orchestrator', '#f59e0b'),
  ('guilherme', '$2b$10$xnUtYUPGUg8QSdLIJD.yh.ycyto36uFboBVJQHZFOv83rVP5ibSCq', 'Guilherme', 'member', '#3b82f6'),
  ('barbara', '$2b$10$1/sLRiT8Fgkfos.L5gomoOB3OZ1ysTVzdEjfUBYH/WPc0V2pjKHmS', 'Bárbara', 'member', '#ec4899'),
  ('marco', '$2b$10$ubfGCnZi9MONfUsceeGGWuT2FslmvRAYvtbBWpMmZ08wqFhCypcQy', 'Marco', 'member', '#10b981'),
  ('samuel', '$2b$10$BM/l/SzarSDmcjHg/PqCQutopw9liwig7z7SzmXF6oQRd2mlOelZO', 'Samuel', 'member', '#8b5cf6');

-- Clientes (21 regulares + 2 eventos)
INSERT INTO clients (name, type, status, demand_level, notes) VALUES
  ('Átomo Pay', 'regular', 'active', NULL, NULL),
  ('Beam360', 'regular', 'active', 'high', 'Empresa interna'),
  ('Canaã Dental Day Clinic', 'regular', 'active', NULL, NULL),
  ('Connect Store', 'regular', 'active', NULL, NULL),
  ('Corporação Contábil', 'regular', 'active', NULL, NULL),
  ('Dancar Centro Automotivo', 'regular', 'active', NULL, NULL),
  ('Dr. Homaile', 'regular', 'active', NULL, NULL),
  ('Dra. Juliana Sardinha', 'regular', 'active', NULL, NULL),
  ('Engenheiro Carlos', 'regular', 'active', NULL, NULL),
  ('Euro Mundi', 'regular', 'active', NULL, NULL),
  ('Freitas & Homaile', 'regular', 'active', NULL, NULL),
  ('Goulart Veículos', 'regular', 'active', NULL, NULL),
  ('Grupo Real', 'regular', 'active', NULL, NULL),
  ('Império', 'regular', 'active', NULL, NULL),
  ('IUPIX', 'regular', 'active', NULL, NULL),
  ('Jumpfy', 'regular', 'active', NULL, NULL),
  ('Paradise', 'regular', 'active', NULL, NULL),
  ('Pixzin BaaS', 'regular', 'active', NULL, NULL),
  ('Shark Bot', 'regular', 'active', NULL, NULL),
  ('Sinibaldi Veículos', 'regular', 'active', NULL, NULL),
  ('Total Truck', 'regular', 'active', NULL, NULL);

INSERT INTO clients (name, type, status, deadline, notes) VALUES
  ('Afiliados Brasil 2026', 'event', 'active', '2026-12-31', 'Prazo definido — 2026'),
  ('Medical Prosperity 2026', 'event', 'active', '2026-12-31', 'Prazo definido — 2026');
