"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';

// Sample project data - in a real app, this would come from a database
const sampleProjects = [
  { id: 1, title: "Project 1", thumbnail: "/api/placeholder/400/320", lastEdited: "2 days ago" },
  { id: 2, title: "Project 2", thumbnail: "/api/placeholder/400/320", lastEdited: "1 week ago" },
  { id: 3, title: "Project 3", thumbnail: "/api/placeholder/400/320", lastEdited: "3 weeks ago" },
  { id: 4, title: "Project 4", thumbnail: "/api/placeholder/400/320", lastEdited: "1 month ago" },
];

// Project card component with proper typing
const ProjectCard = ({ project }: { project: { id: number; title: string; thumbnail: string; lastEdited: string } }) => (
  <Link href={`/project/${project.id}`} className="block">
    <div className="bg-white rounded-lg border border-input overflow-hidden hover:shadow-md transition-shadow">
      <div className="relative">
        <img src={project.thumbnail} alt={project.title} className="w-full h-40 object-cover" />
        <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
          <Button variant="secondary" size="sm">Open Project</Button>
        </div>
      </div>
      <div className="p-3">
        <h3 className="font-medium text-lg">{project.title}</h3>
        <p className="text-sm text-muted-foreground">Last edited {project.lastEdited}</p>
      </div>
    </div>
  </Link>
);

export default function Dashboard() {
  const { user, session, isLoading } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const router = useRouter();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/signin');
    }
  }, [user, isLoading, router]);

  // Show loading state while checking authentication
  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
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
    <div className="min-h-screen bg-gray-50">
      {/* Header with user icon */}
      <header className="bg-white shadow">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-semibold text-gray-900">Fluxion</h1>
          <button 
            className="user-menu-button rounded-full h-10 w-10 overflow-hidden bg-gray-200 flex items-center justify-center"
            onClick={() => setIsSidebarOpen(true)}
          >
            {user?.user_metadata?.avatar_url ? (
              <img 
                src={user.user_metadata.avatar_url} 
                alt="Profile" 
                className="h-10 w-10 object-cover"
              />
            ) : (
              <span className="font-medium text-gray-700">{getUserInitials()}</span>
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
            <h1 className="text-2xl font-bold">Your Projects</h1>
            <p className="text-muted-foreground">Create and manage your Fluxion projects</p>
          </div>
          
          {/* Create New Project Button */}
          <div>
            <Link href="/create-project">
              <Button className="mb-4">
                <Plus className="size-4 mr-2" />
                Create New Project
              </Button>
            </Link>
          </div>
          
          {/* Projects Grid */}
          <div>
            <h2 className="text-lg font-medium mb-4">Recent Projects</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {sampleProjects.map(project => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}