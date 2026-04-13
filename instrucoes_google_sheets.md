# Setup do Sistema de Daily Operacional — Google Sheets

## Estrutura de Abas

Crie uma planilha no Google Sheets com **4 abas**:

---

### Aba 1: REGISTRO
**Colunas (A a I):**

| Coluna | Campo | Tipo | Opções |
|--------|-------|------|--------|
| A | Data | Data | dd/mm/aaaa |
| B | Responsável | Dropdown | Guilherme, Bárbara, Marco, Samuel |
| C | Cliente | Dropdown | (lista de clientes — ver Aba CLIENTES) |
| D | Demanda | Texto | Descrição da tarefa |
| E | Área | Dropdown | Social, Tráfego, Criação, Interno |
| F | Tipo | Dropdown | Recorrente, Pontual, Evento |
| G | Status | Dropdown | ✓ Feito, ✗ Não Feito, → Carryover, Em Andamento |
| H | Motivo (se não feito) | Texto | Preencher apenas se Status = ✗ Não Feito |
| I | Data de Origem | Data | Preenchida automaticamente (data em que a tarefa foi criada) |

**Formatação condicional sugerida (coluna G):**
- ✓ Feito → fundo verde claro
- ✗ Não Feito → fundo vermelho claro
- → Carryover → fundo amarelo
- Em Andamento → fundo azul claro

---

### Aba 2: HOJE
**Fórmula para puxar carryovers do dia anterior:**

Na célula A2, cole esta fórmula para trazer automaticamente as tarefas marcadas como "→ Carryover":
```
=FILTER(REGISTRO!A:I, REGISTRO!G:G="→ Carryover", REGISTRO!A:A=HOJE()-1)
```

Estrutura das colunas: igual ao REGISTRO.

Abaixo das linhas de carryover, adicione linhas em branco para o planejamento do dia atual.

**Ordem sugerida na tela durante a daily:**
1. Linhas de Carryover (em amarelo automático)
2. Separador visual (linha em cinza com texto "PLANEJAMENTO DO DIA")
3. Linhas novas do dia

---

### Aba 3: CLIENTES
**Colunas:**

| Coluna | Campo |
|--------|-------|
| A | Nome |
| B | Tipo (Regular / Evento) |
| C | Status (Ativo / Pausado / Encerrado) |
| D | Nível de Demanda (Alta / Média / Baixa) |
| E | Prazo (para eventos) |
| F | Observações |

**Lista de clientes (já em ordem alfabética):**
1. Átomo Pay
2. Beam360 (interno)
3. Canaã Dental Day Clinic
4. Connect Store
5. Corporação Contábil
6. Dancar Centro Automotivo
7. Dr. Homaile
8. Dra. Juliana Sardinha
9. Engenheiro Carlos
10. Euro Mundi
11. Freitas & Homaile
12. Goulart Veículos
13. Grupo Real
14. Império
15. IUPIX
16. Jumpfy
17. Paradise
18. Pixzin BaaS
19. Shark Bot
20. Sinibaldi Veículos
21. Total Truck
— Eventos —
22. Afiliados Brasil 2026
23. Medical Prosperity 2026

---

### Aba 4: DASHBOARD (opcional, fase 2)
Painel de visão geral:
- Tarefas por responsável na semana
- Clientes com mais demandas abertas
- Taxa de conclusão do dia anterior

---

## Ritual da Daily (roteiro de uso)

### Antes de entrar na daily (1 min — quem conduz)
1. Abrir a aba **HOJE**
2. Verificar se os carryovers do dia anterior carregaram corretamente
3. Checar se há alguma demanda nova urgente que entrou fora da daily

---

### Durante a daily (20–25 min, 8h)

**Bloco 1 — Retrospecto (8 min)**
Para cada pessoa, percorrer as tarefas do dia anterior:
- O que foi feito → confirmar status ✓
- O que não foi feito → registrar motivo na coluna H + marcar → Carryover se entra hoje
- Carryovers automáticos já aparecem no topo

**Bloco 2 — Demandas novas (3 min)**
Listar o que chegou após a daily de ontem (WhatsApp, e-mail, reunião) que ainda não está no registro.
Adicionar as linhas na aba HOJE.

**Bloco 3 — Planejamento do dia (10 min)**
Cada pessoa preenche ao vivo:
- Cliente | Demanda | Área | Tipo
- O status começa em branco (ou "Em Andamento")

**Bloco 4 — Flags (4 min)**
- Algum bloqueio que impede uma entrega?
- Precisa de apoio cross-área?
- Algum cliente em alerta?

---

## Regras de uso

1. **Nenhuma tarefa fica sem status ao final do dia.** Antes de sair, cada pessoa atualiza seus status.
2. **Carryover sempre tem motivo registrado.** Coluna H obrigatória quando o status for ✗ ou →.
3. **Demandas reativas entram no registro no mesmo dia que chegam**, com Tipo = "Pontual".
4. **Eventos (Afiliados Brasil, Medical Prosperity) são tratados como cliente** — com suas próprias linhas de demanda.
5. **Marco e Samuel** usam o mesmo registro quando participam — as colunas de Responsável já os incluem.
