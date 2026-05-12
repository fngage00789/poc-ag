import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// TODO: Replace these with your actual Supabase project URL and anon key!
const SUPABASE_URL = 'https://ywnwkosreinsshzsqeyu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_du1ZezpFXC_DuHf4a7gz4A_t_tyrLuE';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    try {
      this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    } catch (err) {
      console.warn('Supabase not configured properly:', err);
    }
  }

  async saveLayout(name: string, state: any) {
    if (!this.supabase) throw new Error('Supabase is not configured yet. Please update supabase.service.ts');
    const { data, error } = await this.supabase
      .from('layouts')
      .insert([{ name, state }]);
      
    if (error) throw error;
    return data;
  }

  async getLayouts() {
    if (!this.supabase) return [];
    
    const { data, error } = await this.supabase
      .from('layouts')
      .select('id, name, state')
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    return data;
  }
}
