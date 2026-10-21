export class HttpError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export const badRequest = (message = "Neplatná požiadavka", code = "bad_request", extra) =>
  new HttpError(400, code, message, extra);
export const unauthorized = (message = "Musíte sa prihlásiť", code = "unauthorized") =>
  new HttpError(401, code, message);
export const forbidden = (message = "Na túto akciu nemáte oprávnenie", code = "forbidden") =>
  new HttpError(403, code, message);
export const notFound = (message = "Nenájdené", code = "not_found") =>
  new HttpError(404, code, message);
export const conflict = (message = "Konflikt", code = "conflict") =>
  new HttpError(409, code, message);
