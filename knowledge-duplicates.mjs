export function normalizedKnowledge(value) {
  return String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

function shingles(value) {
  const compact = value.replace(/\s/g, '');
  const result = new Set();
  for (let index = 0; index <= compact.length - 5; index++) result.add(compact.slice(index, index + 5));
  return result;
}

export function knowledgeSimilarity(left, right) {
  const a = normalizedKnowledge(left), b = normalizedKnowledge(right);
  if (a === b) return 1;
  if (Math.min(a.length, b.length) < 100 || Math.min(a.length, b.length) / Math.max(a.length, b.length) < 0.55) return 0;
  const x = shingles(a), y = shingles(b);
  if (!x.size || !y.size) return 0;
  let common = 0;
  for (const part of x) if (y.has(part)) common++;
  const containment = common / Math.min(x.size, y.size);
  const jaccard = common / (x.size + y.size - common);
  return containment >= 0.9 && jaccard >= 0.72 ? jaccard : 0;
}
