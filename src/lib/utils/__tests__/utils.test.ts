import { cn } from '@/lib/utils';

describe('Utils', () => {
  describe('cn function', () => {
    it('should merge class names correctly', () => {
      const result = cn('text-red-500', 'bg-blue-500');
      expect(result).toBe('text-red-500 bg-blue-500');
    });

    it('should handle conditional classes', () => {
      const result = cn('text-red-500', false && 'bg-blue-500', 'p-4');
      expect(result).toBe('text-red-500 p-4');
    });

    it('should merge conflicting Tailwind classes', () => {
      const result = cn('text-red-500', 'text-blue-500');
      expect(result).toBe('text-blue-500');
    });
  });
});