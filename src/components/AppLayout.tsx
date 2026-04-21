import { Outlet } from "react-router-dom";
import { TopNav } from "@/components/TopNav";

export function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col w-full bg-background">
      <TopNav />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-fade-in">
        <Outlet />
      </main>
    </div>
  );
}
