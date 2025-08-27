import { PromptAnalysis, PromptDiff, DetectedLanguage } from '@/types'
import { LanguageDetector } from './languageDetector'

interface ImprovementRule {
  pattern: RegExp
  suggestion: string
  category: 'clarity' | 'specificity' | 'structure' | 'persona' | 'format' | 'examples'
  priority: number
}

const IMPROVEMENT_RULES: ImprovementRule[] = [
  // Clarity improvements
  {
    pattern: /^(help|write|create|make|do|can you)\s/i,
    suggestion: 'Be more specific about what you want to achieve',
    category: 'clarity',
    priority: 8
  },
  {
    pattern: /\b(something|anything|stuff|things)\b/gi,
    suggestion: 'Replace vague terms with specific details',
    category: 'clarity', 
    priority: 7
  },
  {
    pattern: /\b(good|nice|better|best)\s+(way|method|approach)\b/gi,
    suggestion: 'Define what "good" means in your context',
    category: 'clarity',
    priority: 6
  },

  // Specificity improvements
  {
    pattern: /^.{1,20}$/,
    suggestion: 'Add more context and details to your request',
    category: 'specificity',
    priority: 9
  },
  {
    pattern: /\b(quickly|simple|easy|basic)\b/gi,
    suggestion: 'Specify time constraints, complexity level, or prerequisites',
    category: 'specificity',
    priority: 5
  },

  // Structure improvements
  {
    pattern: /^[^.!?]*[.!?]?\s*$/,
    suggestion: 'Break complex requests into numbered steps or bullet points',
    category: 'structure',
    priority: 4
  },
  {
    pattern: /\b(and|also|plus|additionally)\b.*\b(and|also|plus|additionally)\b/gi,
    suggestion: 'Structure multiple requests clearly with numbered points',
    category: 'structure',
    priority: 6
  }
]

const PERSONA_SUGGESTIONS = {
  code: 'Act as an experienced software engineer',
  write: 'Act as a professional writer and editor', 
  analyze: 'Act as a data analyst and researcher',
  design: 'Act as a UX/UI designer with 10+ years experience',
  business: 'Act as a business strategy consultant',
  teach: 'Act as an expert teacher and educator',
  debug: 'Act as a senior developer debugging complex issues',
  review: 'Act as a thorough code reviewer',
  plan: 'Act as a project manager creating detailed plans'
}

const FORMAT_SUGGESTIONS = {
  list: 'Format your response as a numbered list',
  table: 'Present the information in a table format', 
  code: 'Provide code examples with explanations',
  step: 'Break down your response into step-by-step instructions',
  summary: 'Provide a brief summary followed by detailed explanation',
  comparison: 'Compare different options with pros and cons',
  template: 'Provide a template or framework I can customize'
}

export class PromptImprover {
  public static analyzePrompt(text: string): PromptAnalysis {
    const detectedLang = LanguageDetector.detect(text)
    const improvements = this.findImprovements(text)
    const suggestedPersona = this.suggestPersona(text)
    const suggestedFormat = this.suggestFormat(text)
    const improvedPrompt = this.generateImprovedPrompt(text, improvements, suggestedPersona, suggestedFormat, detectedLang)
    
    return {
      originalText: text,
      improvements,
      suggestedPersona,
      suggestedFormat,
      improvedPrompt,
      confidence: this.calculateConfidence(improvements)
    }
  }

  private static findImprovements(text: string) {
    const improvements = {
      clarity: [] as string[],
      specificity: [] as string[],
      structure: [] as string[],
      examples: [] as string[]
    }

    for (const rule of IMPROVEMENT_RULES) {
      if (rule.pattern.test(text)) {
        improvements[rule.category].push(rule.suggestion)
      }
    }

    // Check for missing context
    if (text.length < 50) {
      improvements.specificity.push('Provide more background context')
    }

    // Check for missing examples
    if (!text.includes('example') && !text.includes('like') && text.length > 30) {
      improvements.examples.push('Consider adding concrete examples of what you want')
    }

    // Check for unclear goals
    if (!text.match(/\b(want|need|should|goal|objective|result)\b/i)) {
      improvements.clarity.push('Clarify your end goal or desired outcome')
    }

    return improvements
  }

  private static suggestPersona(text: string): string | undefined {
    const textLower = text.toLowerCase()
    
    if (textLower.match(/\b(code|programming|function|algorithm|debug)\b/)) {
      return PERSONA_SUGGESTIONS.code
    }
    if (textLower.match(/\b(write|article|essay|content|blog)\b/)) {
      return PERSONA_SUGGESTIONS.write
    }
    if (textLower.match(/\b(analyze|data|research|study|examine)\b/)) {
      return PERSONA_SUGGESTIONS.analyze
    }
    if (textLower.match(/\b(design|ui|ux|interface|user)\b/)) {
      return PERSONA_SUGGESTIONS.design
    }
    if (textLower.match(/\b(business|strategy|market|revenue|growth)\b/)) {
      return PERSONA_SUGGESTIONS.business
    }
    if (textLower.match(/\b(teach|learn|explain|tutorial|guide)\b/)) {
      return PERSONA_SUGGESTIONS.teach
    }
    if (textLower.match(/\b(plan|planning|schedule|timeline|roadmap)\b/)) {
      return PERSONA_SUGGESTIONS.plan
    }

    return undefined
  }

  private static suggestFormat(text: string): string | undefined {
    const textLower = text.toLowerCase()

    if (textLower.match(/\b(list|steps|order|sequence)\b/)) {
      return FORMAT_SUGGESTIONS.list
    }
    if (textLower.match(/\b(compare|comparison|vs|versus|differences)\b/)) {
      return FORMAT_SUGGESTIONS.comparison
    }
    if (textLower.match(/\b(code|programming|example|implementation)\b/)) {
      return FORMAT_SUGGESTIONS.code
    }
    if (textLower.match(/\b(how to|tutorial|guide|instructions)\b/)) {
      return FORMAT_SUGGESTIONS.step
    }
    if (textLower.match(/\b(table|chart|organize|structure)\b/)) {
      return FORMAT_SUGGESTIONS.table
    }
    if (textLower.match(/\b(template|framework|boilerplate|starter)\b/)) {
      return FORMAT_SUGGESTIONS.template
    }
    if (textLower.match(/\b(summary|overview|brief|concise)\b/)) {
      return FORMAT_SUGGESTIONS.summary
    }

    return undefined
  }

  private static generateImprovedPrompt(
    original: string, 
    improvements: any,
    persona?: string,
    format?: string,
    detectedLang?: DetectedLanguage
  ): string {
    let improved = original

    // Add language instruction
    if (detectedLang && detectedLang.code !== 'en') {
      const langInstruction = LanguageDetector.getResponseLanguage(detectedLang.code)
      improved = `${langInstruction}.\n\n${improved}`
    }

    // Add persona
    if (persona) {
      improved = `${persona}.\n\n${improved}`
    }

    // Enhance clarity
    if (improved.match(/^(help|write|create|make|do)\s/i)) {
      improved = improved.replace(/^(help|write|create|make|do)\s/i, (match) => {
        return `I need you to ${match.toLowerCase().trim()} `
      })
    }

    // Add specificity
    if (original.length < 50) {
      improved += '\n\nContext: [Please provide relevant background information]\nConstraints: [Any limitations or requirements]\nDesired outcome: [What success looks like]'
    }

    // Add format instruction
    if (format) {
      improved += `\n\n${format}.`
    }

    // Add examples if needed
    if (improvements.examples.length > 0 && !original.includes('example')) {
      improved += '\n\nPlease include 1-2 concrete examples to illustrate your points.'
    }

    return improved.trim()
  }

  private static calculateConfidence(improvements: any): number {
    const totalImprovements = Object.values(improvements).reduce((sum, arr: any) => sum + arr.length, 0)
    
    // More improvements = lower confidence in original prompt
    // But higher confidence in our ability to improve it
    if (totalImprovements === 0) return 0.3 // Low confidence if no improvements found
    if (totalImprovements <= 2) return 0.7
    if (totalImprovements <= 4) return 0.8
    return 0.9
  }

  public static generateDiff(original: string, improved: string): PromptDiff[] {
    const diffs: PromptDiff[] = []
    
    // Simple diff generation - in production you'd use a proper diff library
    if (improved.includes('Act as')) {
      diffs.push({
        type: 'addition',
        original: '',
        improved: improved.match(/^Act as[^.]+\./)?.[0] || '',
        reason: 'Added expert persona for better context',
        category: 'persona'
      })
    }

    if (improved.includes('Format your response')) {
      diffs.push({
        type: 'addition',
        original: '',
        improved: improved.match(/Format your response[^.]+\./)?.[0] || '',
        reason: 'Specified output format for clarity',
        category: 'format'
      })
    }

    if (improved.includes('Context:')) {
      diffs.push({
        type: 'addition',
        original: '',
        improved: 'Context and constraints section',
        reason: 'Added structure for missing context',
        category: 'structure'
      })
    }

    return diffs
  }
}