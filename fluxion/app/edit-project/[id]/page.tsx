"use client";

import { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from '@/lib/auth-context';
import { ProjectService, ProjectFormData } from '@/lib/project-service';
import { toast } from '@/components/ui/use-toast';

// Define the type for stakeholder objects
interface Stakeholder {
  name: string;
  [key: string]: any; // For any other properties
}

export default function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  // Unwrap the params using React.use()
  const { id } = use(params);
  
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingProject, setIsLoadingProject] = useState(true);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<ProjectFormData>({
    projectName: '',
    projectDescription: '',
    scale: '',
    objective: '',
    stakeholders: [],
    timeline: '',
    additionalInfo: ''
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/signin');
    }
  }, [user, isLoading, router]);

  // Fetch project data
  useEffect(() => {
    const fetchProject = async () => {
      if (user && id) {
        setIsLoadingProject(true);
        const { data, error } = await ProjectService.getProjectById(id, user.id);
        
        if (data) {
          // Map project data to form structure
          setFormData({
            projectName: data.name,
            projectDescription: data.description,
            scale: data.scale,
            objective: data.objective,
            stakeholders: data.project_stakeholders?.map((ps: { stakeholders: Stakeholder }) => ps.stakeholders.name) || [],
            timeline: data.timeline,
            additionalInfo: data.additional_info || ''
          });
        } else if (error) {
          console.error('Error fetching project:', error);
          toast({
            title: "Error",
            description: "Failed to load project data.",
            variant: "destructive"
          });
          router.push('/dashboard');
        }
        
        setIsLoadingProject(false);
      }
    };

    if (user) {
      fetchProject();
    }
  }, [user, id, router]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleStakeholderChange = (stakeholder: string) => {
    setFormData((prev) => {
      const stakeholders = prev.stakeholders.includes(stakeholder)
        ? prev.stakeholders.filter(s => s !== stakeholder)
        : [...prev.stakeholders, stakeholder];
      return { ...prev, stakeholders };
    });
  };

  const nextStep = () => setStep(prev => prev + 1);
  
  const prevStep = () => setStep(prev => prev - 1);

  // Handle back button click
  const handleBackClick = () => {
    router.push(`/project/${id}/interface`);
  };

  const validateCurrentStep = () => {
    if (step === 1) {
      return formData.projectName; // Only project name is required
    }
    return true; // All other steps are valid by default
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to update a project",
        variant: "destructive"
      });
      return;
    }
    
    // Validate only project name is required
    if (!formData.projectName) {
      toast({
        title: "Missing Information",
        description: "Please provide a project name",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const { data, error } = await ProjectService.updateProject(id, formData, user.id);
      
      if (error) {
        throw error;
      }
      
      toast({
        title: "Project Updated",
        description: "Your project has been updated successfully"
      });
      
      // Redirect to the project page
      router.push(`/project/${id}/interface`);
    } catch (error) {
      console.error('Error updating project:', error);
      toast({
        title: "Error",
        description: "There was an error updating your project. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Common class for consistent styling across all selects
  const selectClass = "w-full px-3 py-2 border border-gray-700 rounded-md bg-gray-900 text-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-500";

  // Show loading state while checking authentication or loading project
  if (isLoading || isLoadingProject) {
    return <div className="flex items-center justify-center min-h-screen bg-gray-900 text-gray-200">Loading...</div>;
  }

  // Don't render content until we confirm the user is authenticated
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <Button 
          type="button" 
          variant="ghost" 
          onClick={handleBackClick}
          className="mb-6 text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
        >
          ← Back
        </Button>
        
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-white">Edit Project</h1>
          <div className="mt-4 flex items-center space-x-1">
            {[1, 2, 3].map((stepNumber) => (
              <div key={stepNumber} className="flex-1">
                <div 
                  className={`h-1 rounded-full ${
                    step >= stepNumber ? 'bg-gray-200' : 'bg-gray-700'
                  }`}
                />
                <div className="mt-2 text-xs text-gray-400 text-center">
                  {stepNumber === 1 ? 'Basics' : stepNumber === 2 ? 'Details' : 'Final'}
                </div>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label htmlFor="projectName" className="block text-sm font-medium text-gray-300 mb-1">Project Name *</label>
                <Input
                  id="projectName"
                  name="projectName"
                  value={formData.projectName}
                  onChange={handleChange}
                  placeholder="Enter project name"
                  className="bg-gray-900 border-gray-700 text-gray-200 placeholder-gray-500 focus:ring-gray-500 focus:border-gray-500"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="projectDescription" className="block text-sm font-medium text-gray-300 mb-1">Project Description</label>
                <Textarea
                  id="projectDescription"
                  name="projectDescription"
                  value={formData.projectDescription}
                  onChange={handleChange}
                  placeholder="Briefly describe your project"
                  className="bg-gray-900 border-gray-700 text-gray-200 placeholder-gray-500 focus:ring-gray-500 focus:border-gray-500"
                  rows={3}
                />
              </div>
              
              <div>
                <label htmlFor="scale" className="block text-sm font-medium text-gray-300 mb-1">Project Scale</label>
                <select 
                  id="scale"
                  name="scale"
                  value={formData.scale}
                  onChange={handleChange}
                  className={selectClass}
                >
                  <option value="" className="text-gray-500">Select scale</option>
                  <option value="team" className="text-gray-200">Team-wide</option>
                  <option value="department" className="text-gray-200">Department-wide</option>
                  <option value="company" className="text-gray-200">Company-wide</option>
                </select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label htmlFor="objective" className="block text-sm font-medium text-gray-300 mb-1">Objective</label>
                <Textarea
                  id="objective"
                  name="objective"
                  value={formData.objective}
                  onChange={handleChange}
                  placeholder="What are you trying to achieve?"
                  className="bg-gray-900 border-gray-700 text-gray-200 placeholder-gray-500 focus:ring-gray-500 focus:border-gray-500"
                  rows={4}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">Stakeholders</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4">
                  {[
                    "Executive Leadership",
                    "Department Managers",
                    "Team Leaders",
                    "End Users",
                    "IT Department",
                    "HR Department",
                    "Finance Department",
                    "External Clients",
                    "Vendors/Partners",
                    "Regulatory Bodies"
                  ].map((stakeholder) => (
                    <div key={stakeholder} className="flex items-center space-x-2">
                      <Checkbox 
                        id={stakeholder}
                        checked={formData.stakeholders.includes(stakeholder)}
                        onCheckedChange={() => handleStakeholderChange(stakeholder)}
                        className="border-gray-600 text-gray-200 data-[state=checked]:bg-gray-200 data-[state=checked]:border-gray-200"
                      />
                      <label htmlFor={stakeholder} className="font-normal text-gray-300 text-sm">{stakeholder}</label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <label htmlFor="timeline" className="block text-sm font-medium text-gray-300 mb-1">Timeline</label>
                <select 
                  id="timeline"
                  name="timeline"
                  value={formData.timeline}
                  onChange={handleChange}
                  className={selectClass}
                >
                  <option value="" className="text-gray-500">Select timeline</option>
                  <option value="less-than-month" className="text-gray-200">Less than 1 month</option>
                  <option value="1-3-months" className="text-gray-200">1-3 months</option>
                  <option value="3-6-months" className="text-gray-200">3-6 months</option>
                  <option value="6-12-months" className="text-gray-200">6-12 months</option>
                  <option value="more-than-year" className="text-gray-200">More than a year</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="additionalInfo" className="block text-sm font-medium text-gray-300 mb-1">Additional Notes</label>
                <Textarea
                  id="additionalInfo"
                  name="additionalInfo"
                  value={formData.additionalInfo || ''}
                  onChange={handleChange}
                  placeholder="Any other details you'd like to share"
                  className="bg-gray-900 border-gray-700 text-gray-200 placeholder-gray-500 focus:ring-gray-500 focus:border-gray-500"
                  rows={4}
                />
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4 border-t border-gray-800">
            {step > 1 ? (
              <Button 
                type="button" 
                variant="ghost" 
                onClick={prevStep}
                className="text-gray-400 hover:text-gray-200 hover:bg-gray-800"
              >
                Previous
              </Button>
            ) : (
              <div></div> // Empty div for spacing
            )}
            
            {step < 3 ? (
              <Button 
                type="button" 
                onClick={nextStep}
                disabled={!validateCurrentStep()}
                className="bg-gray-800 hover:bg-gray-700 text-white border border-gray-700"
              >
                Next
              </Button>
            ) : (
              <Button 
                type="button" 
                onClick={(e) => {
                  e.preventDefault();
                  handleSubmit(e as unknown as FormEvent<HTMLFormElement>);
                }}
                disabled={isSubmitting || !validateCurrentStep()}
                className="bg-gray-800 hover:bg-gray-700 text-white border border-gray-700"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}