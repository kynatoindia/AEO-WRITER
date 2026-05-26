import { INFRASTRUCTURE_CONFIG } from '@/lib/infrastructure/config';

export interface FileSecurityResult {
  isSecure: boolean;
  threats?: string[];
  scanId?: string;
  timestamp: string;
  details?: {
    fileType?: string;
    actualMimeType?: string;
    size?: number;
    virusScanPassed?: boolean;
    contentValidated?: boolean;
  };
}

export interface FileValidationOptions {
  allowedTypes?: string[];
  maxSize?: number;
  performVirusScan?: boolean;
  validateContent?: boolean;
}

/**
 * Comprehensive file security service for upload validation
 */
export class FileSecurityService {
  private static instance: FileSecurityService;
  
  public static getInstance(): FileSecurityService {
    if (!FileSecurityService.instance) {
      FileSecurityService.instance = new FileSecurityService();
    }
    return FileSecurityService.instance;
  }

  /**
   * Perform comprehensive security validation on uploaded file
   */
  async validateFile(
    file: File, 
    options: FileValidationOptions = {}
  ): Promise<FileSecurityResult> {
    const {
      allowedTypes = INFRASTRUCTURE_CONFIG.security.fileUpload.allowedTypes,
      maxSize = INFRASTRUCTURE_CONFIG.security.fileUpload.maxSize,
      performVirusScan = INFRASTRUCTURE_CONFIG.security.fileUpload.virusScanning,
      validateContent = true,
    } = options;

    const result: FileSecurityResult = {
      isSecure: false,
      timestamp: new Date().toISOString(),
      details: {
        size: file.size,
      },
    };

    try {
      // 1. Basic file metadata validation
      const metadataValidation = this.validateFileMetadata(file, allowedTypes as string[], maxSize);
      if (!metadataValidation.isValid) {
        return {
          ...result,
          threats: metadataValidation.threats,
          details: {
            ...result.details,
            fileType: file.type,
          },
        };
      }

      // 2. Content validation (magic number check)
      if (validateContent) {
        const contentValidation = await this.validateFileContent(file);
        if (!contentValidation.isValid) {
          return {
            ...result,
            threats: contentValidation.threats,
            details: {
              ...result.details,
              fileType: file.type,
              actualMimeType: contentValidation.actualMimeType,
              contentValidated: false,
            },
          };
        }
        result.details!.actualMimeType = contentValidation.actualMimeType;
        result.details!.contentValidated = true;
      }

      // 3. Virus scanning
      if (performVirusScan) {
        const virusScanResult = await this.performVirusScan(file);
        if (!virusScanResult.isClean) {
          return {
            ...result,
            threats: virusScanResult.threats,
            scanId: virusScanResult.scanId,
            details: {
              ...result.details,
              virusScanPassed: false,
            },
          };
        }
        result.scanId = virusScanResult.scanId;
        result.details!.virusScanPassed = true;
      }

      // 4. Additional security checks
      const securityChecks = await this.performSecurityChecks(file);
      if (!securityChecks.isSecure) {
        return {
          ...result,
          threats: securityChecks.threats,
        };
      }

      // All checks passed
      return {
        ...result,
        isSecure: true,
      };

    } catch (error: any) {
      console.error('File security validation error:', error);
      return {
        ...result,
        threats: [`Security validation failed: ${error.message}`],
      };
    }
  }

  /**
   * Validate file metadata (name, type, size)
   */
  private validateFileMetadata(
    file: File, 
    allowedTypes: string[], 
    maxSize: number
  ): { isValid: boolean; threats?: string[] } {
    const threats: string[] = [];

    // Check file size
    if (file.size > maxSize) {
      threats.push(`File size ${file.size} exceeds maximum allowed size ${maxSize}`);
    }

    if (file.size === 0) {
      threats.push('File is empty');
    }

    // Check MIME type
    if (!allowedTypes.includes(file.type)) {
      threats.push(`File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`);
    }

    // Check file name for suspicious patterns
    const suspiciousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.js', '.vbs', '.jar'];
    const fileName = file.name.toLowerCase();
    
    for (const ext of suspiciousExtensions) {
      if (fileName.endsWith(ext)) {
        threats.push(`Suspicious file extension detected: ${ext}`);
      }
    }

    // Check for double extensions (e.g., file.pdf.exe)
    const extensionCount = (fileName.match(/\./g) || []).length;
    if (extensionCount > 1) {
      const parts = fileName.split('.');
      // Only flag if there are suspicious combinations
      if (parts.length > 2) {
        const lastExt = parts[parts.length - 1];
        const secondLastExt = parts[parts.length - 2];
        if (suspiciousExtensions.some(ext => ext.includes(lastExt) || ext.includes(secondLastExt))) {
          threats.push('Multiple file extensions detected - potential security risk');
        }
      }
    }

    return {
      isValid: threats.length === 0,
      threats: threats.length > 0 ? threats : undefined,
    };
  }

  /**
   * Validate file content using magic numbers
   */
  private async validateFileContent(file: File): Promise<{
    isValid: boolean;
    actualMimeType?: string;
    threats?: string[];
  }> {
    try {
      const buffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);
      
      // Magic number signatures for common file types
      const signatures = {
        'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
        'text/plain': null, // No specific signature
        'text/markdown': null, // No specific signature
        'image/jpeg': [0xFF, 0xD8, 0xFF],
        'image/png': [0x89, 0x50, 0x4E, 0x47],
        'application/zip': [0x50, 0x4B, 0x03, 0x04],
      };

      // Check if file content matches declared MIME type
      const expectedSignature = signatures[file.type as keyof typeof signatures];
      
      if (expectedSignature) {
        const actualSignature = uint8Array.slice(0, expectedSignature.length);
        const matches = expectedSignature.every((byte, index) => actualSignature[index] === byte);
        
        if (!matches) {
          return {
            isValid: false,
            threats: [`File content does not match declared type ${file.type}`],
          };
        }
      }

      // Check for embedded executables or scripts in PDFs
      if (file.type === 'application/pdf') {
        let pdfContent: string;
        try {
          // Use TextDecoder if available, otherwise fallback
          if (typeof TextDecoder !== 'undefined') {
            pdfContent = new TextDecoder().decode(uint8Array);
          } else {
            // Fallback for test environments
            pdfContent = String.fromCharCode(...uint8Array);
          }
        } catch {
          // If decoding fails, skip content analysis
          return { isValid: true, actualMimeType: file.type };
        }
        
        // Check for JavaScript in PDF
        if (pdfContent.includes('/JavaScript') || pdfContent.includes('/JS')) {
          return {
            isValid: false,
            threats: ['PDF contains JavaScript - potential security risk'],
          };
        }

        // Check for embedded files
        if (pdfContent.includes('/EmbeddedFile')) {
          return {
            isValid: false,
            threats: ['PDF contains embedded files - potential security risk'],
          };
        }
      }

      return {
        isValid: true,
        actualMimeType: file.type,
      };

    } catch (error: any) {
      return {
        isValid: false,
        threats: [`Content validation failed: ${error.message}`],
      };
    }
  }

  /**
   * Perform virus scanning (mock implementation)
   */
  private async performVirusScan(file: File): Promise<{
    isClean: boolean;
    threats?: string[];
    scanId?: string;
  }> {
    // In production, integrate with actual virus scanning services:
    // - ClamAV
    // - VirusTotal API
    // - AWS GuardDuty Malware Protection
    // - Microsoft Defender for Cloud
    
    const scanId = `scan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const buffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);
      
      // Simulate virus scanning with pattern detection
      const maliciousPatterns = [
        // Common malware signatures (simplified)
        new Uint8Array([0x4D, 0x5A, 0x90, 0x00]), // PE executable header
        new Uint8Array([0x7F, 0x45, 0x4C, 0x46]), // ELF executable
        new Uint8Array([0xCA, 0xFE, 0xBA, 0xBE]), // Java class file
        // Script patterns
        new Uint8Array([0x3C, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74]), // <script
        new Uint8Array([0x6A, 0x61, 0x76, 0x61, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74]), // javascript
      ];

      const threats: string[] = [];

      for (const pattern of maliciousPatterns) {
        for (let i = 0; i <= uint8Array.length - pattern.length; i++) {
          let match = true;
          for (let j = 0; j < pattern.length; j++) {
            if (uint8Array[i + j] !== pattern[j]) {
              match = false;
              break;
            }
          }
          if (match) {
            threats.push('Suspicious executable or script content detected');
            break;
          }
        }
        if (threats.length > 0) break;
      }

      // Simulate scan delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      return {
        isClean: threats.length === 0,
        threats: threats.length > 0 ? threats : undefined,
        scanId,
      };

    } catch (error: any) {
      console.error('Virus scan error:', error);
      return {
        isClean: false,
        threats: [`Virus scan failed: ${error.message}`],
        scanId,
      };
    }
  }

  /**
   * Additional security checks
   */
  private async performSecurityChecks(file: File): Promise<{
    isSecure: boolean;
    threats?: string[];
  }> {
    const threats: string[] = [];

    try {
      // Check file name for path traversal attempts
      if (file.name.includes('../') || file.name.includes('..\\')) {
        threats.push('Path traversal attempt detected in filename');
      }

      // Check for null bytes in filename
      if (file.name.includes('\0')) {
        threats.push('Null byte detected in filename');
      }

      // Check for excessively long filename
      if (file.name.length > 255) {
        threats.push('Filename exceeds maximum length');
      }

      // Check for Unicode control characters
      const controlCharRegex = /[\u0000-\u001F\u007F-\u009F]/;
      if (controlCharRegex.test(file.name)) {
        threats.push('Control characters detected in filename');
      }

      return {
        isSecure: threats.length === 0,
        threats: threats.length > 0 ? threats : undefined,
      };

    } catch (error: any) {
      return {
        isSecure: false,
        threats: [`Security check failed: ${error.message}`],
      };
    }
  }

  /**
   * Generate security report for file
   */
  async generateSecurityReport(file: File): Promise<{
    filename: string;
    size: number;
    type: string;
    securityScore: number; // 0-100
    recommendations: string[];
    validationResult: FileSecurityResult;
  }> {
    const validationResult = await this.validateFile(file);
    
    let securityScore = 100;
    const recommendations: string[] = [];

    if (!validationResult.isSecure) {
      securityScore -= 50;
      recommendations.push('File failed security validation');
    }

    if (validationResult.threats && validationResult.threats.length > 0) {
      securityScore -= validationResult.threats.length * 10;
      recommendations.push('Address identified security threats');
    }

    if (file.size > 5 * 1024 * 1024) { // > 5MB
      securityScore -= 10;
      recommendations.push('Consider reducing file size for better performance');
    }

    return {
      filename: file.name,
      size: file.size,
      type: file.type,
      securityScore: Math.max(0, securityScore),
      recommendations,
      validationResult,
    };
  }
}

// Export singleton instance
export const fileSecurityService = FileSecurityService.getInstance();