export function scenarioKnowledge(content, scenarioTitle) {
  const text=String(content||'');
  const title=String(scenarioTitle||'').trim();
  if (!title || !/^工作表：场景总览/m.test(text)) return text.slice(0,18000);
  const lines=text.split(/\r?\n/);
  const overview=lines.find(line=>/^C\d{2}\s*\|/.test(line)&&line.split('|').slice(4,5).some(cell=>cell.trim()===title||cell.trim().startsWith(title+'（')||title.startsWith(cell.trim()+'（')));
  const id=overview?.match(/^(C\d{2})\s*\|/)?.[1];
  if (!id) return text.slice(0,18000);
  return lines.filter(line=>line.startsWith(id+' |')).join('\n').slice(0,18000);
}

// The synced expansion documents contain many independent approved entries.
// Keep a session on one entry so a slow model need not read the entire library.
export function expansionRoleplayContext(content, sectionIndex, random = Math.random) {
  const sections=String(content||'').split(/(?=^##\s+\d+\.)/m).slice(1).filter(Boolean);
  if (!sections.length) return {text:String(content||'').slice(0,6000),sectionIndex:null};
  const chosen=Number.isInteger(sectionIndex)&&sectionIndex>=0&&sectionIndex<sections.length
    ? sectionIndex : Math.min(sections.length-1,Math.floor(Math.max(0,Math.min(0.999999,random()))*sections.length));
  const boundary=String(content||'').split(/(?=^##\s+\d+\.)/m)[0].split(/\r?\n/)[0];
  return {text:[boundary,sections[chosen]].filter(Boolean).join('\n').slice(0,6000),sectionIndex:chosen};
}

// Source spreadsheets use “首年优惠1万” to mean the discounted first-year price.
// Spell it out before prompting so the model cannot read it as a 10,000 yuan discount.
export function clarifyFeePolicyText(content) {
  return String(content||'').replace(/首年优惠\s*1\s*万(?:元)?/g,'首年优惠后技术服务费为1万元');
}
