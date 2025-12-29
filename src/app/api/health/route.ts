import { NextRequest, NextResponse } from 'next/server';
import { checkSystemHealth, getSystemMetrics } from '@/lib/infrastructure/monitoring';
import { validateConfiguration } from '@/lib/infrastructure/config';

// Enhanced health check endpoint with comprehensive system monitoring
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const detailed = searchParams.get('detailed') === 'true';
    const includeMetrics = searchParams.get('metrics') === 'true';
    
    // Basic health check
    const systemHealth = await checkSystemHealth();
    
    // Configuration validation
    const configValidation = validateConfiguration();
    
    const response: any = {
      status: systemHealth.overall,
      timestamp: systemHealth.timestamp,
      uptime: systemHealth.uptime,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      configValid: configValidation.valid,
    };
    
    // Add detailed service information if requested
    if (detailed) {
      response.services = systemHealth.services;
      response.configIssues = {
        missing: configValidation.missing,
        warnings: configValidation.warnings,
      };
    }
    
    // Add system metrics if requested
    if (includeMetrics) {
      const metrics = await getSystemMetrics();
      response.metrics = metrics;
    }
    
    // Determine HTTP status code based on health
    let statusCode = 200;
    if (systemHealth.overall === 'degraded') {
      statusCode = 207; // Multi-Status
    } else if (systemHealth.overall === 'unhealthy') {
      statusCode = 503; // Service Unavailable
    }
    
    return NextResponse.json(response, { 
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Check': 'true',
        'X-System-Status': systemHealth.overall,
      },
    });
    
  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: 'Health check failed',
        timestamp: Date.now(),
        environment: process.env.NODE_ENV || 'development',
      },
      { 
        status: 503,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Health-Check': 'true',
          'X-System-Status': 'unhealthy',
        },
      }
    );
  }
}

// Readiness probe endpoint (for Kubernetes/container orchestration)
export async function HEAD(request: NextRequest) {
  try {
    const systemHealth = await checkSystemHealth();
    
    if (systemHealth.overall === 'unhealthy') {
      return new NextResponse(null, { status: 503 });
    }
    
    return new NextResponse(null, { 
      status: 200,
      headers: {
        'X-System-Status': systemHealth.overall,
      },
    });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}