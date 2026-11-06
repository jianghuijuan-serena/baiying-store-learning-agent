export function examCriticalErrors(review) {
  return Array.isArray(review?.critical_errors) ? review.critical_errors.filter(item =>
    item && typeof item.quote === 'string' && item.quote.trim().length >= 4 &&
    typeof item.basis === 'string' && item.basis.trim().length >= 4 &&
    ['price','warranty','scope'].includes(item.category)
  ).slice(0, 4) : [];
}

export function roleplayExamPassed(score, threshold, review) {
  return Number(score) >= Number(threshold) && examCriticalErrors(review).length === 0;
}

export function normalizeExamReview(review, rounds) {
  if (!Number.isFinite(Number(review?.score))) return null;
  if (!Array.isArray(review.round_reviews) || review.round_reviews.length !== rounds) return null;
  const entries = review.round_reviews.map((item, index) => {
    if (Number(item?.round) !== index + 1 || typeof item.feedback !== 'string' || !item.feedback.trim() || typeof item.improvement !== 'string' || !item.improvement.trim()) return null;
    return { round:index + 1, feedback:item.feedback.trim().slice(0,300), improvement:item.improvement.trim().slice(0,300), basis:typeof item.basis === 'string' ? item.basis.trim().slice(0,160) : '' };
  });
  if (entries.includes(null)) return null;
  return {
    score:Math.max(0,Math.min(100,Math.round(Number(review.score)))),
    dimensions:Array.isArray(review.dimensions)?review.dimensions.slice(0,6):[],
    strengths:Array.isArray(review.strengths)?review.strengths.slice(0,4):[],
    improvements:Array.isArray(review.improvements)?review.improvements.slice(0,5):[],
    next_practice:String(review.next_practice||''),
    round_reviews:entries,
    critical_errors:examCriticalErrors(review).map(item=>({category:item.category,quote:item.quote.trim().slice(0,180),basis:item.basis.trim().slice(0,220)}))
  };
}
