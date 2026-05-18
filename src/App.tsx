import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PlayerDetailProvider } from "@/components/PlayerDetailContext";
import { PairDetailProvider } from "@/components/PairDetailContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import Index from "./pages/Index";
import Rankings from "./pages/Rankings";
import Admin from "./pages/Admin";
import Reglament from "./pages/Reglament";
import Proves from "./pages/Proves";
import Jugadors from "./pages/Jugadors";
import Palmares from "./pages/Palmares";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        <PlayerDetailProvider>
          <PairDetailProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/rankings" element={<Rankings />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/reglament" element={<Reglament />} />
              <Route path="/proves" element={<Proves />} />
              <Route path="/jugadors" element={<Jugadors />} />
              <Route path="/palmares" element={<Palmares />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </BrowserRouter>
          </PairDetailProvider>
        </PlayerDetailProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
