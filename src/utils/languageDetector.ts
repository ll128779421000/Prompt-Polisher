import { DetectedLanguage } from '@/types'

const LANGUAGE_PATTERNS = {
  en: {
    patterns: [
      /\b(the|and|or|but|in|on|at|to|for|of|with|by)\b/gi,
      /\b(this|that|these|those|what|when|where|why|how)\b/gi,
      /\b(I|you|he|she|it|we|they|am|is|are|was|were)\b/gi
    ],
    common: ['the', 'and', 'of', 'to', 'a', 'in', 'is', 'it', 'you', 'that']
  },
  es: {
    patterns: [
      /\b(el|la|los|las|un|una|y|o|pero|en|con|de|por|para)\b/gi,
      /\b(este|esta|estos|estas|que|cuando|donde|por que|como)\b/gi,
      /\b(yo|tu|el|ella|nosotros|vosotros|ellos|soy|eres|es|somos)\b/gi
    ],
    common: ['de', 'la', 'que', 'el', 'en', 'y', 'a', 'es', 'se', 'no']
  },
  fr: {
    patterns: [
      /\b(le|la|les|un|une|et|ou|mais|dans|avec|de|par|pour)\b/gi,
      /\b(ce|cette|ces|que|quand|ou|pourquoi|comment)\b/gi,
      /\b(je|tu|il|elle|nous|vous|ils|suis|es|est|sommes)\b/gi
    ],
    common: ['de', 'le', 'et', 'à', 'un', 'il', 'être', 'et', 'en', 'avoir']
  },
  de: {
    patterns: [
      /\b(der|die|das|ein|eine|und|oder|aber|in|mit|von|für)\b/gi,
      /\b(dieser|diese|dieses|was|wann|wo|warum|wie)\b/gi,
      /\b(ich|du|er|sie|wir|ihr|sie|bin|bist|ist|sind)\b/gi
    ],
    common: ['der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich']
  },
  zh: {
    patterns: [
      /[\u4e00-\u9fff]/g,
      /[的|了|是|在|有|和|就|不|与|也|都|这|那]/g
    ],
    common: ['的', '了', '是', '在', '有', '和', '就', '不', '与', '也']
  },
  ja: {
    patterns: [
      /[\u3040-\u309f]/g, // Hiragana
      /[\u30a0-\u30ff]/g, // Katakana
      /[\u4e00-\u9faf]/g  // Kanji
    ],
    common: ['の', 'に', 'は', 'を', 'が', 'と', 'で', 'て', 'だ', 'である']
  },
  pt: {
    patterns: [
      /\b(o|a|os|as|um|uma|e|ou|mas|em|com|de|por|para)\b/gi,
      /\b(este|esta|estes|estas|que|quando|onde|por que|como)\b/gi,
      /\b(eu|tu|ele|ela|nós|vós|eles|sou|és|é|somos)\b/gi
    ],
    common: ['de', 'a', 'o', 'que', 'e', 'do', 'da', 'em', 'um', 'para']
  }
}

export class LanguageDetector {
  private static scoreLanguage(text: string, langCode: string): number {
    const config = LANGUAGE_PATTERNS[langCode as keyof typeof LANGUAGE_PATTERNS]
    if (!config) return 0

    let score = 0
    const textLower = text.toLowerCase()
    const words = textLower.split(/\s+/)
    
    // Check common words
    for (const word of config.common) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi')
      const matches = text.match(regex)
      if (matches) {
        score += matches.length * 2 // Higher weight for common words
      }
    }

    // Check patterns
    for (const pattern of config.patterns) {
      const matches = text.match(pattern)
      if (matches) {
        score += matches.length
      }
    }

    // Normalize by text length
    return words.length > 0 ? score / words.length : 0
  }

  public static detect(text: string): DetectedLanguage {
    if (!text || text.trim().length < 10) {
      return { code: 'en', name: 'English', confidence: 0.5 }
    }

    const scores: { [key: string]: number } = {}
    
    // Score each language
    for (const langCode of Object.keys(LANGUAGE_PATTERNS)) {
      scores[langCode] = this.scoreLanguage(text, langCode)
    }

    // Find the best match
    const bestLang = Object.entries(scores).reduce((best, [lang, score]) => 
      score > best.score ? { lang, score } : best, 
      { lang: 'en', score: 0 }
    )

    const languageNames: { [key: string]: string } = {
      en: 'English',
      es: 'Spanish',
      fr: 'French', 
      de: 'German',
      zh: 'Chinese',
      ja: 'Japanese',
      pt: 'Portuguese'
    }

    // Calculate confidence (0-1)
    const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0)
    const confidence = totalScore > 0 ? Math.min(bestLang.score / totalScore, 1) : 0.5

    return {
      code: bestLang.lang,
      name: languageNames[bestLang.lang] || 'Unknown',
      confidence: Math.max(confidence, 0.1) // Minimum confidence
    }
  }

  public static getResponseLanguage(detectedLang: string): string {
    const languageInstructions: { [key: string]: string } = {
      en: 'Respond in English',
      es: 'Responde en español',
      fr: 'Répondez en français',
      de: 'Antworten Sie auf Deutsch',
      zh: '请用中文回答',
      ja: '日本語で答えてください',
      pt: 'Responda em português'
    }
    
    return languageInstructions[detectedLang] || languageInstructions.en
  }
}