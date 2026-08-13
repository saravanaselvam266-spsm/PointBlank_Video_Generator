import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { MobileSidebar } from './MobileSidebar';

export const AppShell = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-800 flex flex-col font-sans">
      <div className="flex flex-1">
        {/* Desktop Persistent Sidebar */}
        <div className="hidden lg:block">
          <Sidebar />
        </div>

        {/* Mobile Drawer */}
        <MobileSidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

        {/* Main Content Workspace */}
        <div className="flex-1 flex flex-col min-w-0">
          <Navbar onOpenMobileMenu={() => setMobileMenuOpen(true)} />

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};
