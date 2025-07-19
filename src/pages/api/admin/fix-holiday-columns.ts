import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase-admin';
import fs from 'fs';
import path from 'path';

export const POST: APIRoute = async () => {
  try {
    console.log('🔧 Running holiday column fix migration...');
    
    // Read the migration file
    const migrationPath = path.resolve(process.cwd(), 'database/fix-holiday-column-references.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the SQL using Supabase
    const { error } = await supabaseAdmin.rpc('exec_sql', {
      sql_query: migrationSQL
    });
    
    if (error) {
      console.error('❌ Migration failed:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    console.log('✅ Holiday column fix migration completed successfully');
    
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Holiday column references fixed successfully' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ Error running migration:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Server error running migration' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};