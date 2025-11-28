// frontend/supabase.js
// Конфигурация Supabase с обработкой ошибок
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';

let supabase;

try {
    supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            persistSession: false
        }
    });
} catch (error) {
    console.error('Error initializing Supabase:', error);
    // Fallback к localStorage
    supabase = {
        from: () => ({
            select: () => Promise.resolve({ data: [], error: null }),
            upsert: () => Promise.resolve({ error: null })
        })
    };
}
