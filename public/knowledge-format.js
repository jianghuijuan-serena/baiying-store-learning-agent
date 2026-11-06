export function cleanKnowledgeText(text) {
  return String(text || '').replace(/\r/g, '').split('\n')
    .map(line => line.trim().replace(/^#{1,6}\s*/, '').trim()
      // Search, exam and wrong-answer APIs may return several metadata fields
      // inline with the source excerpt instead of on separate lines.
      .replace(/条目编号\s*[:：]\s*[^\s;；]+/gi, '')
      .replace(/知识状态\s*[:：]\s*[^\s;；]+/gi, '')
      .replace(/\bsource_id\s*[:：]\s*[^\s;；]+/gi, '')
      .replace(/\bapproved_internal\b/gi, '')
      .replace(/\s{2,}/g, ' '))
    .filter(line => line &&
      !/^(?:来源文件|原始来源|条目编号|source_id|同步条目|知识状态)\s*[:：]?\s*/i.test(line) &&
      !/^(?:\d+\s*)?(?:原始来源|来源文件)\b/i.test(line) &&
      !/^[;；\s]*(?:source-[a-z0-9_-]+[;；\s]*)+$/i.test(line))
    .map(line => line
      .replace(/（[^）]*\bpolicy-[a-z0-9_-]+[^）]*）/gi, '')
      .replace(/\b(?:policy|source)-[a-z0-9_-]+\b/gi, '')
      .replace(/^[-*]\s+/, '• ')
      .replace(/approved_internal\s*\/\s*approved/gi, '内部知识库状态')
      .replace(/\bapproved\b/gi, '内部知识库状态')
      .replace(/approved_for_external_use(?:\s*=\s*true)?/gi, '可对外使用标记')
      .replace(/negative_example/gi, '反面示例')
      .replace(/approved_internal/gi, '内部知识库状态')
      .replace(/\[CS竞品_img\d+\s*校正\]/gi, '资料校正')
      .replace(/[;；\s]+$/, '').trim())
    .filter(line => line && !/^(?:\d+\.)?\s*[a-z][a-z0-9_-]{6,}$/i.test(line))
    .join('\n');
}
