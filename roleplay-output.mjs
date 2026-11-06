import { modelJson, recordModelDiagnostic } from './llm.mjs';

export function validateTurn(result, input) {
  const required = input.purpose === 'exam' ? ['customer_message'] : ['customer_message', 'feedback', ...(input.self_answer ? ['sample_answer'] : [])];
  const missing = required.filter(key => typeof result?.[key] !== 'string' || !result[key].trim());
  if (input.purpose !== 'exam' && (!Array.isArray(result?.dimensions) || !result.dimensions.length || result.dimensions.some(d => !d || typeof d.name !== 'string' || !d.name.trim() || typeof d.tip !== 'string' || !d.tip.trim()))) missing.push('dimensions');
  if (input.self_answer && /由AI根据资料模拟作答|占位|学员.{0,8}(未作答|未回答|没有回答|未回应|没回答|未实际回应)/.test(String(result?.feedback||''))) missing.push('feedback_target');
  if (input.self_answer && !/不计入.{0,4}成绩/.test(String(result?.feedback||''))) missing.push('demo_disclaimer');
  const sample=String(result?.sample_answer||'');
  if (input.self_answer && /首年优惠后技术服务费为1万元/.test(String(input.knowledge_content||'')) && (/(?:首年|第一年)[^。；\n]{0,30}(?:实付|实际支付|只要|降至)[^。；\n]{0,8}5000(?:元)?/.test(sample)||/(?:首年|第一年)[^，。、；\n]{0,20}(?:优惠后|为)[^，。、；\n]{0,8}5000(?:元)?/.test(sample))) missing.push('fee_policy_mismatch');
  if (input.self_answer && /次年\s*5000/.test(String(input.knowledge_content||'')) && !/第三年|第3年/.test(String(input.knowledge_content||'')) && /(?:次年起|第二年起|以后每年|后续每年)[^。；\n]{0,12}5000/.test(sample)) missing.push('unsupported_future_fee');
  return missing;
}

export async function roleplayTurn(instruction, input, generate = modelJson) {
  const shape = input.purpose === 'exam' ? {customer_message:'客户下一句，非空'} : {
    ...(input.self_answer ? {sample_answer:'AI以销售身份直接说出的完整示范话术，非空，不能用点评替代'} : {}),
    feedback:'针对本轮回答的具体点评，非空，最多3点；AI示范须注明不计入学员成绩',
    dimensions:[{name:'点评维度',score:80,tip:'针对原话的具体改进建议'}],
    customer_message:'客户下一句，非空'
  };
  const feedbackTarget=input.self_answer?'本轮没有学员作答。feedback和dimensions只能评价你生成的sample_answer，指出示范话术的亮点与可改进点；不要提及学员未作答、占位或代答。客户下一句必须回应sample_answer。':'点评对应学员本轮原话。';
  const contract = `${instruction}\n返回JSON对象，字段示例：${JSON.stringify(shape)}。不要转义整个对象。${feedbackTarget}必须先看conversation_history和customer_message，直接回应客户最新一句，保留客户已说出的城市、问题等事实；不要再次询问已明确的信息。若回答重复询问或答非所问，feedback须明确指出。费用口径中“首年优惠后技术服务费为1万元”是优惠后的应付价格，不是优惠金额，不得说成实付5000元；仅有次年5000元口径时，不得说成“次年起每年5000元”；不确定时不要编造数字。不得照搬资料中“不达标”分支的客户后续反应。若回应得当，客户应自然接受或提出资料涵盖的后续问题；不要追问资料没有的保修天数、范围、价格或承诺。仅用本次场景资料。feedback控制在120字内，客户下一句控制在80字内。`;
  for(let attempt=0;attempt<2;attempt++) {
    let result;
    try {
      result=await generate('roleplay_turn',contract+(attempt?'\n上次返回无效。请只返回包含全部必填字段的JSON对象；AI示范时点评sample_answer，不能评价不存在的学员作答。':''),input,{timeoutMs:90000});
    } catch(error) {
      if(error.code!=='MODEL_INVALID_JSON')throw error;
      if(attempt===0)continue;
      const invalid=new Error('AI连续两次返回无效格式，本轮未计入。');
      invalid.httpStatus=502;
      throw invalid;
    }
    const missing=validateTurn(result,input);
    if(!missing.length)return result;
    if(generate===modelJson)recordModelDiagnostic({category:'schema_invalid',task:'roleplay_turn',purpose:input.purpose,selfAnswer:Boolean(input.self_answer),attempt:attempt+1,missing});
  }
  const error=new Error('AI未生成完整的答案和点评，本轮未计入，请重试。');
  error.httpStatus=502;
  throw error;
}
