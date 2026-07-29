import React, { Suspense, lazy } from 'react';
import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom';
import { isNative } from './platform/index.js';
import { DeviceProvider } from './context/DeviceContext';
import { ToastProvider } from './components/ui/Toast';
import { AppShell } from './components/layout/AppShell';
const Home = lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const Browse = lazy(() => import('./pages/Browse').then(m => ({ default: m.Browse })));
const Detail = lazy(() => import('./pages/Detail').then(m => ({ default: m.Detail })));
const Search = lazy(() => import('./pages/Search').then(m => ({ default: m.Search })));
const Person = lazy(() => import('./pages/Person').then(m => ({ default: m.Person })));
const Collection = lazy(() => import('./pages/Collection').then(m => ({ default: m.Collection })));
const Changelog = lazy(() => import('./pages/Changelog').then(m => ({ default: m.Changelog })));
const Terms = lazy(() => import('./pages/Terms').then(m => ({ default: m.Terms })));
const Privacy = lazy(() => import('./pages/Privacy').then(m => ({ default: m.Privacy })));
const Anime = lazy(() => import('./pages/Anime').then(m => ({ default: m.Anime })));
const Manga = lazy(() => import('./pages/Manga').then(m => ({ default: m.Manga })));
const AnimeBrowse = lazy(() => import('./pages/AnimeBrowse').then(m => ({ default: m.AnimeBrowse })));
const AnimeDetail = lazy(() => import('./pages/AnimeDetail').then(m => ({ default: m.AnimeDetail })));
const NotFound = lazy(() => import('./pages/NotFound').then(m => ({ default: m.NotFound })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const Download = lazy(() => import('./pages/Download').then(m => ({ default: m.Download })));
const WatchTogether = lazy(() => import('./pages/WatchTogether').then(m => ({ default: m.WatchTogether })));
const MangaBrowse = lazy(() => import('./pages/MangaBrowse').then(m => ({ default: m.MangaBrowse })));
const MangaDetail = lazy(() => import('./pages/MangaDetail').then(m => ({ default: m.MangaDetail })));
const MangaReader = lazy(() => import('./pages/MangaReader').then(m => ({ default: m.MangaReader })));
const DevConsole = lazy(() => import('./pages/DevConsole').then(m => ({ default: m.DevConsole })));
const Downloads = lazy(() => import('./pages/Downloads').then(m => ({ default: m.Downloads })));
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
  </div>
);
// Native apps (Tauri/Capacitor) serve from a custom protocol where deep
// history-API routes 404, so they use HashRouter. The website is unchanged.
const Router = isNative() ? HashRouter : BrowserRouter;
export default function App() {
  return (
    <DeviceProvider>
      <ToastProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <div className="relative isolate min-h-screen">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Watch Together — renders OUTSIDE AppShell for full immersion */}
                <Route path="/watch-together" element={<WatchTogether />} />
                {/* Manga Reader — full-screen immersive reading */}
                <Route path="/manga/reader/:provider/:chapterId" element={<MangaReader />} />
                {/* All other routes go through the normal AppShell layout */}
                <Route path="*" element={
                  <AppShell>
                    <Routes>
                      <Route path="/" element={<Home />} />
                      <Route path="/movies" element={<Browse mediaType="movie" />} />
                      <Route path="/tv" element={<Browse mediaType="tv" />} />
                      <Route path="/movie/:id/:slug?" element={<Detail mediaType="movie" />} />
                      <Route path="/tv/:id/:slug?" element={<Detail mediaType="tv" />} />
                      <Route path="/search" element={<Search />} />
                      <Route path="/person/:id" element={<Person />} />
                      <Route path="/collection/:id" element={<Collection />} />
                      <Route path="/changelog" element={<Changelog />} />
                      <Route path="/terms" element={<Terms />} />
                      <Route path="/privacy" element={<Privacy />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/download" element={<Download />} />
                      <Route path="/downloads" element={<Downloads />} />
                      <Route path="/dev-console" element={<DevConsole />} />
                      <Route path="/anime" element={<Anime />} />
                      <Route path="/anime/browse" element={<AnimeBrowse />} />
                      <Route path="/anime/:id/:slug?" element={<AnimeDetail />} />
                      <Route path="/manga" element={<Manga />} />
                      <Route path="/manga/browse" element={<MangaBrowse />} />
                      <Route path="/manga/read/:provider/:id/:slug?" element={<MangaDetail />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AppShell>
                } />
              </Routes>
            </Suspense>
          </div>
        </Router>
      </ToastProvider>
    </DeviceProvider>
  );
}
