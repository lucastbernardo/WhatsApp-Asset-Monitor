/**
 * WHATSAPP ASSET MONITOR - META API INTEGRATION
 * Version: 3.1 (Stable)
 * Features: Multi-BM Monitoring, Anti-Ban Diagnostics, 24h Maturation Lock, Change Logging.
 */

// Configuration: Replace with your actual Meta Business IDs and Perpetual Access Tokens
const BM_CONFIG = [
  { id: 'YOUR_BM_ID_01', token: 'YOUR_TOKEN_01', col: 1, statusCol: 2, limitCol: 3, linResumo: 22 },
  { id: 'YOUR_BM_ID_02', token: 'YOUR_TOKEN_02', col: 5, statusCol: 6, limitCol: 7, linResumo: 13 },
  { id: 'YOUR_BM_ID_03', token: 'YOUR_TOKEN_03', col: 9, statusCol: 10, limitCol: 11, linResumo: 13 }
];

/**
 * Main function to trigger the update process across all configured BMs.
 */
function atualizarTudo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Página1");
  const memoria = mapearStatusAtuais(sheet);

  // Clear previous data and background colors for clean UI
  const dataRanges = ["A2:C21", "E2:G12", "I2:K12"];
  dataRanges.forEach(range => sheet.getRange(range).clearContent().setBackground(null));
  
  BM_CONFIG.forEach(bm => {
    // Clear the summary/footer area for each BM
    sheet.getRange(bm.linResumo, bm.col, 6, 2).clearContent();
    processarSafeDeploy(bm, sheet, memoria); 
  });
  
  sheet.getRange("F23").setValue("🕒 Last Update: " + Utilities.formatDate(new Date(), "GMT-3", "HH:mm"));
  SpreadsheetApp.getUi().alert("✅ Update Complete!\n\nNew assets are highlighted in BLUE (24h Maturation Period).");
}

/**
 * Process individual BM data, checking for bans, quality, and maturation status.
 */
function processarSafeDeploy(config, sheet, memoria) {
  let contador = { bom: 0, medio: 0, baixo: 0 };
  let linhaAtual = 2;

  try {
    // 1. Fetch WABA status for global restriction checks
    let urlWabas = `https://graph.facebook.com/v22.0/${config.id}/owned_whatsapp_business_accounts?fields=id,status&access_token=${config.token}`;
    let resWabas = JSON.parse(UrlFetchApp.fetch(urlWabas).getContentText());

    resWabas.data.forEach(waba => {
      let contaBloqueada = (waba.status === "DISABLED" || waba.status === "RESTRICTED");

      // 2. Fetch individual phone number details
      let urlPhones = `https://graph.facebook.com/v22.0/${waba.id}/phone_numbers?fields=display_phone_number,quality_rating,status,messaging_limit_tier&access_token=${config.token}`;
      let resPhones = JSON.parse(UrlFetchApp.fetch(urlPhones).getContentText());

      if (resPhones.data) {
        resPhones.data.forEach(chip => {
          let num = chip.display_phone_number || "N/A";
          let quality = (chip.quality_rating || "").toUpperCase();
          let statusMeta = (chip.status || "UNKNOWN").toUpperCase();
          
          let statusAntigo = memoria[num] || "NOVO_SISTEMA";
          let statusFinal = "";
          let limitFinal = "";
          let corStatus = null;

          // Maturation Logic (24h Check)
          let dataCadastro = buscarIdadeNoHistorico(num);
          let agora = new Date();
          const vinteQuatroHorasMs = 24 * 60 * 60 * 1000;
          let emMaturacao = dataCadastro && (agora - dataCadastro < vinteQuatroHorasMs);

          // Priority Diagnostic Logic
          if (contaBloqueada) {
            statusFinal = "🚫 CONTA RESTRITA (BAN)";
            limitFinal = "⚠️ TOTAL RISK";
            contador.baixo++;
          } 
          else if (["FLAGGED", "BANNED", "RESTRICTED", "BLOCKED"].includes(statusMeta)) {
            statusFinal = "🚫 BLOCKED / FLAG";
            limitFinal = "⚠️ TOTAL RISK";
            contador.baixo++;
          } 
          else if (statusAntigo === "NOVO_SISTEMA" && !dataCadastro) {
            statusFinal = "🆕 NOVO (AGUARDAR 24H)";
            limitFinal = "⏳ MATURATING";
            corStatus = "#cfe2f3"; 
            contador.bom++;
            registrarMudancaNoHistorico(num, "🆕 NOVO CHIP", "🟢 CADASTRADO (Início 24h)", config.id);
          }
          else if (emMaturacao) {
            statusFinal = "⏳ MATURANDO (24H)";
            limitFinal = "⏳ AGUARDAR";
            corStatus = "#cfe2f3";
            contador.bom++;
          }
          else if (quality.includes("HIGH") || quality.includes("GREEN") || statusMeta === "CONNECTED") {
            statusFinal = "🟢 ALTA (SEGURO)";
            limitFinal = defineTier(chip.messaging_limit_tier);
            contador.bom++;
          } 
          else if (quality.includes("MEDIUM") || quality.includes("YELLOW")) {
            statusFinal = "🟡 MÉDIA (ATENÇÃO)";
            limitFinal = defineTier(chip.messaging_limit_tier);
            contador.medio++;
          } 
          else {
            statusFinal = "🔴 BAIXA (PERIGO)";
            limitFinal = defineTier(chip.messaging_limit_tier);
            contador.baixo++;
          }

          // Log status changes for non-new assets
          if (statusAntigo !== "NOVO_SISTEMA" && statusFinal !== statusAntigo && !emMaturacao) {
              registrarMudancaNoHistorico(num, statusAntigo, statusFinal, config.id);
          }

          // Write data to sheet
          sheet.getRange(linhaAtual, config.col).setValue("'" + num);
          let celStatus = sheet.getRange(linhaAtual, config.statusCol);
          celStatus.setValue(statusFinal);
          if (corStatus) celStatus.setBackground(corStatus);
          
          sheet.getRange(linhaAtual, config.limitCol).setValue(limitFinal);
          linhaAtual++;
        });
      }
    });

    // Write Summary Statistics
    let r = config.linResumo;
    let total = contador.bom + contador.medio + contador.baixo;
    let porc = total > 0 ? (contador.bom / total) * 100 : 0;
    let resumo = [
      ["GOOD ASSETS", contador.bom],
      ["MEDIUM ASSETS", contador.medio],
      ["LOW/BANNED", contador.baixo],
      ["HEALTH:", porc.toFixed(0) + "%"]
    ];
    sheet.getRange(r, config.col, 4, 2).setValues(resumo);

  } catch (e) { Logger.log("Error processing BM " + config.id + ": " + e.message); }
}

/**
 * Maps current sheet data to detect status changes and new arrivals.
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
 * Optimized search in history log for asset registration date.
 */
function buscarIdadeNoHistorico(numero) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName("Historico");
  if (!logSheet) return null;
  
  const dados = logSheet.getDataRange().getValues();
  const numLimpo = numero.toString().replace(/\D/g, '');

  for (let i = 1; i < dados.length; i++) {
    let numHistorico = dados[i][1].toString().replace(/\D/g, '');
    if (numHistorico === numLimpo && dados[i][2] === "🆕 NOVO CHIP") {
      return new Date(dados[i][0]); 
    }
  }
  return null;
}

/**
 * Helper to define Tier display names.
 */
function defineTier(tier) {
  if (!tier) return "✅ LIBERADO (1K)";
  if (tier.includes("TIER_10K")) return "🔥 LIBERADO (10K)";
  if (tier.includes("TIER_100K")) return "🚀 LIBERADO (100K)";
  if (tier.includes("UNLIMITED")) return "👑 UNLIMITED";
  return "✅ LIBERADO (1K)";
}

/**
 * Appends status changes or new registrations to the 'Historico' sheet.
 */
function registrarMudancaNoHistorico(numero, de, para, bmId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let logSheet = ss.getSheetByName("Historico") || ss.insertSheet("Historico");
  if (logSheet.getLastRow() === 0) {
    logSheet.appendRow(["Timestamp", "Phone Number", "Previous Status", "New Status", "BM ID"]);
  }
  logSheet.insertRowAfter(1);
  logSheet.getRange(2, 1, 1, 5).setValues([[new Date(), "'" + numero, de, para, "'" + bmId]]);
}
