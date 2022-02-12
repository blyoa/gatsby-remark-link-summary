import ErrorWithCause from 'error-cause/Error'

export class ErrorWithCauseMessage extends ErrorWithCause {
  override toString(): string {
    if (this.cause) {
      return `${this.message}: ${this.cause}`
    }
    return this.message
  }
}
