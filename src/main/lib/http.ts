import axios from 'axios'
import _camelcaseKeys from 'camelcase-keys'

const camelcaseKeys =
  (_camelcaseKeys as unknown as { default: typeof _camelcaseKeys }).default ?? _camelcaseKeys

export const http = axios.create({
  timeout: 10_000,
  transformResponse: [
    (data) => {
      const parsed = JSON.parse(data)
      return camelcaseKeys(parsed, { deep: true })
    }
  ]
})
