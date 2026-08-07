import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { AssignedFilterProvider } from '@/lib/AssignedFilterContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import Login from './pages/Login';
import CategoryConfig from './pages/CategoryConfig';






import Dashboard from './pages/Dashboard';
import ImplantacaoAtendimentos from './pages/ImplantacaoAtendimentos';
import ClientDetail from './pages/ClientDetail';
import UserProfile from './pages/UserProfile';
import TicketDetail from './pages/TicketDetail';
import EmailConfigStatus from './pages/EmailConfigStatus';
import MetabotConfig from './pages/MetabotConfig';
import DiretorDashboard from './pages/DiretorDashboard';
import ReportDetail from './pages/ReportDetail';
import InternalGuard from './lib/InternalGuard';


const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated } = useAuth();

  // Skeleton fullscreen loading
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 bg-background flex overflow-hidden">
        {/* Sidebar skeleton */}
        <div className="w-[220px] flex-shrink-0 bg-card border-r border-border flex flex-col gap-3 p-4">
          <div className="h-5 w-24 bg-muted rounded animate-pulse mb-2" />
          {[80, 60, 70, 60, 75, 55, 65, 60, 80, 50, 65].map((w, i) => (
            <div key={i} className="h-3.5 rounded animate-pulse bg-muted" style={{ width: `${w}%`, animationDelay: `${i * 60}ms` }} />
          ))}
        </div>

        {/* Main area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Topbar skeleton */}
          <div className="h-11 border-b border-border bg-card flex items-center px-5 gap-4 flex-shrink-0">
            <div className="h-3.5 w-36 bg-muted rounded animate-pulse" />
          </div>

          {/* Content skeleton */}
          <div className="flex-1 p-6 overflow-hidden">
            {/* Title row */}
            <div className="h-5 w-48 bg-muted rounded animate-pulse mb-6" />

            {/* Grid of cards */}
            <div className="grid grid-cols-4 gap-4">
              {/* Column 1 — wider */}
              <div className="col-span-2 flex flex-col gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <div className="h-3 bg-muted rounded animate-pulse" style={{ width: "80%", animationDelay: `${i * 50}ms` }} />
                    <div className="h-3 bg-muted rounded animate-pulse" style={{ width: "55%", animationDelay: `${i * 50 + 25}ms` }} />
                  </div>
                ))}
              </div>

              {/* Column 2 */}
              <div className="flex flex-col gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <div className="h-3 bg-muted rounded animate-pulse" style={{ width: "65%", animationDelay: `${i * 50 + 10}ms` }} />
                    <div className="h-3 bg-muted rounded animate-pulse" style={{ width: "50%", animationDelay: `${i * 50 + 35}ms` }} />
                  </div>
                ))}
              </div>

              {/* Column 3 */}
              <div className="flex flex-col gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <div className="h-3 bg-muted rounded animate-pulse" style={{ width: "70%", animationDelay: `${i * 50 + 20}ms` }} />
                    <div className="h-3 bg-muted rounded animate-pulse" style={{ width: "55%", animationDelay: `${i * 50 + 40}ms` }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Sem sessão válida - manda para a tela de login (navegação do
  // react-router, sem recarregar a página).
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={
        <InternalGuard>
          <LayoutWrapper currentPageName="UserProfile">
            <UserProfile />
          </LayoutWrapper>
        </InternalGuard>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <InternalGuard>
              <LayoutWrapper currentPageName={path}>
                <Page />
              </LayoutWrapper>
            </InternalGuard>
          }
        />
      ))}
      <Route path="/CategoryConfig" element={<InternalGuard><LayoutWrapper currentPageName="CategoryConfig"><CategoryConfig /></LayoutWrapper></InternalGuard>} />




      <Route path="/clients/:clientId" element={<InternalGuard><LayoutWrapper currentPageName="ClientDetail"><ClientDetail /></LayoutWrapper></InternalGuard>} />
      <Route path="/implantacao/:implantacao_id/atendimentos" element={<InternalGuard><LayoutWrapper currentPageName="ImplantacaoAtendimentos"><ImplantacaoAtendimentos /></LayoutWrapper></InternalGuard>} />
      <Route path="/perfil" element={<InternalGuard><LayoutWrapper currentPageName="UserProfile"><UserProfile /></LayoutWrapper></InternalGuard>} />
      <Route path="/ticket/:ticketId" element={<InternalGuard><LayoutWrapper currentPageName="TicketDetail"><TicketDetail /></LayoutWrapper></InternalGuard>} />
      <Route path="/EmailConfigStatus" element={<InternalGuard><LayoutWrapper currentPageName="EmailConfigStatus"><EmailConfigStatus /></LayoutWrapper></InternalGuard>} />
      <Route path="/MetabotConfig" element={<InternalGuard><LayoutWrapper currentPageName="MetabotConfig"><MetabotConfig /></LayoutWrapper></InternalGuard>} />
      <Route path="/diretor" element={<InternalGuard><LayoutWrapper currentPageName="DiretorDashboard"><DiretorDashboard /></LayoutWrapper></InternalGuard>} />
      <Route path="/report/:slug" element={<InternalGuard><LayoutWrapper currentPageName="Reports"><ReportDetail /></LayoutWrapper></InternalGuard>} />

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <ThemeProvider>
      <AuthProvider>
        <AssignedFilterProvider>
          <QueryClientProvider client={queryClientInstance}>
            <Router>
              <NavigationTracker />
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/*" element={<AuthenticatedApp />} />
              </Routes>
            </Router>
            <Toaster />
          </QueryClientProvider>
        </AssignedFilterProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App