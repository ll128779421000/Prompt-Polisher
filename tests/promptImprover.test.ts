import { describe, test, expect } from 'vitest'
import { PromptImprover } from '../src/utils/promptImprover'
import { LanguageDetector } from '../src/utils/languageDetector'

describe('PromptImprover', () => {
  test('analyzePrompt returns proper structure', () => {
    const text = 'Help me write a blog post'
    const analysis = PromptImprover.analyzePrompt(text)
    
    expect(analysis).toHaveProperty('originalText', text)
    expect(analysis).toHaveProperty('improvements')
    expect(analysis).toHaveProperty('improvedPrompt')
    expect(analysis).toHaveProperty('confidence')
    
    expect(typeof analysis.confidence).toBe('number')
    expect(analysis.confidence).toBeGreaterThan(0)
    expect(analysis.confidence).toBeLessThanOrEqual(1)
  })

  test('identifies vague prompts and suggests improvements', () => {
    const text = 'Help me write something good'
    const analysis = PromptImprover.analyzePrompt(text)
    
    expect(analysis.improvements.clarity.length).toBeGreaterThan(0)
    expect(analysis.improvedPrompt).not.toBe(text)
    expect(analysis.improvedPrompt.length).toBeGreaterThan(text.length)
  })

  test('suggests appropriate persona for coding prompts', () => {
    const text = 'Help me debug this Python function'
    const analysis = PromptImprover.analyzePrompt(text)
    
    expect(analysis.suggestedPersona).toBeDefined()
    expect(analysis.suggestedPersona).toContain('software engineer')
  })

  test('suggests appropriate persona for writing prompts', () => {
    const text = 'Help me write a professional email'
    const analysis = PromptImprover.analyzePrompt(text)
    
    expect(analysis.suggestedPersona).toBeDefined()
    expect(analysis.suggestedPersona).toContain('writer')
  })

  test('handles very short prompts', () => {
    const text = 'Help'
    const analysis = PromptImprover.analyzePrompt(text)
    
    expect(analysis.improvements.specificity.length).toBeGreaterThan(0)
    expect(analysis.improvedPrompt).toContain('Context')
  })

  test('generates meaningful diff', () => {
    const original = 'Help me code'
    const improved = 'Act as an experienced software engineer.\n\nI need you to code'
    const diff = PromptImprover.generateDiff(original, improved)
    
    expect(Array.isArray(diff)).toBe(true)
    expect(diff.length).toBeGreaterThan(0)
    expect(diff[0]).toHaveProperty('type')
    expect(diff[0]).toHaveProperty('reason')
  })

  test('handles empty or null input gracefully', () => {
    expect(() => PromptImprover.analyzePrompt('')).not.toThrow()
    expect(() => PromptImprover.analyzePrompt('   ')).not.toThrow()
  })

  test('maintains original text structure when appropriate', () => {
    const text = 'Act as a senior developer. Write a Python function to calculate fibonacci numbers with memoization. Include error handling and type hints. Provide usage examples.'
    const analysis = PromptImprover.analyzePrompt(text)
    
    // Good prompts should have fewer improvements
    const totalImprovements = Object.values(analysis.improvements)
      .reduce((sum, arr) => sum + arr.length, 0)
    
    expect(totalImprovements).toBeLessThan(3)
    expect(analysis.confidence).toBeLessThan(0.7) // Lower confidence means less need for improvement
  })
})

describe('LanguageDetector', () => {
  test('detects English correctly', () => {
    const text = 'Hello world, how are you today?'
    const result = LanguageDetector.detect(text)
    
    expect(result.code).toBe('en')
    expect(result.name).toBe('English')
    expect(result.confidence).toBeGreaterThan(0.5)
  })

  test('detects Spanish correctly', () => {
    const text = 'Hola mundo, ¿cómo estás hoy?'
    const result = LanguageDetector.detect(text)
    
    expect(result.code).toBe('es')
    expect(result.name).toBe('Spanish')
    expect(result.confidence).toBeGreaterThan(0.3)
  })

  test('detects French correctly', () => {
    const text = 'Bonjour le monde, comment allez-vous aujourd\'hui?'
    const result = LanguageDetector.detect(text)
    
    expect(result.code).toBe('fr')
    expect(result.name).toBe('French')
    expect(result.confidence).toBeGreaterThan(0.3)
  })

  test('handles short text with fallback', () => {
    const text = 'Hi'
    const result = LanguageDetector.detect(text)
    
    expect(result.code).toBe('en')
    expect(result.confidence).toBe(0.5)
  })

  test('handles empty text gracefully', () => {
    const result = LanguageDetector.detect('')
    
    expect(result.code).toBe('en')
    expect(result.confidence).toBe(0.5)
  })

  test('returns appropriate response instructions', () => {
    expect(LanguageDetector.getResponseLanguage('en')).toContain('English')
    expect(LanguageDetector.getResponseLanguage('es')).toContain('español')
    expect(LanguageDetector.getResponseLanguage('fr')).toContain('français')
    expect(LanguageDetector.getResponseLanguage('unknown')).toContain('English')
  })

  test('handles mixed language text', () => {
    const text = 'Hello mundo, comment are you?'
    const result = LanguageDetector.detect(text)
    
    // Should still detect primary language
    expect(['en', 'es', 'fr']).toContain(result.code)
    expect(result.confidence).toBeGreaterThan(0)
  })
})