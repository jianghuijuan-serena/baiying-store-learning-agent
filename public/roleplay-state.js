export function roleplayStateFromResponse(response,{taskId=null,passScore=60,finished=false}={}){
 const turns=Array.isArray(response.turns)?response.turns:[];
 const maxRounds=Number(response.max_rounds)||8;
 const completedRounds=turns.filter(turn=>turn.actor==='user'||turn.actor==='demo').length;
 const status=response.status??'active';
 return {
  id:response.id,
  taskId:response.task_id||taskId||null,
  mode:response.mode,
  purpose:response.purpose,
  difficulty:response.difficulty,
  difficultyLabel:response.difficulty_label||({starter:'入门',standard:'标准',pressure:'高压',expert:'专家'}[response.difficulty]||'标准'),
  maxRounds,
  passScore:response.pass_score??passScore,
  scenario_title:response.scenario_title||'客户沟通模拟',
  focus:response.focus||'',
  turns,
  status,
  score:response.score??null,
  finished:finished||status!=='active',
  roundsComplete:response.rounds_complete??completedRounds>=maxRounds
 };
}
