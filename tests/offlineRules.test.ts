import { describe, test, expect } from 'vitest'
import { OfflinePromptImprover } from '../src/utils/offlineRules'

describe('OfflinePromptImprover', () => {
  test('improves vague prompts', () => {
    const text = 'Help me write something'
    const result = OfflinePromptImprover.improvePrompt(text)
    
    expect(result.improvedPrompt).not.toBe(text)
    expect(result.improvedPrompt).toContain('I need you to')
    expect(result.improvements.clarity.length).toBeGreaterThan(0)
  })

  test('adds structure to short prompts', () => {
    const text = 'Write code'
    const result = OfflinePromptImprover.improvePrompt(text)
    
    expect(result.improvedPrompt).toContain('Context')
    expect(result.improvements.structure.length).toBeGreaterThan(0)
  })

  test('suggests appropriate personas', () => {
    const codePrompt = 'Debug my Python function'
    const codeResult = OfflinePromptImprover.improvePrompt(codePrompt)
    expect(codeResult.suggestedPersona).toContain('software engineer')
    
    const writePrompt = 'Write a blog post about AI'
    const writeResult = OfflinePromptImprover.improvePrompt(writePrompt)
    expect(writeResult.suggestedPersona).toContain('writer')
  })

  test('suggests appropriate formats', () => {
    const listPrompt = 'Give me a list of programming languages'
    const listResult = OfflinePromptImprover.improvePrompt(listPrompt)
    expect(listResult.suggestedFormat).toContain('numbered list')
    
    const comparePrompt = 'Compare Python vs JavaScript'
    const compareResult = OfflinePromptImprover.improvePrompt(comparePrompt)
    expect(compareResult.suggestedFormat).toContain('pros and cons')
  })

  test('quickImprove provides basic fixes', () => {
    const text = 'Help me code a function'
    const improved = OfflinePromptImprover.quickImprove(text)
    
    expect(improved).not.toBe(text)
    expect(improved).toContain('I need you to')
    expect(improved).toContain('Act as an experienced software engineer')
  })

  test('needsImprovement correctly identifies poor prompts', () => {
    expect(OfflinePromptImprover.needsImprovement('Help')).toBe(true)
    expect(OfflinePromptImprover.needsImprovement('Help me write something')).toBe(true)
    expect(OfflinePromptImprover.needsImprovement('Make it good')).toBe(true)
    
    expect(OfflinePromptImprover.needsImprovement(
      'Act as a senior developer. I need you to write a Python function that calculates fibonacci numbers with memoization.'
    )).toBe(false)
  })

  test('getSuggestions provides helpful feedback', () => {
    const suggestions = OfflinePromptImprover.getSuggestions('Help me with stuff')
    
    expect(Array.isArray(suggestions)).toBe(true)
    expect(suggestions.length).toBeGreaterThan(0)
    expect(suggestions.some(s => s.includes('specific'))).toBe(true)
  })

  test('handles edge cases gracefully', () => {
    expect(() => OfflinePromptImprover.improvePrompt('')).not.toThrow()
    expect(() => OfflinePromptImprover.improvePrompt('   ')).not.toThrow()
    expect(() => OfflinePromptImprover.quickImprove('')).not.toThrow()
    expect(() => OfflinePromptImprover.needsImprovement('')).not.toThrow()
  })

  test('calculates confidence appropriately', () => {
    const poorPrompt = OfflinePromptImprover.improvePrompt('Help')
    const okPrompt = OfflinePromptImprover.improvePrompt('Write a Python function to sort a list')
    const goodPrompt = OfflinePromptImprover.improvePrompt(
      'Act as a senior developer. Write a Python function to sort a list using merge sort algorithm. Include type hints, error handling, and docstring with examples.'
    )
    
    expect(poorPrompt.confidence).toBeGreaterThan(okPrompt.confidence)
    expect(okPrompt.confidence).toBeGreaterThan(goodPrompt.confidence)
  })

  test('preserves good prompts', () => {
    const goodPrompt = 'Act as a senior software engineer. I need you to write a Python function that implements a binary search algorithm. The function should accept a sorted list and a target value, return the index if found or -1 if not found. Include type hints, proper error handling, and comprehensive docstring with usage examples. Please also explain the time complexity.'
    
    const result = OfflinePromptImprover.improvePrompt(goodPrompt)
    
    // Should have minimal changes for already good prompts
    const totalImprovements = Object.values(result.improvements)
      .reduce((sum, arr) => sum + arr.length, 0)
    
    expect(totalImprovements).toBeLessThan(2)
    expect(result.confidence).toBeLessThan(0.5) // Low confidence in need for improvement
  })
})