export interface ApiError {
  success: false;
  message: string;
  code: string;
  errors?: Record<string, string[]>;
}

export interface ApiSuccess {
  success: true;
  message: string;
}

export interface ApiSuccessWithData<T> {
  success: true;
  message: string;
  data: T;
}

export type ApiResponse<T> = ApiSuccessWithData<T> | ApiError;

export type ApiMessageResponse = ApiSuccess | ApiError;
