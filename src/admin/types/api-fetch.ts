export type ApiFetchRequest = {
  url: string;
  method?: string;
  data?: Record<string, unknown>;
};

export type ApiFetch = <T = unknown>(args: ApiFetchRequest) => Promise<T>;
