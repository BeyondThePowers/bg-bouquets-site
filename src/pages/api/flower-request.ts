// src/pages/api/flower-request.ts
import type { APIRoute } from 'astro';
import { sendContactFormMessage, logWebhookAttempt } from '../../services/webhook';
import { v4 as uuidv4 } from 'uuid';

// Simple in-memory rate limiting (shared with contact form)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 5; // 5 requests per 15 minutes per IP

/**
 * Simple rate limiting function
 */
function checkRateLimit(clientIP: string): { allowed: boolean; resetTime?: number } {
  const now = Date.now();
  const key = clientIP;
  
  // Clean up expired entries
  for (const [ip, data] of rateLimitMap.entries()) {
    if (now > data.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
  
  const existing = rateLimitMap.get(key);
  
  if (!existing) {
    // First request from this IP
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true };
  }
  
  if (now > existing.resetTime) {
    // Window has expired, reset
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true };
  }
  
  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    // Rate limit exceeded
    return { allowed: false, resetTime: existing.resetTime };
  }
  
  // Increment count
  existing.count++;
  return { allowed: true };
}

/**
 * Get client IP address from request
 */
function getClientIP(request: Request): string {
  // Check various headers for the real IP
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }
  
  if (realIP) return realIP;
  if (cfConnectingIP) return cfConnectingIP;
  
  // Fallback to a default if we can't determine the IP
  return 'unknown';
}

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('Flower request API called');
    console.log('Request headers:', Object.fromEntries(request.headers.entries()));

    // Get client IP for rate limiting
    const clientIP = getClientIP(request);
    console.log('Client IP:', clientIP);

    // Check rate limit
    const rateLimitResult = checkRateLimit(clientIP);
    if (!rateLimitResult.allowed) {
      const resetTime = rateLimitResult.resetTime || Date.now();
      const minutesUntilReset = Math.ceil((resetTime - Date.now()) / (60 * 1000));
      
      console.log(`Rate limit exceeded for IP: ${clientIP}`);
      return new Response(JSON.stringify({
        error: 'Too many requests. Please try again later.',
        retryAfter: minutesUntilReset
      }), {
        status: 429,
        headers: { 
          'Content-Type': 'application/json',
          'Retry-After': minutesUntilReset.toString()
        }
      });
    }

    // Parse request body
    let body;
    try {
      const rawBody = await request.text();
      console.log('Raw request body:', rawBody);

      if (!rawBody || rawBody.trim() === '') {
        throw new Error('Empty request body');
      }

      body = JSON.parse(rawBody);
      console.log('Parsed request body:', body);
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      return new Response(JSON.stringify({
        error: 'Invalid JSON in request body',
        details: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { flower, email, notes, name } = body;

    console.log('Extracted fields:', { flower, email, notes, name });

    // Basic server-side validation
    if (!flower || !email) {
      console.log('Validation failed - missing required fields');
      return new Response(JSON.stringify({
        error: 'Flower name and email are required fields.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid email format.' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate field lengths
    if (flower.length > 100) {
      return new Response(JSON.stringify({
        error: 'Flower name must be less than 100 characters.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (email.length > 255) {
      return new Response(JSON.stringify({
        error: 'Email must be less than 255 characters.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (name && name.length > 100) {
      return new Response(JSON.stringify({
        error: 'Name must be less than 100 characters.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (notes && notes.length > 1000) {
      return new Response(JSON.stringify({
        error: 'Notes must be less than 1000 characters.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Basic spam detection (simple keyword check)
    const spamKeywords = ['viagra', 'casino', 'lottery', 'winner', 'congratulations', 'click here', 'free money'];
    const messageText = `${flower} ${email} ${notes || ''}`.toLowerCase();
    const containsSpam = spamKeywords.some(keyword => messageText.includes(keyword));
    
    if (containsSpam) {
      console.log('Potential spam detected:', { flower, email, notes });
      return new Response(JSON.stringify({ 
        error: 'Request appears to contain spam content.' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create flower request data
    const requestId = uuidv4();
    const flowerRequestData = {
      id: requestId,
      type: 'flower_request' as const,
      name: name ? name.trim() : email.split('@')[0], // Use provided name or extract from email as fallback
      email: email.trim().toLowerCase(),
      message: `Flower request for: ${flower.trim()}${notes ? ` - ${notes.trim()}` : ''}`,
      subject: `Flower Request: ${flower.trim()}`,
      flower: flower.trim(),
      notes: notes ? notes.trim() : undefined,
      createdAt: new Date().toISOString()
    };

    console.log('Flower request data prepared:', flowerRequestData);

    // Send webhook with retry logic (async, don't block response)
    console.log('Sending flower request webhook');
    sendContactFormMessage(flowerRequestData).then(success => {
      if (success) {
        console.log('✅ Flower request webhook sent successfully');
      } else {
        console.error('❌ Failed to send flower request webhook');
      }
    }).catch(error => {
      console.error('Flower request webhook sending failed:', error);
    });

    // Return success response immediately
    console.log('Flower request submission successful');
    return new Response(JSON.stringify({
      success: true,
      message: `Thank you for your flower request! We'll get back to you about "${flower}" availability.`,
      requestId: flowerRequestData.id
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Flower request API error:', error);
    
    return new Response(JSON.stringify({
      error: 'An unexpected error occurred. Please try again later.',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Handle GET requests with API info
export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({
    message: 'Flower request API endpoint',
    method: 'POST',
    fields: {
      required: ['flower', 'email'],
      optional: ['name', 'notes']
    },
    limits: {
      flower: '100 characters',
      email: '255 characters',
      name: '100 characters',
      notes: '1000 characters'
    },
    rateLimit: {
      requests: RATE_LIMIT_MAX_REQUESTS,
      window: `${RATE_LIMIT_WINDOW / (60 * 1000)} minutes`
    }
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
