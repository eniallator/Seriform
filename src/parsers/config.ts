export interface Config {
  label?: string;
  title?: string;
  attrs?: Record<string, string | number | null>;
}

export interface ValueConfig<T> extends Config {
  default?: T;
}
