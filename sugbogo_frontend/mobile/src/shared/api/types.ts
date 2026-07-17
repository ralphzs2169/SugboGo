export interface ApiError {
  success: false;
  message: string;
  code: string;
  errors?: Record<string, unknown>;
}

export interface ApiSuccess<T = void> {
  success: true;
  message: string;
  data?: T;
}

export interface ApiSuccessWithData<T> {
  success: true;
  message: string;
  data: T;
}

// This type represents the result of an API call, which can either be a success or an error.
export type ApiResult<T> = ApiSuccess<T> | ApiError;
