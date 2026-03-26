import Sidebar from "@/components/Sidebar";
import DashboardHeader from "@/components/DashboardHeader";
import { BreadcrumbProvider } from "@/context/BreadcrumbContext";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <BreadcrumbProvider>
            <div className="flex h-screen overflow-hidden bg-gray-50 flex-col md:flex-row">
                <div className="hidden md:block h-full">
                    <Sidebar />
                </div>
                
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <DashboardHeader />
                    <main className="flex-1 overflow-y-auto">
                        <div className="container mx-auto p-4 md:p-8 max-w-7xl">
                            {children}
                        </div>
                    </main>
                </div>
            </div>
        </BreadcrumbProvider>
    );
}
