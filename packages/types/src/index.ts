export type EntityId = string;

export interface ApiSuccess<TData> {
  readonly ok: true;
  readonly data: TData;
}

export interface ApiFailure<TCode extends string = string> {
  readonly ok: false;
  readonly error: {
    readonly code: TCode;
    readonly message: string;
    readonly fieldErrors?: Record<string, readonly string[]>;
  };
}

export type ApiResult<TData, TCode extends string = string> =
  | ApiSuccess<TData>
  | ApiFailure<TCode>;
