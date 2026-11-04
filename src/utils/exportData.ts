import type { RoomState } from '../types/game.ts';

/**
 * Escapes a cell value for CSV (RFC 4180 standard)
 */
function escapeCSV(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Exports class game data and student reflections to a clean UTF-8 CSV with BOM for Excel compatibility.
 */
export function exportRoomDataToCSV(room: RoomState): void {
  const lines: string[] = [];

  // Header / Meta
  lines.push(`【安屎之亂：衛生紙價格策略賽局 — 班級教學數據總結】`);
  lines.push(`房間代碼,${escapeCSV(room.roomId)},賽局狀態,${escapeCSV(room.status)},匯出時間,${escapeCSV(new Date().toLocaleString('zh-TW'))}`);
  lines.push(`總回合數,${room.totalRounds},市場總需求,${room.marketDemand} 箱,基本成本,${room.costPerUnit} 元/箱,參賽組數,${room.teams.length} 組`);
  lines.push('');

  // Section 1: Team Ranking & Financial Performance
  lines.push('=== 一、全班廠商利潤與銷量排行榜 ===');
  lines.push([
    '最終排名',
    '組別',
    '廠商品牌',
    '組員名單',
    '累計總淨利潤 (元)',
    '累計總銷量 (箱)',
    '得標次數',
    'R1出價',
    'R1銷量',
    'R1利潤',
    'R2出價',
    'R2銷量',
    'R2利潤',
    'R3出價',
    'R3協議價',
    'R3銷量',
    'R3利潤',
    'R4出價',
    'R4協議價',
    'R4銷量',
    'R4利潤',
  ].join(','));

  const sortedTeams = [...room.teams].sort((a, b) => b.totalProfit - a.totalProfit);

  sortedTeams.forEach((team, index) => {
    const r1 = team.roundHistory.find((h) => h.round === 1);
    const r2 = team.roundHistory.find((h) => h.round === 2);
    const r3 = team.roundHistory.find((h) => h.round === 3);
    const r4 = team.roundHistory.find((h) => h.round === 4);

    const winCount = team.roundHistory.filter((h) => h.isWinner).length;

    const row = [
      escapeCSV(`第 ${index + 1} 名`),
      escapeCSV(`第 ${team.teamNumber} 組`),
      escapeCSV(team.brandTag + (team.isAI ? ' (AI)' : '')),
      escapeCSV(team.members || '全體組員'),
      escapeCSV(team.totalProfit),
      escapeCSV(team.totalSoldUnits),
      escapeCSV(`${winCount} / ${room.totalRounds}`),
      escapeCSV(r1 ? `${r1.bid}元` : '-'),
      escapeCSV(r1 ? r1.unitsSold : 0),
      escapeCSV(r1 ? r1.profit : 0),
      escapeCSV(r2 ? `${r2.bid}元` : '-'),
      escapeCSV(r2 ? r2.unitsSold : 0),
      escapeCSV(r2 ? r2.profit : 0),
      escapeCSV(r3 ? `${r3.bid}元` : '-'),
      escapeCSV(r3?.agreedPrice ? `${r3.agreedPrice}元` : '-'),
      escapeCSV(r3 ? r3.unitsSold : 0),
      escapeCSV(r3 ? r3.profit : 0),
      escapeCSV(r4 ? `${r4.bid}元` : '-'),
      escapeCSV(r4?.agreedPrice ? `${r4.agreedPrice}元` : '-'),
      escapeCSV(r4 ? r4.unitsSold : 0),
      escapeCSV(r4 ? r4.profit : 0),
    ];
    lines.push(row.join(','));
  });

  lines.push('');
  lines.push('=== 二、四回合市場最低價與價格趨勢摘要 ===');
  lines.push(['回合', '溝通規則', '全場最低得標價', '得標廠商數', '得標廠商清單', '消費者福祉指數'].join(','));

  [1, 2, 3, 4].forEach((r) => {
    const summary = room.roundHistorySummary.find((s) => s.round === r);
    const ruleLabel = r <= 2 ? '禁止溝通 (獨立秘密報價)' : '開放跨組協商 (口頭協議)';
    if (summary) {
      const winnerNames = summary.winnerTeamIds
        .map((id) => {
          const t = room.teams.find((tm) => tm.id === id);
          return t ? `${t.brandTag}(第${t.teamNumber}組)` : id;
        })
        .join('、');

      lines.push([
        escapeCSV(`R${r}`),
        escapeCSV(ruleLabel),
        escapeCSV(`${summary.minPrice} 元`),
        escapeCSV(`${summary.winnerTeamIds.length} 家`),
        escapeCSV(winnerNames || '無'),
        escapeCSV(`${summary.consumerSurplusScore} 分`),
      ].join(','));
    } else {
      lines.push([escapeCSV(`R${r}`), escapeCSV(ruleLabel), escapeCSV('尚未進行'), '', '', ''].join(','));
    }
  });

  lines.push('');
  lines.push('=== 三、各組反思學習單詳細回答一覽表 ===');
  lines.push([
    '組別',
    '品牌',
    '組員',
    '1.不能溝通時(R1-R2)顧慮',
    '2.開放溝通後(R3-R4)背叛誘因',
    '3-(1)何時生產者受益最大',
    '3-(2)何時消費者受益最大',
    '3-(3)政府要如何保障消費者',
  ].join(','));

  room.teams.forEach((team) => {
    const ref = team.reflection || {
      r1r2Concern: '',
      r3r4Cheating: '',
      producerBenefit: '',
      consumerBenefit: '',
      governmentRole: '',
    };
    lines.push([
      escapeCSV(`第 ${team.teamNumber} 組`),
      escapeCSV(team.brandTag),
      escapeCSV(team.members || '全體組員'),
      escapeCSV(ref.r1r2Concern || '未填寫'),
      escapeCSV(ref.r3r4Cheating || '未填寫'),
      escapeCSV(ref.producerBenefit || '未填寫'),
      escapeCSV(ref.consumerBenefit || '未填寫'),
      escapeCSV(ref.governmentRole || '未填寫'),
    ].join(','));
  });

  // Combine with UTF-8 BOM
  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  const dateStr = new Date().toISOString().slice(0, 10);
  link.setAttribute('download', `安屎之亂_賽局總結數據_${room.roomId}_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
