// src/pages/api/test-square.ts
// Test endpoint to check Square integration
import type { APIRoute } from 'astro';
import { validateSquareConfig } from '../../utils/squareService';

export const GET: APIRoute = async ({ request }) => {
  try {
    console.log('Testing Square configuration...');

    // Test Square configuration
    const squareConfig = validateSquareConfig();
    
    console.log('Square config validation result:', squareConfig);

    return new Response(JSON.stringify({
      success: true,
      squareConfigValid: squareConfig.isValid,
      missingConfig: squareConfig.missing,
      message: squareConfig.isValid 
        ? 'Square configuration is valid' 
        : 'Square configuration is missing some values'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Square test error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
