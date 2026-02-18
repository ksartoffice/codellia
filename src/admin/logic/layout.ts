export type LayoutMode = 'default' | 'standalone' | 'frame' | 'theme';
export type DefaultLayoutMode = 'standalone' | 'frame' | 'theme';

export function resolveLayout(value?: string): LayoutMode {
  if (value === 'standalone' || value === 'frame' || value === 'theme' || value === 'default') {
    return value;
  }
  return 'default';
}

export function resolveDefaultLayout(value?: string): DefaultLayoutMode {
  if (value === 'standalone' || value === 'frame' || value === 'theme') {
    return value;
  }
  return 'theme';
}
