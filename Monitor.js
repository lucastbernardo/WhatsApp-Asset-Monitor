/**
 * SISTEMA DE MONITORAMENTO DE ATIVOS WHATSAPP
 * Integração: Meta Graph API
 * Objetivo: Gestão de saúde e status de ativos em múltiplas Business Managers (BMs).
 */

// Configuração das Business Managers (Substitua pelos seus dados reais)
const BM_CONFIG = [
  { 
    id: 'ID_DA_BM_01', 
    token: 'TOKEN_DE_ACESSO_01', 
    col: 1, 
    statusCol: 2, 
    limitCol: 3, 
    linResumo: 22 
  },
  { 
    id: 'ID_DA_BM_02', 
    token: 'TOKEN_DE_ACESSO_02', 
    col: 5, 
    statusCol: 6, 
    limitCol: 7, 
    linResumo: 13 
  },
  { 
    id: 'ID_DA_BM_03', 
    token: 'TOKEN_DE_ACESSO_03', 
    col: 9, 
    statusCol: 10, 
    limitCol: 11, 
    linResumo: 13 
  }
];

/**
 * Função principal para atualização dos dados na planilha.
 */
function atualizarTudo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Página1");
  const memoria = mapearStatusAtuais(sheet);

  // Limpeza de intervalos de dados para evitar duplicidade ou dados obsoletos
  sheet.getRange("A2:C21").clearContent();
  sheet.getRange("E2:G12").clearContent();
  sheet.getRange("I2:K12").clearContent();
  
  BM_CONFIG.forEach(bm => {
    // Limpa a área de resumo/rodapé da BM específica
    sheet.getRange(bm.linResumo, bm.col, 6, 2).clearContent();
    processarSafeDeploy(bm, sheet, memoria); 
  });
  
  // Registro do horário da última operação
  sheet.getRange("F23").setValue("🕒 Última Atualização: " + Utilities.formatDate(new Date(), "GMT-3", "HH:mm"));
  SpreadsheetApp.getUi().alert("✅ Planilha atualizada!\n\nVerifique o status 'CONTA RESTRITA' no Gerenciador de Negócios caso identificado.");
}

/**
 * Processa as informações de cada BM individualmente.
 */
function processarSafeDeploy(config, sheet, memoria) {
  let contador = { bom: 0, medio: 0, baixo: 0 };
  let linhaAtual = 2;

  try {
    // Consulta inicial: Status da Conta de WhatsApp Business (WABA)
    let urlWabas = `https://graph.facebook.com/v22.0/${config.id}/owned_whatsapp_business_accounts?fields=id,status&access_token=${config.token}`;
    let resWabas = JSON.parse(UrlFetchApp.fetch(urlWabas).getContentText());

    resWabas.data.forEach(waba => {
      // Identifica se a conta possui restrições de política ou desativação global
      let contaBloqueada = (waba.status === "DISABLED" || waba.status === "RESTRICTED");

      // Consulta de detalhes dos números de telefone vinculados à WABA
      let urlPhones = `https://graph.facebook.com/v22.0/${waba.id}/phone_numbers?fields=display_phone_number,quality_rating,status,messaging_limit_tier&access_token=${config.token}`;
      let resPhones = JSON.parse(UrlFetchApp.fetch(urlPhones).getContentText());

      if (resPhones.data) {
        resPhones.data.forEach(chip => {
          let num = chip.display_phone_number || "S/N";
          let q = (chip.quality_rating || "").toUpperCase();
          let s = (chip.status || "UNKNOWN").toUpperCase();
          
          let statusAntigo = memoria[num] || "⚪ S/ INFO";
          let statusFinal = "";
          
          // Lógica de Prioridade de Status
          if (contaBloqueada) {
            statusFinal = "🚫 CONTA RESTRITA (BAN)";
            contador.baixo++;
          } 
          else if (["FLAGGED", "BANNED", "RESTRICTED", "BLOCKED"].includes(s)) {
            statusFinal = "🚫 BLOQUEADO / FLAG";
            contador.baixo++;
          } 
          else if (q.includes("HIGH") || q.includes("GREEN") || s === "CONNECTED") {
            statusFinal = "🟢 ALTA (SEGURO)";
            contador.bom++;
          } 
          else if (q.includes("MEDIUM") || q.includes("YELLOW")) {
            statusFinal = "🟡 MÉDIA (ATENÇÃO)";
            contador.medio++;
          } 
          else {
            statusFinal = "🔴 BAIXA (PERIGO)";
            contador.baixo++;
          }

          // Verificação de Limites de Mensagens (Tiers)
          let tier = chip.messaging_limit_tier;
          let limitFinal = "✅ LIBERADO (1K)"; 
          if (tier) {
            if (tier.includes("TIER_10K")) limitFinal = "🔥 LIBERADO (10K)";
            else if (tier.includes("TIER_100K")) limitFinal = "🚀 LIBERADO (100K)";
            else if (tier.includes("UNLIMITED")) limitFinal = "👑 ILIMITADO";
          }
          if (statusFinal.includes("CONTA RESTRITA") || statusFinal.includes("BLOQUEADO")) {
            limitFinal = "⚠️ RISCO TOTAL";
          }

          // Registro de mudanças no Histórico (Auditoria)
          if (statusAntigo !== "⚪ S/ INFO" && statusFinal !== statusAntigo) {
             registrarMudancaNoHistorico(num, statusAntigo, statusFinal, config.id);
          }

          // Inserção dos dados nas células correspondentes
          sheet.getRange(linhaAtual, config.col).setValue("'" + num);
          sheet.getRange(linhaAtual, config.statusCol).setValue(statusFinal);
          sheet.getRange(linhaAtual, config.limitCol).setValue(limitFinal);
          linhaAtual++;
        });
      }
    });

    // Atualização do rodapé com resumo estatístico e saúde da base
    let r = config.linResumo;
    let total = contador.bom + contador.medio + contador.baixo;
    let porc = total > 0 ? (contador.bom / total) * 100 : 0;

    const resumo = [
      ["CHIPS BONS", contador.bom],
      ["CHIPS MÉDIOS", contador.medio],
      ["CHIPS BAIXOS", contador.baixo],
      ["TOTAL:", porc.toFixed(0) + "%"]
    ];

    sheet.getRange(r, config.col, 4, 2).setValues(resumo);

  } catch (e) { 
    Logger.log("Erro no processamento da BM ID " + config.id + ": " + e.message); 
  }
}

/**
 * Mapeia os status atuais para comparação e histórico.
 */
function mapearStatusAtuais(sheet) {
  let mapa = {};
  let dados = sheet.getRange("A2:K25").getValues();
  dados.forEach(row => {
    if (row[0]) mapa[row[0].toString()] = row[1];
    if (row[4]) mapa[row[4].toString()] = row[5];
    if (row[8]) mapa[row[8].toString()] = row[9];
  });
  return mapa;
}

/**
 * Registra alterações de status em uma aba dedicada para histórico.
 */
function registrarMudancaNoHistorico(numero, de, para, bmId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let logSheet = ss.getSheetByName("Historico") || ss.insertSheet("Historico");
  
  if (logSheet.getLastRow() === 0) {
    logSheet.appendRow(["Data/Hora", "Número", "Status Antigo", "Status Novo", "BM ID"]);
  }
  
  logSheet.insertRowAfter(1);
  logSheet.getRange(2, 1, 1, 5).setValues([[new Date(), "'" + numero, de, para, "'" + bmId]]);
}
