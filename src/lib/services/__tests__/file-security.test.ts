import { fileSecurityService, FileSecurityService } from '../file-security';
import { TextEncoder } from 'util';

// Mock file creation helper with proper arrayBuffer method
function createMockFile(
  name: string,
  type: string,
  content: Uint8Array,
  size?: number
): File {
  const actualSize = size || content.length;
  const blob = new Blob([content], { type });
  
  // Create a File object with the specified properties
  const file = new File([blob], name, { type });
  
  // Override size property if needed
  Object.defineProperty(file, 'size', {
    value: actualSize,
    writable: false,
  });

  // Mock arrayBuffer method
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength),
    writable: false,
  });
  
  return file;
}

describe('FileSecurityService', () => {
  let service: FileSecurityService;

  beforeEach(() => {
    service = FileSecurityService.getInstance();
  });

  describe('validateFile', () => {
    it('should validate a clean PDF file', async () => {
      // Create a mock PDF file with proper PDF header
      const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]); // %PDF-1.4
      const mockPdfFile = createMockFile('test.pdf', 'application/pdf', pdfHeader, 1024);

      const result = await service.validateFile(mockPdfFile, {
        performVirusScan: false, // Skip virus scan for unit test
      });

      expect(result.isSecure).toBe(true);
      expect(result.details?.contentValidated).toBe(true);
      expect(result.details?.actualMimeType).toBe('application/pdf');
    });

    it('should reject file with wrong MIME type', async () => {
      const textContent = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]); // "Hello"
      const mockFile = createMockFile('test.txt', 'application/pdf', textContent);

      const result = await service.validateFile(mockFile, {
        performVirusScan: false,
      });

      expect(result.isSecure).toBe(false);
      expect(result.threats).toContain('File content does not match declared type application/pdf');
    });

    it('should reject oversized files', async () => {
      const smallContent = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
      const mockFile = createMockFile('large.pdf', 'application/pdf', smallContent, 50 * 1024 * 1024); // 50MB

      const result = await service.validateFile(mockFile, {
        maxSize: 10 * 1024 * 1024, // 10MB limit
        performVirusScan: false,
      });

      expect(result.isSecure).toBe(false);
      expect(result.threats?.[0]).toContain('File size');
      expect(result.threats?.[0]).toContain('exceeds maximum allowed size');
    });

    it('should reject files with suspicious extensions', async () => {
      const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
      const mockFile = createMockFile('malicious.pdf.exe', 'application/pdf', pdfContent);

      const result = await service.validateFile(mockFile, {
        performVirusScan: false,
      });

      expect(result.isSecure).toBe(false);
      expect(result.threats).toContain('Suspicious file extension detected: .exe');
    });

    it('should detect path traversal attempts', async () => {
      const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
      const mockFile = createMockFile('../../../etc/passwd.pdf', 'application/pdf', pdfContent);

      const result = await service.validateFile(mockFile, {
        performVirusScan: false,
      });

      expect(result.isSecure).toBe(false);
      // Should detect path traversal, even if other threats are also detected
      expect(result.threats).toEqual(
        expect.arrayContaining(['Path traversal attempt detected in filename'])
      );
    });

    it('should detect JavaScript in PDF content', async () => {
      // Create PDF content with JavaScript
      const pdfWithJs = new TextEncoder().encode('%PDF-1.4\n/JavaScript (alert("xss"))');
      const mockFile = createMockFile('malicious.pdf', 'application/pdf', pdfWithJs);

      const result = await service.validateFile(mockFile, {
        performVirusScan: false,
      });

      expect(result.isSecure).toBe(false);
      expect(result.threats).toContain('PDF contains JavaScript - potential security risk');
    });

    it('should detect embedded files in PDF', async () => {
      const pdfWithEmbedded = new TextEncoder().encode('%PDF-1.4\n/EmbeddedFile');
      const mockFile = createMockFile('embedded.pdf', 'application/pdf', pdfWithEmbedded);

      const result = await service.validateFile(mockFile, {
        performVirusScan: false,
      });

      expect(result.isSecure).toBe(false);
      expect(result.threats).toContain('PDF contains embedded files - potential security risk');
    });

    it('should perform virus scanning when enabled', async () => {
      const cleanPdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]);
      const mockFile = createMockFile('clean.pdf', 'application/pdf', cleanPdfContent);

      const result = await service.validateFile(mockFile, {
        performVirusScan: true,
      });

      expect(result.scanId).toBeDefined();
      expect(result.details?.virusScanPassed).toBe(true);
    });

    it('should detect malicious patterns during virus scan', async () => {
      // Create content with malicious pattern (PE executable header)
      const maliciousContent = new Uint8Array([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00]);
      const mockFile = createMockFile('malware.pdf', 'application/pdf', maliciousContent);

      const result = await service.validateFile(mockFile, {
        performVirusScan: true,
        validateContent: false, // Skip content validation to focus on virus scan
      });

      expect(result.isSecure).toBe(false);
      expect(result.threats).toContain('Suspicious executable or script content detected');
      expect(result.scanId).toBeDefined();
    });
  });

  describe('generateSecurityReport', () => {
    it('should generate comprehensive security report', async () => {
      const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]);
      const mockFile = createMockFile('report.pdf', 'application/pdf', pdfContent, 2048);

      const report = await service.generateSecurityReport(mockFile);

      expect(report.filename).toBe('report.pdf');
      expect(report.size).toBe(2048);
      expect(report.type).toBe('application/pdf');
      expect(report.securityScore).toBeGreaterThan(0);
      expect(report.securityScore).toBeLessThanOrEqual(100);
      expect(report.recommendations).toBeDefined();
      expect(report.validationResult).toBeDefined();
    });

    it('should penalize security score for large files', async () => {
      const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
      const largeFile = createMockFile('large.pdf', 'application/pdf', pdfContent, 10 * 1024 * 1024); // 10MB

      const report = await service.generateSecurityReport(largeFile);

      expect(report.securityScore).toBeLessThan(100);
      expect(report.recommendations).toContain('Consider reducing file size for better performance');
    });

    it('should penalize security score for security threats', async () => {
      const maliciousContent = new Uint8Array([0x4D, 0x5A, 0x90, 0x00]); // PE header
      const maliciousFile = createMockFile('malware.pdf', 'application/pdf', maliciousContent);

      const report = await service.generateSecurityReport(maliciousFile);

      expect(report.securityScore).toBeLessThan(50);
      expect(report.recommendations).toContain('File failed security validation');
      expect(report.recommendations).toContain('Address identified security threats');
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = FileSecurityService.getInstance();
      const instance2 = FileSecurityService.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBe(fileSecurityService);
    });
  });
});