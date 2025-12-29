// Re-export from the comprehensive error handler
export {
  createAPIError,
  handleAPIError,
  isAPIError,
  getUserFriendlyErrorMessage,
  logError,
  retryWithBackoff,
  createValidationError,
  createValidationAPIError
} from './error-handler';