"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { ProjectService, Project } from '@/lib/project-service';
import { format } from 'date-fns';

// Updated Project card component with proper typing for real data
const ProjectCard = ({ project }: { project: Project }) => {
  // Calculate how long ago the project was updated
  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} week${Math.floor(diffInDays / 7) !== 1 ? 's' : ''} ago`;
    if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} month${Math.floor(diffInDays / 30) !== 1 ? 's' : ''} ago`;
    return `${Math.floor(diffInDays / 365)} year${Math.floor(diffInDays / 365) !== 1 ? 's' : ''} ago`;
  };

  // Get consistent image for a project based on its ID
  const getProjectImage = () => {
    const assetImages = [
      '/assets/img1.jpg',
      '/assets/img2.jpg',
      '/assets/img3.jpg',
      '/assets/img4.jpg',
      '/assets/img5.jpg',
      '/assets/img6.jpg',
      '/assets/img7.jpg', // Fixed typo: was img7jpg
      '/assets/img8.jpg',
      '/assets/img9.jpg',
      '/assets/img10.jpg',
    ];
    
    // Use project.id to determine image - converting ID to a number then modulo
    // This ensures the same project always gets the same image
    const projectIdNum = parseInt(project.id.replace(/\D/g, '')) || 0;
    const imageIndex = projectIdNum % assetImages.length;
    return assetImages[imageIndex];
  };

  return (
    <Link href={`/project/${project.id}/interface`} className="block">
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden hover:shadow-md transition-shadow">
        <div className="relative">
          <img 
            src={getProjectImage()} 
            alt={project.name} 
            className="w-full h-40 object-cover" 
          />
          <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
            <Button variant="secondary" size="sm">Open Project</Button>
          </div>
        </div>
        <div className="p-3">
          <h3 className="font-medium text-lg text-white">{project.name}</h3>
          <p className="text-sm text-gray-400">Last edited {getTimeAgo(project.updated_at)}</p>
        </div>
      </div>
    </Link>
  );
};

export default function Dashboard() {
  const { user, session, isLoading } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const router = useRouter();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/signin');
    }
  }, [user, isLoading, router]);

  // Fetch projects when user is authenticated
  useEffect(() => {
    const fetchProjects = async () => {
      if (user) {
        setIsLoadingProjects(true);
        const { data, error } = await ProjectService.getUserProjects(user.id);
        
        if (data) {
          setProjects(data);
        } else if (error) {
          console.error('Error fetching projects:', error);
        }
        
        setIsLoadingProjects(false);
      }
    };

    if (user) {
      fetchProjects();
    }
  }, [user]);

  // Show loading state while checking authentication
  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">Loading...</div>;
  }

  // Don't render content until we confirm the user is authenticated
  if (!user) {
    return null;
  }

  // Generate user initials for avatar fallback
  const getUserInitials = () => {
    if (!user?.user_metadata?.name) return "U";
    const name = user.user_metadata.name;
    const nameParts = name.split(" ");
    if (nameParts.length >= 2) {
      return `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`;
    }
    return nameParts[0][0];
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header with user icon */}
      <header className="bg-gray-800 shadow">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-semibold text-white">Fluxion</h1>
          <button 
            className="user-menu-button rounded-full h-10 w-10 overflow-hidden bg-gray-700 flex items-center justify-center"
            onClick={() => setIsSidebarOpen(true)}
          >
            {user?.user_metadata?.avatar_url ? (
              <img 
                src={user.user_metadata.avatar_url} 
                alt="Profile" 
                className="h-10 w-10 object-cover"
              />
            ) : (
              <span className="font-medium text-gray-200">{getUserInitials()}</span>
            )}
          </button>
        </div>
      </header>

      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main content */}
      <main className="container mx-auto p-4">
        <div className="flex flex-col gap-6">
          {/* Dashboard Header */}
          <div>
            <h1 className="text-2xl font-bold text-white">Your Projects</h1>
            <p className="text-gray-400">Create and manage your Fluxion projects</p>
          </div>
          
          {/* Create New Project Button */}
          <div>
            <Link href="/create-project">
              <Button className="mb-4 text-black bg-white hover:bg-white">
                <Plus className="size-4 mr-2" />
                Create New Project
              </Button>
            </Link>
          </div>
          
          {/* Projects Grid */}
          <div>
            <h2 className="text-lg font-medium mb-4 text-white">Recent Projects</h2>
            
            {isLoadingProjects ? (
              <div className="flex justify-center py-8 text-gray-300">
                <p>Loading your projects...</p>
              </div>
            ) : projects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {projects.map(project => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            ) : (
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 text-center">
                <h3 className="text-lg font-medium mb-2 text-white">No projects yet</h3>
                <p className="text-gray-400 mb-4">
                  Create your first project to get started with Fluxion
                </p>
                <Link href="/create-project">
                  <Button>
                    <Plus className="size-4 mr-2" />
                    Create New Project
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}