import { describe, it, expect } from 'vitest';
import { extractHunkHeaders } from '../src/modules/reviews/intent-classifier.js';

/**
 * Unit coverage for extractHunkHeaders.
 *
 * Key invariant: only lines that start with @@ are returned.
 * All diff metadata, context, added (+), and removed (-) lines are discarded.
 * The function is pure — no side effects, no async.
 */
describe('extractHunkHeaders', () => {
  const PATCH = [
    'diff --git a/src/foo.ts b/src/foo.ts',
    'index abc123..def456 100644',
    '--- a/src/foo.ts',
    '+++ b/src/foo.ts',
    '@@ -10,6 +10,8 @@ export function foo() {',
    ' context line',
    '-removed line',
    '+added line',
    ' another context',
    '@@ -30,4 +32,6 @@ export function bar() {',
    '+new line in bar',
  ].join('\n');

  it('returns only lines starting with @@', () => {
    expect(extractHunkHeaders(PATCH)).toEqual([
      '@@ -10,6 +10,8 @@ export function foo() {',
      '@@ -30,4 +32,6 @@ export function bar() {',
    ]);
  });

  it('discards diff --git lines', () => {
    const result = extractHunkHeaders(PATCH);
    expect(result.every((l) => l.startsWith('@@'))).toBe(true);
  });

  it('discards --- and +++ header lines', () => {
    const patch = '--- a/old.ts\n+++ b/new.ts\n@@ -1,3 +1,4 @@ class Foo {}';
    expect(extractHunkHeaders(patch)).toEqual(['@@ -1,3 +1,4 @@ class Foo {}']);
  });

  it('discards context, added, and removed lines', () => {
    const patch = ' context\n-removed\n+added\n@@ -5,2 +5,3 @@ fn()';
    expect(extractHunkHeaders(patch)).toEqual(['@@ -5,2 +5,3 @@ fn()']);
  });

  it('discards index lines', () => {
    const patch = 'index abc..def 100644\n@@ -1,1 +1,1 @@';
    expect(extractHunkHeaders(patch)).toEqual(['@@ -1,1 +1,1 @@']);
  });

  it('returns empty array for null', () => {
    expect(extractHunkHeaders(null)).toEqual([]);
  });

  it('returns empty array for undefined', () => {
    expect(extractHunkHeaders(undefined)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(extractHunkHeaders('')).toEqual([]);
  });

  it('returns empty array for a patch with no @@ lines', () => {
    const patch = 'diff --git a/file.ts b/file.ts\n--- a/file.ts\n+++ b/file.ts\n+added only';
    expect(extractHunkHeaders(patch)).toEqual([]);
  });

  it('handles a single-hunk patch correctly', () => {
    const patch = '@@ -1,3 +1,5 @@ function main() {';
    expect(extractHunkHeaders(patch)).toEqual(['@@ -1,3 +1,5 @@ function main() {']);
  });

  it('preserves the full @@ line including optional context label', () => {
    const line = '@@ -42,7 +42,9 @@ export class ReviewService {';
    expect(extractHunkHeaders(line)).toEqual([line]);
  });
});
