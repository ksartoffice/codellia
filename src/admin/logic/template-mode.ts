export type TemplateMode = 'default' | 'standalone' | 'frame' | 'theme';
export type DefaultTemplateMode = 'standalone' | 'frame' | 'theme';

export function resolveTemplateMode(value?: string): TemplateMode {
  if (value === 'standalone' || value === 'frame' || value === 'theme' || value === 'default') {
    return value;
  }
  return 'default';
}

export function resolveDefaultTemplateMode(value?: string): DefaultTemplateMode {
  if (value === 'standalone' || value === 'frame' || value === 'theme') {
    return value;
  }
  return 'theme';
}

