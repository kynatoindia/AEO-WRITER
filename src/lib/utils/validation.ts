/**
 * Validate if a string is a valid URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate if a file is a PDF
 */
export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf';
}

/**
 * Validate file size
 */
export function isValidFileSize(file: File, maxSizeInBytes: number): boolean {
  return file.size <= maxSizeInBytes;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitize HTML content
 */
export function sanitizeHtml(html: string): string {
  // Basic HTML sanitization - remove script tags and dangerous attributes
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/g, '')
    .replace(/javascript:/gi, '');
}

/**
 * Validate and clean competitor URLs
 */
export function validateCompetitorUrls(urls: string[]): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];

  urls.forEach(url => {
    const trimmedUrl = url.trim();
    if (trimmedUrl && isValidUrl(trimmedUrl)) {
      valid.push(trimmedUrl);
    } else if (trimmedUrl) {
      invalid.push(trimmedUrl);
    }
  });

  return { valid, invalid };
}

/**
 * Check if a string contains only alphanumeric characters and common punctuation
 */
export function isSafeText(text: string): boolean {
  const safeTextRegex = /^[a-zA-Z0-9\s.,!?;:'"()\-_@#$%&*+=<>{}[\]|\\\/~`]+$/;
  return safeTextRegex.test(text);
}

/**
 * Validate project topic
 */
export function validateProjectTopic(topic: string): { isValid: boolean; error?: string } {
  if (!topic || topic.trim().length === 0) {
    return { isValid: false, error: 'Topic is required' };
  }

  if (topic.length < 3) {
    return { isValid: false, error: 'Topic must be at least 3 characters long' };
  }

  if (topic.length > 200) {
    return { isValid: false, error: 'Topic must be less than 200 characters' };
  }

  if (!isSafeText(topic)) {
    return { isValid: false, error: 'Topic contains invalid characters' };
  }

  return { isValid: true };
}