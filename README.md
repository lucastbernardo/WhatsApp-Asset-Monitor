#  WhatsApp Asset Monitor - Meta API Integration

Este projeto é uma ferramenta de monitoramento avançado para ativos do WhatsApp Business, integrada diretamente com a **API Graph da Meta**. Desenvolvido em **Google Apps Script**, ele transforma uma planilha do Google em um painel de controle (Dashboard) para gestão de múltiplas Business Managers (BMs).

##  Objetivo
Centralizar o monitoramento de saúde, status de conexão e limites de envio (Tiers) de diversos números em um único local, eliminando a necessidade de checagem manual em múltiplos painéis da Meta.

##  Principais Funcionalidades
- **Monitoramento Multi-BM:** Suporte para monitorar diferentes BMs simultaneamente.
- **Diagnóstico Anti-Ban:** Identificação imediata de "Shadow Bans", contas restritas e chips em estado de "Flag".
- **Sistema X-9 (Histórico):** Registro automático de todas as mudanças de status para auditoria de performance da base.
- **Cálculo de Saúde da Base:** Indicadores percentuais automáticos sobre a qualidade dos ativos.
- **Otimização de Performance:** Implementação de busca com interrupção imediata (early exit) para garantir que o script não perca tempo processando logs antigos desnecessários.
- **Trava de Maturação Inteligente:** Identificação e bloqueio visual automático (fundo azul) por 24h para todo chip novo detectado pelo sistema, garantindo o tempo de carência antes do uso.

##  Tecnologias Utilizadas
- **Linguagem:** JavaScript / Google Apps Script
- **Integração:** Meta Graph API (v22.0)
- **Interface:** Google Sheets Interface

##  Estrutura do Painel
O monitoramento é dividido por colunas estratégicas:
1. **Ativo:** Número do telefone.
2. **Status:** Diagnóstico visual (🟢 Alta, 🔵 Maturando (24h), 🟡 Média, 🔴 Baixa, 🚫 Bloqueado).
3. **Messaging Tier:** Limite atual de disparos (1k, 10k, 100k ou Ilimitado).

---

##  Como Utilizar
1. Copie o código contido em `main.gs` para o seu editor de scripts do Google Sheets.
2. Configure o array `BM_CONFIG` com seus IDs e Tokens de acesso perpétuo da Meta.
3. Atribua a função `atualizarTudo` a um botão na sua planilha.
4. Clique e monitore!

---
*Este projeto foi desenvolvido para otimizar operações de marketing digital e atendimento que demandam alta escalabilidade e segurança de ativos.*
