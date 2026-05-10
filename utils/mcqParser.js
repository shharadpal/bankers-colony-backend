/**
 * Parse bulk MCQ text format into MCQ objects
 *
 * Format:
 * COURSE: Banking Awareness
 * LEVEL: Medium
 * ACCESS: Free
 * Q: Question text?
 * A: Option A
 * B: Option B
 * C: Option C
 * D: Option D
 * ANS: A
 * EXP: Explanation here.
 *
 * Blocks separated by blank lines.
 */
const parseBulkMCQ = (text) => {
  const blocks  = text.split(/\n\s*\n/).map(b => b.trim()).filter(b => b.includes('Q:'));
  const results = [];
  const errors  = [];

  blocks.forEach((block, idx) => {
    try {
      const lines = {};
      block.split('\n').forEach(line => {
        const colon = line.indexOf(':');
        if (colon === -1) return;
        const key = line.slice(0, colon).trim().toUpperCase();
        const val = line.slice(colon + 1).trim();
        if (key) lines[key] = val;
      });

      // Validate required fields
      const required = ['Q', 'A', 'B', 'C', 'D', 'ANS'];
      const missing  = required.filter(k => !lines[k]);
      if (missing.length) {
        errors.push({ block: idx + 1, error: `Missing fields: ${missing.join(', ')}` });
        return;
      }
      const ans = lines['ANS'].toUpperCase();
      if (!['A','B','C','D'].includes(ans)) {
        errors.push({ block: idx + 1, error: 'ANS must be A, B, C, or D' });
        return;
      }

      results.push({
        course:     lines['COURSE']  || 'General',
        examType:   (lines['EXAM'] || lines['EXAMTYPE'] || '').toLowerCase().replace(/\s+/g,''),
        subject:    lines['SUBJECT'] || '',
        question:   lines['Q'],
        options:    { A: lines['A'], B: lines['B'], C: lines['C'], D: lines['D'] },
        answer:     ans,
        explanation:lines['EXP']    || '',
        difficulty: lines['LEVEL']  || 'Medium',
        access:     (lines['ACCESS'] || 'Free').toLowerCase() === 'free' ? 'free' : 'paid',
        status:     'published',
      });
    } catch (e) {
      errors.push({ block: idx + 1, error: e.message });
    }
  });

  return { parsed: results, errors, total: blocks.length };
};

module.exports = { parseBulkMCQ };
