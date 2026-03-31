/**
 * Supabase client pointing to the external project
 * that has all the existing tables and data.
 */
import { createClient } from "@supabase/supabase-js";

export const SUPABASE_PROJECT_ID = "yvdfdmyusdhgtzfguxbj";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2ZGZkbXl1c2RoZ3R6Zmd1eGJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0OTg4MzksImV4cCI6MjA4OTA3NDgzOX0.-xSNbj5kLibkhJoXmOXjfmYPKBB-gqasQgy322Kk-n4";
export const SUPABASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co`;

export const supabase: any = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
