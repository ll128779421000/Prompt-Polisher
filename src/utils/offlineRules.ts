import { PromptAnalysis } from '@/types'

export class OfflinePromptImprover {
  private static readonly CLARITY_RULES = [
    {
      pattern: /^(help|write|create|make|do|can you)\s/i,
      fix: (text: string) => text.replace(/^(help|write|create|make|do|can you)\s/i, 'I need you to '),
      improvement: 'Made request more direct and specific'
    },
    {
      pattern: /\b(something|anything|stuff|things)\b/gi,
      fix: (text: string) => text,
      improvement: 'Consider replacing vague terms with specific details'
    },
    {
      pattern: /\b(good|nice|better|best)\s+(way|method|approach)\b/gi,
      fix: (text: string) => text,
      improvement: 'Define what "good" means in your context'
    }
  ]

  private static readonly STRUCTURE_RULES = [
    {
      condition: (text: string) => text.length < 50,
      fix: (text: string) => `${text}\n\nContext: [Please provide relevant background information]\nConstraints: [Any limitations or requirements]\nDesired outcome: [What success looks like]`,
      improvement: 'Added structure for missing context'
    },
    {
      condition: (text: string) => !text.includes('example') && text.length > 30,
      fix: (text: string) => `${text}\n\nPlease include 1-2 concrete examples to illustrate your points.`,
      improvement: 'Added request for concrete examples'
    }
  ]

  private static readonly PERSONA_PATTERNS = {
    'code|programming|function|algorithm|debug': 'Act as an experienced software engineer.',
    'write|article|essay|content|blog': 'Act as a professional writer and editor.',
    'analyze|data|research|study|examine': 'Act as a data analyst and researcher.',
    'design|ui|ux|interface|user': 'Act as a UX/UI designer with 10+ years experience.',
    'business|strategy|market|revenue|growth': 'Act as a business strategy consultant.',
    'teach|learn|explain|tutorial|guide': 'Act as an expert teacher and educator.'
  }

  private static readonly FORMAT_PATTERNS = {
    'list|steps|order|sequence': 'Format your response as a numbered list.',
    'compare|comparison|vs|versus|differences': 'Compare different options with pros and cons.',
    'code|programming|example|implementation': 'Provide code examples with explanations.',
    'how to|tutorial|guide|instructions': 'Break down your response into step-by-step instructions.',
    'table|chart|organize|structure': 'Present the information in a table format.',
    'summary|overview|brief|concise': 'Provide a brief summary followed by detailed explanation.'
  }

  public static improvePrompt(text: string): PromptAnalysis {
    let improvedText = text
    const improvements = {
      clarity: [] as string[],
      specificity: [] as string[],
      structure: [] as string[],
      examples: [] as string[]
    }

    // Apply clarity rules
    for (const rule of this.CLARITY_RULES) {
      if (rule.pattern.test(text)) {
        improvedText = rule.fix(improvedText)
        improvements.clarity.push(rule.improvement)
      }
    }

    // Apply structure rules
    for (const rule of this.STRUCTURE_RULES) {
      if (rule.condition(text)) {
        improvedText = rule.fix(improvedText)
        improvements.structure.push(rule.improvement)
      }
    }

    // Add persona if detected
    let suggestedPersona: string | undefined
    for (const [pattern, persona] of Object.entries(this.PERSONA_PATTERNS)) {
      const regex = new RegExp(`\\b(${pattern})\\b`, 'i')
      if (regex.test(text)) {
        suggestedPersona = persona
        improvedText = `${persona}\n\n${improvedText}`
        break
      }
    }

    // Add format instruction if detected
    let suggestedFormat: string | undefined
    for (const [pattern, format] of Object.entries(this.FORMAT_PATTERNS)) {
      const regex = new RegExp(`\\b(${pattern})\\b`, 'i')
      if (regex.test(text)) {
        suggestedFormat = format
        improvedText += `\n\n${format}`
        break
      }
    }

    // Basic improvements based on text characteristics
    if (text.length < 20) {
      improvements.specificity.push('Add more context and details to your request')
    }

    if (!text.match(/\b(want|need|should|goal|objective|result)\b/i)) {
      improvements.clarity.push('Clarify your end goal or desired outcome')
    }

    if (text.match(/\band\b.*\band\b/gi)) {
      improvements.structure.push('Consider breaking multiple requests into numbered points')
    }

    // Calculate confidence based on number of improvements
    const totalImprovements = Object.values(improvements).reduce((sum, arr) => sum + arr.length, 0)
    const confidence = Math.min(0.3 + (totalImprovements * 0.15), 0.9)

    return {
      originalText: text,
      improvements,
      suggestedPersona,
      suggestedFormat,
      improvedPrompt: improvedText.trim(),
      confidence
    }
  }

  // Quick improvement without full analysis
  public static quickImprove(text: string): string {
    let improved = text

    // Basic fixes
    improved = improved.replace(/^(help|write|create|make|do|can you)\s/i, 'I need you to ')
    
    // Add structure if very short
    if (text.length < 30) {
      improved += '\n\nPlease provide specific details and context for the best response.'
    }

    // Add persona for common patterns
    if (/\b(code|programming|function|algorithm)\b/i.test(text)) {
      improved = `Act as an experienced software engineer.\n\n${improved}`
    } else if (/\b(write|article|essay|content)\b/i.test(text)) {
      improved = `Act as a professional writer and editor.\n\n${improved}`
    } else if (/\b(analyze|data|research|study)\b/i.test(text)) {
      improved = `Act as a data analyst and researcher.\n\n${improved}`
    }

    return improved.trim()
  }

  // Check if prompt needs improvement
  public static needsImprovement(text: string): boolean {
    // Too short
    if (text.length < 20) return true
    
    // Starts with weak words
    if (/^(help|write|create|make|do|can you)\s/i.test(text)) return true
    
    // Contains vague terms
    if (/\b(something|anything|stuff|things|good|nice|better|best)\b/i.test(text)) return true
    
    // No clear goal
    if (!text.match(/\b(want|need|should|goal|objective|result)\b/i)) return true
    
    return false
  }

  // Get improvement suggestions without modifying text
  public static getSuggestions(text: string): string[] {
    const suggestions: string[] = []

    if (text.length < 20) {
      suggestions.push('Add more context and specific details')
    }

    if (/^(help|write|create|make|do|can you)\s/i.test(text)) {
      suggestions.push('Start with "I need you to..." for clearer direction')
    }

    if (/\b(something|anything|stuff|things)\b/i.test(text)) {
      suggestions.push('Replace vague terms with specific examples')
    }

    if (!text.includes('example') && text.length > 30) {
      suggestions.push('Consider adding concrete examples')
    }

    if (!text.match(/\b(want|need|should|goal|objective|result)\b/i)) {
      suggestions.push('Clarify your desired outcome or goal')
    }

    return suggestions
  }
}