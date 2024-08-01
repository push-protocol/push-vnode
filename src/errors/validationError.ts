import { HttpStatus } from './apiConstants'

class ValidationError extends Error {
  status: HttpStatus
  errorCode: string
  details: string

  constructor(status: HttpStatus, errorCode: string, message: string, details: string) {
    super(message)
    this.name = 'ValidationError'
    this.status = status
    this.errorCode = errorCode
    this.details = details
  }

  format() {
    return {
      status: this.status,
      errorCode: this.errorCode,
      message: this.message,
      details: this.details,
      timestamp: new Date().toISOString()
    }
  }
}

export { ValidationError }
