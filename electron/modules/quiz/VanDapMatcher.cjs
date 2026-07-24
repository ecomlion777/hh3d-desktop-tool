/**
 * HH3D Vấn Đáp Smart matcher ported from userscript v2.5.8.1.
 *
 * The matcher is deliberately conservative:
 *   exact question -> accent-insensitive exact -> high-threshold fuzzy
 * and then exact/alias/high-confidence option matching. Ambiguous or low-
 * confidence questions are skipped rather than submitted.
 */

function decodeHtmlEntities(value) {
  const named = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    laquo: '«', raquo: '»', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’'
  };
  return String(value ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _match;
    })
    .replace(/&#(\d+);/g, (_match, decimal) => {
      const code = Number.parseInt(decimal, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _match;
    })
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match);
}

class VanDapMatcher {
  constructor(questionData = null) {
    this.questionData = null;
    this.questionIndex = [];
    this.questionStopWords = new Set([
      'ai', 'la', 'gi', 'nao', 'dau', 'cua', 'va', 'voi', 'mot', 'nhung',
      'trong', 'ngoai', 'sau', 'day', 'truoc', 'khi', 'tai', 'o', 'den', 'tu',
      'duoc', 'co', 'ten', 'goi', 'nhan', 'vat', 'bo', 'phim', 'hoat', 'hinh',
      'trung', 'quoc', 'thuoc', 'theo', 'hien', 'nhu', 'giua', 'cho',
      'lam', 'da', 'tung', 'con', 'cung', 'nay', 'kia', 'hoi', 'dap'
    ]);
    if (questionData) this.setQuestionData(questionData);
  }

  cleanText(value) {
    return decodeHtmlEntities(value)
      .replace(/<[^>]*>/g, ' ')
      .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  normalizeExact(value) {
    return this.cleanText(value)
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[\p{P}\p{S}\s]+/gu, '');
  }

  normalizeLoose(value) {
    return this.cleanText(value)
      .normalize('NFD')
      .toLowerCase()
      .replace(/đ/g, 'd')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\p{P}\p{S}\s]+/gu, '');
  }

  tokenize(value, removeStopWords = false) {
    const tokens = this.cleanText(value)
      .normalize('NFD')
      .toLowerCase()
      .replace(/đ/g, 'd')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\p{P}\p{S}]+/gu, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!removeStopWords) return tokens;
    return tokens.filter(token => token.length > 1 && !this.questionStopWords.has(token));
  }

  getNumberSignature(value) {
    return (this.cleanText(value).match(/\d+/g) || []).join('|');
  }

  makeNgrams(value, size = 3) {
    const text = String(value || '');
    if (!text) return [];
    if (text.length <= size) return [text];
    const grams = [];
    for (let index = 0; index <= text.length - size; index += 1) {
      grams.push(text.slice(index, index + size));
    }
    return grams;
  }

  multisetDice(itemsA, itemsB) {
    if (!itemsA.length && !itemsB.length) return 1;
    if (!itemsA.length || !itemsB.length) return 0;
    const counts = new Map();
    for (const item of itemsA) counts.set(item, (counts.get(item) || 0) + 1);
    let intersection = 0;
    for (const item of itemsB) {
      const count = counts.get(item) || 0;
      if (count > 0) {
        intersection += 1;
        counts.set(item, count - 1);
      }
    }
    return (2 * intersection) / (itemsA.length + itemsB.length);
  }

  setMetrics(tokensA, tokensB) {
    const setA = new Set(tokensA);
    const setB = new Set(tokensB);
    if (!setA.size && !setB.size) {
      return { dice: 1, jaccard: 1, coverage: 1, intersection: 0 };
    }
    let intersection = 0;
    for (const token of setA) if (setB.has(token)) intersection += 1;
    const union = setA.size + setB.size - intersection;
    const minSize = Math.min(setA.size, setB.size);
    return {
      intersection,
      dice: (2 * intersection) / Math.max(1, setA.size + setB.size),
      jaccard: intersection / Math.max(1, union),
      coverage: intersection / Math.max(1, minSize)
    };
  }

  lengthRatio(a, b) {
    const maxLength = Math.max(String(a || '').length, String(b || '').length);
    if (!maxLength) return 1;
    return Math.min(String(a || '').length, String(b || '').length) / maxLength;
  }

  scoreQuestion(incoming, storedEntry) {
    const incomingLoose = this.normalizeLoose(incoming);
    const storedLoose = storedEntry.loose;
    if (!incomingLoose || !storedLoose) {
      return { score: 0, charScore: 0, tokenScore: 0, contentScore: 0, coverage: 0 };
    }
    // Numeric differences are too risky for fuzzy matching.
    if (this.getNumberSignature(incoming) !== storedEntry.numberSignature) {
      return { score: 0, charScore: 0, tokenScore: 0, contentScore: 0, coverage: 0 };
    }

    const incomingTokens = this.tokenize(incoming);
    const incomingContentTokens = this.tokenize(incoming, true);
    const allTokenMetrics = this.setMetrics(incomingTokens, storedEntry.tokens);
    const contentMetrics = this.setMetrics(incomingContentTokens, storedEntry.contentTokens);
    const charScore = this.multisetDice(this.makeNgrams(incomingLoose, 3), storedEntry.trigrams);
    const lenRatio = this.lengthRatio(incomingLoose, storedLoose);

    let score = charScore * 0.50
      + allTokenMetrics.dice * 0.20
      + contentMetrics.dice * 0.20
      + lenRatio * 0.10;

    if ((incomingLoose.includes(storedLoose) || storedLoose.includes(incomingLoose)) && lenRatio >= 0.72) {
      score = Math.max(score, 0.88 + (lenRatio * 0.11));
    }

    const minContentSize = Math.min(incomingContentTokens.length, storedEntry.contentTokens.length);
    if (minContentSize >= 3 && contentMetrics.coverage < 0.67) score *= 0.72;

    return {
      score,
      charScore,
      tokenScore: allTokenMetrics.dice,
      contentScore: contentMetrics.dice,
      coverage: contentMetrics.coverage,
      lenRatio
    };
  }

  getFuzzyQuestionThreshold(incoming) {
    const length = this.normalizeLoose(incoming).length;
    if (length <= 28) return 0.955;
    if (length <= 55) return 0.925;
    if (length <= 90) return 0.895;
    return 0.875;
  }

  answerFingerprint(answer) {
    return this.expandAnswerCandidates(answer)
      .map(candidate => this.normalizeLoose(candidate))
      .filter(Boolean)
      .sort()
      .join('||');
  }

  parseQuestionData(rawData) {
    let data = null;
    if (rawData?.questions && typeof rawData.questions === 'object' && !Array.isArray(rawData.questions)) {
      data = { questions: rawData.questions };
    } else {
      const sourceItems = Array.isArray(rawData)
        ? rawData
        : (Array.isArray(rawData?.data) ? rawData.data : null);
      if (sourceItems) {
        const questions = {};
        for (const item of sourceItems) {
          const question = item?.question ?? item?.q ?? item?.cau_hoi;
          const answer = item?.answer ?? item?.a ?? item?.dap_an;
          if (typeof question === 'string' && question.trim() && answer != null) {
            questions[question.trim()] = answer;
          }
        }
        if (Object.keys(questions).length) data = { questions };
      } else if (rawData && typeof rawData === 'object') {
        const entries = Object.entries(rawData).filter(([question, answer]) => (
          typeof question === 'string'
          && question.trim()
          && (typeof answer === 'string' || typeof answer === 'number' || Array.isArray(answer))
        ));
        if (entries.length) data = { questions: Object.fromEntries(entries) };
      }
    }

    if (!data?.questions || !Object.keys(data.questions).length) {
      const error = new Error('VAN_DAP_QA_INVALID: Dữ liệu đáp án không hợp lệ hoặc đang trống.');
      error.code = 'VAN_DAP_QA_INVALID';
      throw error;
    }
    return data;
  }

  setQuestionData(rawData) {
    this.questionData = this.parseQuestionData(rawData);
    this.buildQuestionIndex();
    return this.questionIndex.length;
  }

  buildQuestionIndex() {
    const bank = this.questionData?.questions || {};
    this.questionIndex = Object.entries(bank)
      .filter(([question, answer]) => typeof question === 'string' && question.trim() && answer != null)
      .map(([question, answer], index) => {
        const loose = this.normalizeLoose(question);
        return {
          index,
          question,
          answer,
          exact: this.normalizeExact(question),
          loose,
          tokens: this.tokenize(question),
          contentTokens: this.tokenize(question, true),
          trigrams: this.makeNgrams(loose, 3),
          numberSignature: this.getNumberSignature(question),
          answerFingerprint: this.answerFingerprint(answer)
        };
      });
    return this.questionIndex;
  }

  expandAnswerCandidates(answer) {
    const output = [];
    const seen = new Set();
    const push = value => {
      const text = this.cleanText(value)
        .replace(/^(?:đáp\s*án|answer)\s*[:：-]\s*/i, '')
        .trim();
      if (!text) return;
      const key = text.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      output.push(text);
    };
    const visit = value => {
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      if (value == null) return;
      const original = this.cleanText(value);
      if (!original) return;
      const aliases = original.split(/\s*\|\|?\s*/).filter(Boolean);
      if (aliases.length > 1) {
        aliases.forEach(visit);
        return;
      }
      push(original);
      push(original.replace(/^["'“”‘’]+|["'“”‘’]+$/g, ''));
      push(original.replace(/\s*[\(\[\{（【].*?[\)\]\}）】]\s*$/u, '').trim());
      push(original.replace(/\.\s*[\(\[\{（【].*$/u, '').trim());
      const noteMatch = original.match(/^(.+?)\.\s*(?:thực\s*ra|ghi\s*chú|lưu\s*ý|đáp\s*án)\b/i);
      if (noteMatch) push(noteMatch[1]);
      const loose = this.normalizeLoose(original);
      if (loose.includes('tatcadapan')) {
        push('Tất cả đáp án');
        push('Tất cả đáp án trên');
      }
      if (loose === 'ca1va2' || loose === '1va2' || loose.includes('ca1va2')) {
        push('Cả 1 và 2');
        push('1 và 2');
        push('Cả đáp án 1 và 2');
      }
    };
    visit(answer);
    return output;
  }

  normalizeSpecialAnswer(value) {
    const loose = this.normalizeLoose(value);
    if (!loose) return '';
    if (loose.includes('tatcadapan')) return '__ALL_ANSWERS__';
    if (loose === 'ca1va2' || loose === '1va2' || loose === 'cadapan1va2' || loose.includes('ca1va2')) {
      return '__BOTH_1_2__';
    }
    return loose;
  }

  scoreAnswer(candidate, option) {
    const candidateLoose = this.normalizeLoose(candidate);
    const optionLoose = this.normalizeLoose(option);
    if (!candidateLoose || !optionLoose) return 0;
    const charScore = this.multisetDice(this.makeNgrams(candidateLoose, 2), this.makeNgrams(optionLoose, 2));
    const tokenMetrics = this.setMetrics(this.tokenize(candidate), this.tokenize(option));
    const lenRatio = this.lengthRatio(candidateLoose, optionLoose);
    let score = charScore * 0.58 + tokenMetrics.dice * 0.27 + lenRatio * 0.15;
    if ((candidateLoose.includes(optionLoose) || optionLoose.includes(candidateLoose)) && lenRatio >= 0.68) {
      score = Math.max(score, 0.86 + lenRatio * 0.12);
    }
    return score;
  }

  findAnswerOption(answer, options) {
    if (!Array.isArray(options) || !options.length) {
      return { ok: false, reason: 'invalid_options', message: 'Server không trả danh sách lựa chọn hợp lệ' };
    }
    const candidates = this.expandAnswerCandidates(answer);
    if (!candidates.length) {
      return { ok: false, reason: 'empty_answer', message: 'Đáp án QA đang trống' };
    }

    const collectUniqueIndexes = matcher => {
      const indexes = new Set();
      candidates.forEach(candidate => options.forEach((option, index) => {
        if (matcher(candidate, option)) indexes.add(index);
      }));
      return [...indexes];
    };

    const exactIndexes = collectUniqueIndexes((candidate, option) => (
      this.normalizeExact(candidate) === this.normalizeExact(option)
    ));
    if (exactIndexes.length === 1) {
      const index = exactIndexes[0];
      return { ok: true, index, option: options[index], confidence: 1, matchType: 'answer_exact', candidates };
    }
    if (exactIndexes.length > 1) {
      return { ok: false, reason: 'ambiguous_options', message: 'Nhiều option cùng khớp chính xác với đáp án', candidates, indexes: exactIndexes };
    }

    const looseIndexes = collectUniqueIndexes((candidate, option) => (
      this.normalizeLoose(candidate) === this.normalizeLoose(option)
    ));
    if (looseIndexes.length === 1) {
      const index = looseIndexes[0];
      return { ok: true, index, option: options[index], confidence: 0.99, matchType: 'answer_loose', candidates };
    }
    if (looseIndexes.length > 1) {
      return { ok: false, reason: 'ambiguous_options', message: 'Nhiều option trùng nhau sau khi bỏ dấu', candidates, indexes: looseIndexes };
    }

    const specialIndexes = collectUniqueIndexes((candidate, option) => (
      this.normalizeSpecialAnswer(candidate) === this.normalizeSpecialAnswer(option)
    ));
    if (specialIndexes.length === 1) {
      const index = specialIndexes[0];
      return { ok: true, index, option: options[index], confidence: 0.98, matchType: 'answer_alias', candidates };
    }
    if (specialIndexes.length > 1) {
      return { ok: false, reason: 'ambiguous_options', message: 'Nhiều option cùng khớp alias đáp án', candidates, indexes: specialIndexes };
    }

    const scoredOptions = options
      .map((option, index) => {
        let score = 0;
        let matchedCandidate = '';
        for (const candidate of candidates) {
          const currentScore = this.scoreAnswer(candidate, option);
          if (currentScore > score) {
            score = currentScore;
            matchedCandidate = candidate;
          }
        }
        return { index, option, score, matchedCandidate };
      })
      .sort((a, b) => b.score - a.score);

    const best = scoredOptions[0];
    const second = scoredOptions[1];
    const maxLength = Math.max(
      ...candidates.map(candidate => this.normalizeLoose(candidate).length),
      this.normalizeLoose(best?.option).length
    );
    const threshold = maxLength <= 6 ? 0.98 : (maxLength <= 12 ? 0.92 : 0.87);
    const margin = second ? best.score - second.score : best.score;

    if (best && best.score >= threshold && (!second || margin >= 0.07)) {
      return {
        ok: true,
        index: best.index,
        option: best.option,
        confidence: best.score,
        matchType: 'answer_fuzzy',
        matchedCandidate: best.matchedCandidate,
        candidates,
        alternatives: scoredOptions.slice(0, 3)
      };
    }

    return {
      ok: false,
      reason: 'not_in_options',
      message: 'Đáp án QA không khớp đủ tin cậy với option server',
      candidates,
      alternatives: scoredOptions.slice(0, 4)
    };
  }

  resolveCandidateGroup(candidates, options, matchType) {
    if (!candidates.length) return null;
    const evaluated = candidates.map(candidate => ({
      ...candidate,
      answerMatch: this.findAnswerOption(candidate.answer, options)
    }));
    const valid = evaluated
      .filter(candidate => candidate.answerMatch.ok)
      .sort((a, b) => {
        const questionDiff = (b.questionScore || 0) - (a.questionScore || 0);
        return questionDiff !== 0 ? questionDiff : b.answerMatch.confidence - a.answerMatch.confidence;
      });

    if (valid.length === 1) {
      return { ok: true, matchType, candidate: valid[0], answerMatch: valid[0].answerMatch };
    }
    if (valid.length > 1) {
      const uniqueOptionIndexes = new Set(valid.map(candidate => candidate.answerMatch.index));
      if (uniqueOptionIndexes.size === 1) {
        return {
          ok: true,
          matchType,
          candidate: valid[0],
          answerMatch: valid[0].answerMatch,
          equivalentCandidates: valid.slice(1)
        };
      }
      const best = valid[0];
      const second = valid[1];
      const scoreMargin = (best.questionScore || 0) - (second.questionScore || 0);
      if (matchType === 'question_fuzzy' && scoreMargin >= 0.055) {
        return { ok: true, matchType, candidate: best, answerMatch: best.answerMatch };
      }
      return {
        ok: false,
        reason: 'ambiguous_question',
        message: 'Có nhiều QA gần giống nhưng dẫn tới các option khác nhau',
        candidates: valid.slice(0, 5)
      };
    }

    const fingerprints = new Set(evaluated.map(candidate => candidate.answerFingerprint));
    if (evaluated.length === 1 || fingerprints.size === 1) {
      return {
        ok: false,
        reason: 'not_in_options',
        message: evaluated[0].answerMatch.message,
        candidate: evaluated[0],
        answerMatch: evaluated[0].answerMatch
      };
    }
    return {
      ok: false,
      reason: 'ambiguous_question',
      message: 'Nhiều QA trùng câu hỏi nhưng có đáp án khác nhau',
      candidates: evaluated.slice(0, 5)
    };
  }

  findQuestionAndAnswer(questionObject) {
    const incomingQuestion = this.cleanText(questionObject?.question);
    const options = Array.isArray(questionObject?.options) ? questionObject.options : [];
    if (!incomingQuestion) {
      return { ok: false, reason: 'invalid_question', message: 'Server trả câu hỏi trống' };
    }

    const exact = this.normalizeExact(incomingQuestion);
    const exactMatches = this.questionIndex
      .filter(entry => entry.exact === exact)
      .map(entry => ({ ...entry, questionScore: 1 }));
    if (exactMatches.length) return this.resolveCandidateGroup(exactMatches, options, 'question_exact');

    const loose = this.normalizeLoose(incomingQuestion);
    const looseMatches = this.questionIndex
      .filter(entry => entry.loose === loose)
      .map(entry => ({ ...entry, questionScore: 0.995 }));
    if (looseMatches.length) return this.resolveCandidateGroup(looseMatches, options, 'question_loose');

    const threshold = this.getFuzzyQuestionThreshold(incomingQuestion);
    const fuzzyMatches = this.questionIndex
      .map(entry => {
        const metrics = this.scoreQuestion(incomingQuestion, entry);
        return { ...entry, ...metrics, questionScore: metrics.score };
      })
      .filter(entry => entry.questionScore >= threshold)
      .sort((a, b) => b.questionScore - a.questionScore)
      .slice(0, 8);

    if (!fuzzyMatches.length) {
      return {
        ok: false,
        reason: 'not_in_cache',
        message: 'Không có QA nào đạt ngưỡng tương đồng an toàn',
        incomingQuestion,
        threshold
      };
    }

    const resolved = this.resolveCandidateGroup(fuzzyMatches, options, 'question_fuzzy');
    if (!resolved) return { ok: false, reason: 'not_in_cache', message: 'Không tìm thấy QA phù hợp' };

    if (resolved.ok && fuzzyMatches.length > 1) {
      const best = fuzzyMatches[0];
      const second = fuzzyMatches[1];
      if (
        best.answerFingerprint !== second.answerFingerprint
        && best.questionScore - second.questionScore < 0.035
        && resolved.candidate.index === best.index
      ) {
        return {
          ok: false,
          reason: 'ambiguous_question',
          message: 'Hai QA gần nhất có độ tương đồng quá sát nhau',
          candidates: fuzzyMatches.slice(0, 5)
        };
      }
    }
    return resolved;
  }

  getQuestionKey(question) {
    const id = question?.id;
    if (id !== undefined && id !== null && String(id).trim()) return `id:${String(id).trim()}`;
    return `q:${this.normalizeLoose(question?.question)}`;
  }

  getQuestionState(question) {
    const numericState = Number.parseInt(question?.is_correct, 10);
    if (Number.isFinite(numericState)) return numericState;
    if (question?.answered === true || question?.is_answered === true || question?.completed === true) return 1;
    const userAnswer = question?.user_answer ?? question?.selected_answer ?? question?.answer_selected;
    if (userAnswer !== undefined && userAnswer !== null && String(userAnswer) !== '') return 1;
    return 0;
  }

  isQuestionUnanswered(question) {
    return this.getQuestionState(question) === 0;
  }
}

module.exports = VanDapMatcher;
module.exports.decodeHtmlEntities = decodeHtmlEntities;
