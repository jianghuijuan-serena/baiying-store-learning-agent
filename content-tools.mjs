export function answerValue(value) {
  if (typeof value === 'string' && value.startsWith('[')) {
    try { return JSON.parse(value); } catch { return value; }
  }
  return value;
}
export const storedAnswer = value => Array.isArray(value) ? JSON.stringify(value) : value;
export function validAnswer(value, q) {
  if (q.question_type === 'multiple_choice')
    return Array.isArray(value) && value.length > 0 && new Set(value).size === value.length && value.every(n => Number.isInteger(n) && n >= 0 && n < q.options.length);
  return Number.isInteger(value) && value >= 0 && value < q.options.length;
}
export function sameAnswer(a, b) {
  a = answerValue(a); b = answerValue(b);
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && JSON.stringify([...a].sort((x,y)=>x-y)) === JSON.stringify([...b].sort((x,y)=>x-y));
  return a === b;
}
export const answerText = (q, value) => (Array.isArray(answerValue(value)) ? answerValue(value) : [value]).map(i => q.options[i] ?? '未作答').join('；');
export function normalizeQuestion(q) {
  const question_type = q.question_type || 'single_choice';
  const options = Array.isArray(q.options) ? q.options.map(x => String(x).trim()) : [];
  const result = { question_type, stem:String(q.stem||'').trim(), options, correct:answerValue(q.correct), explanation:String(q.explanation||'') };
  if (!['single_choice','multiple_choice','judgment'].includes(question_type)) throw new Error('题型必须为单选、多选或判断');
  if (result.stem.length < 5 || options.length < 2 || options.length > 8 || options.some(x=>!x) || new Set(options).size !== options.length) throw new Error('题干至少5字，选项须为2–8个且不能空白或重复');
  if (!validAnswer(result.correct,result) || (question_type==='multiple_choice' && result.correct.length < 2)) throw new Error('请填写有效答案，多选题至少有两个正确选项');
  if (question_type==='judgment' && (options.length!==2 || options[0]!=='正确' || options[1]!=='错误')) throw new Error('判断题选项必须为“正确”和“错误”');
  return result;
}
export function distributeCorrectOption(question, position) {
  if (question.question_type !== 'single_choice') return question;
  const count=question.options.length,offset=(position+1)%count;
  return {...question,options:question.options.map((_,index)=>question.options[(index-offset+count)%count]),correct:(question.correct+offset)%count};
}
export function searchChunks(rows, query) {
  const normalized = text => String(text).toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');
  const text = normalized(query);
  const words = String(query).toLowerCase().match(/[a-z0-9]{2,}|[\u3400-\u9fff]{2,}/g)||[];
  const terms = new Set(words);
  for(const word of words) if (/[\u3400-\u9fff]/.test(word)) for(let i=0;i<word.length-1;i++) terms.add(word.slice(i,i+2));
  return rows.map(row=>{
    const hay=normalized(row.content), title=normalized(row.title);
    const matches=[...terms].filter(t=>hay.includes(t)||title.includes(t));
    const score=(hay.includes(text)?100:0)+(title.includes(text)?30:0)+matches.reduce((s,t)=>s+t.length,0);
    return {...row,score};
  }).filter(r=>r.score>0).sort((a,b)=>b.score-a.score||a.position-b.position).slice(0,50);
}
