// File: /lib/services/project-service.ts
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

export interface Project {
  id: string;
  name: string;
  description: string;
  scale: string;
  objective: string;
  timeline: string;
  additional_info?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface ProjectFormData {
  projectName: string;
  projectDescription: string;
  scale: string;
  objective: string;
  stakeholders: string[];
  timeline: string;
  additionalInfo?: string;
}

export class ProjectService {
  /**
   * Create a new project with stakeholders
   */
  static async createProject(formData: ProjectFormData, user: User) {
    try {
      // Start a transaction by setting up Supabase with RLS bypass
      // Insert project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: formData.projectName,
          description: formData.projectDescription,
          scale: formData.scale,
          objective: formData.objective,
          timeline: formData.timeline,
          additional_info: formData.additionalInfo || null,
          user_id: user.id
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // Get stakeholder IDs from the names
      const { data: stakeholderIds, error: stakeholderError } = await supabase
        .from('stakeholders')
        .select('id')
        .in('name', formData.stakeholders);

      if (stakeholderError) throw stakeholderError;

      // Insert project_stakeholders relations
      if (stakeholderIds && stakeholderIds.length > 0) {
        const projectStakeholderData = stakeholderIds.map(s => ({
          project_id: project.id,
          stakeholder_id: s.id
        }));

        const { error: relationError } = await supabase
          .from('project_stakeholders')
          .insert(projectStakeholderData);

        if (relationError) throw relationError;
      }

      return { data: project, error: null };
    } catch (error) {
      console.error('Error creating project:', error);
      return { data: null, error };
    }
  }

  /**
   * Get all projects for a user
   */
  static async getUserProjects(userId: string) {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          project_stakeholders (
            stakeholders (id, name)
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching user projects:', error);
      return { data: null, error };
    }
  }

  /**
   * Get a single project by ID
   */
  static async getProjectById(projectId: string, userId: string) {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          project_stakeholders (
            stakeholders (id, name)
          )
        `)
        .eq('id', projectId)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching project:', error);
      return { data: null, error };
    }
  }

  /**
   * Update an existing project
   */
  static async updateProject(projectId: string, formData: ProjectFormData, userId: string) {
    try {
      // Update project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .update({
          name: formData.projectName,
          description: formData.projectDescription,
          scale: formData.scale,
          objective: formData.objective,
          timeline: formData.timeline,
          additional_info: formData.additionalInfo || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId)
        .eq('user_id', userId)
        .select()
        .single();

      if (projectError) throw projectError;

      // Delete existing stakeholder relations
      const { error: deleteError } = await supabase
        .from('project_stakeholders')
        .delete()
        .eq('project_id', projectId);

      if (deleteError) throw deleteError;

      // Get stakeholder IDs from the names
      const { data: stakeholderIds, error: stakeholderError } = await supabase
        .from('stakeholders')
        .select('id')
        .in('name', formData.stakeholders);

      if (stakeholderError) throw stakeholderError;

      // Insert new project_stakeholders relations
      if (stakeholderIds && stakeholderIds.length > 0) {
        const projectStakeholderData = stakeholderIds.map(s => ({
          project_id: projectId,
          stakeholder_id: s.id
        }));

        const { error: relationError } = await supabase
          .from('project_stakeholders')
          .insert(projectStakeholderData);

        if (relationError) throw relationError;
      }

      return { data: project, error: null };
    } catch (error) {
      console.error('Error updating project:', error);
      return { data: null, error };
    }
  }

  /**
   * Delete a project
   */
  static async deleteProject(projectId: string, userId: string) {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
        .eq('user_id', userId);

      if (error) throw error;
      return { success: true, error: null };
    } catch (error) {
      console.error('Error deleting project:', error);
      return { success: false, error };
    }
  }

  /**
   * Get all stakeholders
   */
  static async getAllStakeholders() {
    try {
      const { data, error } = await supabase
        .from('stakeholders')
        .select('*')
        .order('name');

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching stakeholders:', error);
      return { data: null, error };
    }
  }
}