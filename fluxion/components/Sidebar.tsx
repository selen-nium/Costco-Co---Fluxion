"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const { data: session } = useSession();
  const pathname = usePathname();
  
  // Close sidebar when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (isOpen && !target.closest('.sidebar') && !target.closest('.user-menu-button')) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen, onClose]);

  // Close sidebar when ESC key is pressed
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (isOpen && e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);
  
  // Example navigation items - customize as needed
  const navItems: NavItem[] = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
        </svg>
      ),
    },
    {
      label: "Profile",
      href: "/profile",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      label: "Settings",
      href: "/settings",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
        </svg>
      ),
    },
  ];

  // Generate user initials for avatar fallback
  const getUserInitials = () => {
    if (!session?.user?.name) return "U";
    const nameParts = session.user.name.split(" ");
    if (nameParts.length >= 2) {
      return `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`;
    }
    return nameParts[0][0];
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity" onClick={onClose} />
      )}
      
      {/* Sidebar */}
      <div 
        className={`sidebar fixed top-0 right-0 h-full w-64 bg-gray-800 text-white z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Close button */}
        <button 
          className="absolute top-4 left-4 text-gray-400 hover:text-white"
          onClick={onClose}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* User profile section */}
        <div className="flex flex-col items-center p-6 border-b border-gray-700 mt-8">
          <div className="relative h-16 w-16 rounded-full bg-gray-600 flex items-center justify-center text-xl font-bold mb-3">
            {session?.user?.image ? (
              <img 
                src={session.user.image} 
                alt="Profile" 
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <span>{getUserInitials()}</span>
            )}
          </div>
          <h3 className="text-lg font-medium">{session?.user?.name || "User"}</h3>
          <p className="text-sm text-gray-400">{session?.user?.email || ""}</p>
        </div>
        
        {/* Navigation items */}
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link 
                    href={item.href}
                    className={`flex items-center rounded-md px-3 py-2 transition-colors ${
                      isActive 
                        ? "bg-gray-700 text-white" 
                        : "text-gray-300 hover:bg-gray-700 hover:text-white"
                    }`}
                    onClick={onClose}
                  >
                    <span className="mr-3">{item.icon}</span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        
        {/* Logout button at bottom */}
        <div className="border-t border-gray-700 p-4">
          <button
            onClick={() => signOut({ callbackUrl: "/auth/signin" })}
            className="flex w-full items-center rounded-md px-3 py-2 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V7.414l-5-5H3zm11.707.293a1 1 0 00-1.414 0L11 5.586 9.707 4.293a1 1 0 00-1.414 1.414L10.586 8 8.293 10.293a1 1 0 101.414 1.414L12 9.414l2.293 2.293a1 1 0 001.414-1.414L13.414 8l2.293-2.293a1 1 0 000-1.414z" clipRule="evenodd" />
            </svg>
            Sign out
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;