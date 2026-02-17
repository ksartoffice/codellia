import { describe, expect, it } from 'vitest';
import { resolveDefaultLayout, resolveLayout } from './layout';

describe('layout domain', () => {
  it('resolves valid layout values', () => {
    expect(resolveLayout('default')).toBe('default');
    expect(resolveLayout('standalone')).toBe('standalone');
    expect(resolveLayout('frame')).toBe('frame');
    expect(resolveLayout('theme')).toBe('theme');
  });

  it('falls back to default layout for invalid values', () => {
    expect(resolveLayout('')).toBe('default');
    expect(resolveLayout('unknown')).toBe('default');
    expect(resolveLayout(undefined)).toBe('default');
  });

  it('resolves valid default layout values', () => {
    expect(resolveDefaultLayout('standalone')).toBe('standalone');
    expect(resolveDefaultLayout('frame')).toBe('frame');
    expect(resolveDefaultLayout('theme')).toBe('theme');
  });

  it('falls back to theme for invalid default layout values', () => {
    expect(resolveDefaultLayout('')).toBe('theme');
    expect(resolveDefaultLayout('default')).toBe('theme');
    expect(resolveDefaultLayout(undefined)).toBe('theme');
  });
});
