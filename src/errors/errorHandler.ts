// ErrorHandler.ts

class ErrorHandler {
  static generateGenericErrorResponse(errMessage: string) {
    return {
      status: 500,
      errorCode: '00000000000',
      message: errMessage,
      details: `An unexpected error occurred. Please contact support or try again later`,
      timestamp: new Date().toISOString()
    }
  }
}

export { ErrorHandler }
