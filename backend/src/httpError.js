/** An error that carries an HTTP status; the error middleware turns it into a JSON response. */
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.details = details
  }
}

export const badRequest = (message, details) => new HttpError(400, message, details)
export const notFound = (message = 'Not found') => new HttpError(404, message)
