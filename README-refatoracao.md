# Refactor v2 — Ficha individual do Lead

Esta versão mantém a estrutura separada em:

- `index.html`
- `css/styles.css`
- `js/app.js`

## O que foi adicionado

- Nova tela interna: `panel-lead`
- Função `openLeadDetail(id, source, day)`
- Ficha visual do lead com:
  - dados da empresa
  - canais de contato
  - pipeline visual
  - histórico inicial
  - área futura de notas
- Botão `Ficha` na lista de Leads Ativos da tela Início

## O que NÃO foi alterado

- Importação
- Validação
- Atribuição
- Fila WhatsApp
- Instagram
- Redirecionamentos
- localStorage / IndexedDB
- Banco Supabase

Esta versão ainda não salva notas nem altera o modelo de dados. Ela cria apenas a primeira camada visual para centralizar o lead.
