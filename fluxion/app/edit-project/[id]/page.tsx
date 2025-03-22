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
      return formData.projectName && formData.projectDescription && formData.scale;
    }
    if (step === 2) {
      return formData.objective && formData.stakeholders.length > 0;
    }
    if (step === 3) {
      return formData.timeline;
    }
    return true;
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
    
    // Validate the final step
    if (!validateCurrentStep()) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
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
  const selectClass = "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900";

  // Show loading state while checking authentication or loading project
  if (isLoading || isLoadingProject) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  // Don't render content until we confirm the user is authenticated
  if (!user) {
    return null;
  }

  return (
    <div className="container max-w-3xl py-8 mx-auto">
      <div className="mb-4">
        <Button 
          type="button" 
          variant="outline" 
          onClick={handleBackClick}
          className="flex items-center space-x-1"
        >
          <span>←</span>
          <span>Back to Project</span>
        </Button>
      </div>
      
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6 border-b">
          <h1 className="text-2xl font-bold text-center text-black">Edit Project</h1>
          <p className="text-center text-black">
            Update your project details
          </p>
        </div>
        <div className="p-6">
          <div className="mb-6">
            <div className="flex justify-between mb-2">
              {[1, 2, 3].map((stepNumber) => (
                <div 
                  key={stepNumber}
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    step >= stepNumber ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {stepNumber}
                </div>
              ))}
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full">
              <div 
                className="h-2 bg-blue-600 rounded-full transition-all" 
                style={{ width: `${(step / 3) * 100}%` }}
              />
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="projectName" className="block font-medium text-black">Project Name</label>
                  <Input
                    id="projectName"
                    name="projectName"
                    value={formData.projectName}
                    onChange={handleChange}
                    placeholder="Enter project name"
                    className="text-gray-900"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="projectDescription" className="block font-medium text-black">Project Description</label>
                  <Input
                    id="projectDescription"
                    name="projectDescription"
                    value={formData.projectDescription}
                    onChange={handleChange}
                    placeholder="Briefly describe your project in one line"
                    className="text-gray-900"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="scale" className="block font-medium text-black">Project Scale</label>
                  <select 
                    id="scale"
                    name="scale"
                    value={formData.scale}
                    onChange={handleChange}
                    className={selectClass}
                    required
                  >
                    <option value="" className="text-gray-900">Select scale</option>
                    <option value="team" className="text-gray-900">Team-wide</option>
                    <option value="department" className="text-gray-900">Department-wide</option>
                    <option value="company" className="text-gray-900">Company-wide</option>
                  </select>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="objective" className="block font-medium text-black">Objective of the Change</label>
                  <Textarea
                    id="objective"
                    name="objective"
                    value={formData.objective}
                    onChange={handleChange}
                    placeholder="What are you trying to achieve with this change?"
                    className="text-gray-900"
                    rows={4}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="block font-medium text-black">Stakeholders (Select all that apply)</label>
                  <div className="grid grid-cols-2 gap-2">
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
                          className="border-gray-700 data-[state=checked]:bg-blue-10 data-[state=checked]:border-blue-800"
                        />
                        <label htmlFor={stakeholder} className="font-normal text-gray-900">{stakeholder}</label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="timeline" className="block font-medium text-black">Expected Timeline</label>
                  <select 
                    id="timeline"
                    name="timeline"
                    value={formData.timeline}
                    onChange={handleChange}
                    className={selectClass}
                    required
                  >
                    <option value="" className="text-gray-900">Select timeline</option>
                    <option value="less-than-month" className="text-gray-900">Less than 1 month</option>
                    <option value="1-3-months" className="text-gray-900">1-3 months</option>
                    <option value="3-6-months" className="text-gray-900">3-6 months</option>
                    <option value="6-12-months" className="text-gray-900">6-12 months</option>
                    <option value="more-than-year" className="text-gray-900">More than a year</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="additionalInfo" className="block font-medium text-black">Additional Information</label>
                  <Textarea
                    id="additionalInfo"
                    name="additionalInfo"
                    value={formData.additionalInfo || ''}
                    onChange={handleChange}
                    placeholder="Any other details you'd like to share about this project"
                    className="text-gray-900"
                    rows={4}
                  />
                </div>
              </div>
            )}
          </form>
        </div>
        <div className="p-6 border-t bg-gray-50 flex justify-between">
          {step > 1 ? (
            <Button type="button" variant="outline" onClick={prevStep}>
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
            >
              Next
            </Button>
          ) : (
            <Button 
              type="submit" 
              onClick={(e) => handleSubmit(e as unknown as FormEvent<HTMLFormElement>)}
              disabled={isSubmitting || !validateCurrentStep()}
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}