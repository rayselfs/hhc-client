import { describe, it, expect } from 'vitest'
import axios from 'axios'
import { http } from '../http'

// Get the transformer function for testing
const getTransformer = () => {
  const transformers = http.defaults.transformResponse as unknown as ((data: string) => unknown)[]
  return transformers[0]
}

describe('http', () => {
  it('is an axios instance', () => {
    expect(axios.isAxiosError).toBeDefined()
    expect(http).toBeDefined()
    expect(http.get).toBeDefined()
    expect(http.post).toBeDefined()
    expect(http.defaults).toBeDefined()
  })

  it('has 30 second timeout', () => {
    expect(http.defaults.timeout).toBe(30_000)
  })

  describe('transformResponse', () => {
    it('parses JSON string to object', () => {
      const transformer = getTransformer()
      const data = '{"key": "value"}'
      const result = transformer(data)

      expect(result).toEqual({ key: 'value' })
    })

    it('converts snake_case keys to camelCase', () => {
      const transformer = getTransformer()
      const data = '{"first_name": "John", "last_name": "Doe"}'
      const result = transformer(data)

      expect(result).toEqual({ firstName: 'John', lastName: 'Doe' })
    })

    it('converts nested snake_case keys to camelCase with deep:true', () => {
      const transformer = getTransformer()
      const data = '{"user_info": {"first_name": "Jane", "last_address": {"zip_code": "12345"}}}'
      const result = transformer(data)

      expect(result).toEqual({
        userInfo: { firstName: 'Jane', lastAddress: { zipCode: '12345' } }
      })
    })

    it('handles arrays with objects inside', () => {
      const transformer = getTransformer()
      const data = '[{"user_id": 1}, {"user_id": 2}]'
      const result = transformer(data)

      expect(result).toEqual([{ userId: 1 }, { userId: 2 }])
    })

    it('handles empty object', () => {
      const transformer = getTransformer()
      const data = '{}'
      const result = transformer(data)

      expect(result).toEqual({})
    })

    it('handles empty array', () => {
      const transformer = getTransformer()
      const data = '[]'
      const result = transformer(data)

      expect(result).toEqual([])
    })

    it('preserves numeric and boolean values', () => {
      const transformer = getTransformer()
      const data = '{"count": 42, "is_active": true, "balance": 99.99}'
      const result = transformer(data)

      expect(result).toEqual({ count: 42, isActive: true, balance: 99.99 })
    })

    it('preserves null values', () => {
      const transformer = getTransformer()
      const data = '{"value": null}'
      const result = transformer(data)

      expect(result).toEqual({ value: null })
    })
  })
})
