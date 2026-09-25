// Vitest setup. Adds the jest-dom matchers and clears storage and fetch mocks between tests.
import '@testing-library/jest-dom/vitest'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})
