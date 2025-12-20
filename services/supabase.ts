
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tzpiuksrwtpldyvlcaze.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6cGl1a3Nyd3RwbGR5dmxjYXplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNjMxNzYsImV4cCI6MjA4MTYzOTE3Nn0.BoJjiMYHkCKDT4DMEzICnr6U4iPl86m2alAUJBwKEEQ';

export const supabase = createClient(supabaseUrl, supabaseKey);
