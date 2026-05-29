# Refatoração v1

Esta versão apenas separa a aplicação em arquivos externos, sem mudar o fluxo da plataforma.

## Arquivos

- `index.html`: estrutura HTML principal.
- `css/styles.css`: todo o CSS que antes estava dentro da tag `<style>`.
- `js/app.js`: todo o JavaScript que antes estava no final do HTML.

## O que foi mantido

- Fluxo atual da plataforma.
- LocalStorage/IndexedDB.
- Login Supabase/Google.
- Design e layout atuais.

## Observação

Foi adicionada a função `escapeHtml()` porque ela estava sendo usada pelo bloco de autenticação e estava causando erro no navegador.
