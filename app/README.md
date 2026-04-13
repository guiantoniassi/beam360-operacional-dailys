# Beam360 — Operacional Dailys

Sistema interno da Beam360 para orquestrar dailys operacionais, rastrear carryovers e compilar weeklies.

- **Stack**: Next.js 16 · React 19 · TypeScript · Tailwind v4 · Supabase (Postgres) · auth custom (JWT + bcrypt)
- **Funcionalidades principais**:
  - Auth por username/senha (sem email), separado entre orquestrador e membros
  - Interface individual de tarefas (membros só veem as suas)
  - Modo apresentação da daily com navegação em 3 passos (carryovers → time → finalizar)
  - Lógica estrita de carryover: cada dia não concluído exige nova justificativa
  - Weekly review com métricas automáticas + anotações do orquestrador
  - Dailys só rodam em dias úteis (trigger no banco)

## 1. Setup do Supabase

1. Crie um projeto novo em [supabase.com](https://supabase.com).
2. No painel, vá em **SQL Editor**.
3. Rode o arquivo `supabase/schema.sql` (cria tabelas, índices e triggers).
4. Rode o arquivo `supabase/seed.sql` (insere usuários e clientes).
5. Em **Project Settings → API**, anote:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` (secret) → `SUPABASE_SERVICE_ROLE_KEY`

### Credenciais iniciais (seed)

| username       | senha              | role         |
| -------------- | ------------------ | ------------ |
| `orquestrador` | `orquestrador2026` | orchestrator |
| `guilherme`    | `guilherme2026`    | member       |
| `barbara`      | `barbara2026`      | member       |
| `marco`        | `marco2026`        | member       |
| `samuel`       | `samuel2026`       | member       |

> Troque as senhas depois do primeiro login (atualize o `password_hash` na tabela `users` com um bcrypt novo).

## 2. Variáveis de ambiente

Copie `.env.example` para `.env.local`:

```bash
cp .env.example .env.local
```

Preencha:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
JWT_SECRET=uma-string-aleatoria-de-pelo-menos-32-chars
```

Gere um `JWT_SECRET` forte:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

## 3. Desenvolvimento local

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). Você será redirecionado para `/login`.

## 4. Deploy na Vercel

1. Suba o repositório para GitHub.
2. Em [vercel.com/new](https://vercel.com/new) importe o projeto.
3. Em **Environment Variables**, cadastre as 4 vars acima.
4. Deploy.

A cada push na branch principal, a Vercel rebuild automaticamente.

## 5. Estrutura do código

```
app/
├── api/
│   ├── auth/              # login, logout
│   ├── tasks/             # CRUD de tarefas
│   ├── daily/             # gestão da daily (start, justify, complete)
│   └── weekly/            # compilação + finalização da weekly
├── login/                 # página de login
├── tasks/                 # interface do membro
└── orchestrate/           # interface do orquestrador
    ├── (dashboard)        # calendário seg-sex
    ├── daily/[date]/      # modo apresentação da daily
    └── weekly/            # lista + apresentação da weekly
lib/
├── auth.ts                # JWT + bcrypt (custom auth sem email)
├── supabase.ts            # clientes (anon + service role)
├── dates.ts               # helpers de data com ptBR
├── types.ts               # tipos compartilhados
└── weekly.ts              # compilação das métricas semanais
supabase/
├── schema.sql             # schema completo (rodar 1x)
└── seed.sql               # usuários e clientes iniciais
```

## 6. Regras de negócio

- Dailys só podem ser criadas em dias úteis (validado por trigger e rota).
- Tarefas de membros são bloqueadas quando a daily está `in_progress`.
- Não é possível finalizar a daily sem justificar **todos** os carryovers do dia.
- Ao finalizar uma daily, tarefas não concluídas são duplicadas como `carryover` para o próximo dia útil, mantendo a linhagem via `parent_task_id`.
- Weekly pode ser compilada parcialmente — dailys não realizadas aparecem como "Não realizada".
- Crônicos: tarefas que arrastaram por 2+ dias na semana ou que vêm de antes dela aparecem na aba "Crônicos" para análise de gargalo.

## 7. Próximos passos (fora do MVP)

- `/orchestrate/clients` — gestão de clientes (adicionar, pausar, deadline)
- `/tasks/history` — histórico pessoal do membro
- Notificações quando orquestrador inicia daily
- Exportar weekly para PDF
