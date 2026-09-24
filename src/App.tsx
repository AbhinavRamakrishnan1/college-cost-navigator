import { lazy,Suspense } from 'react'
import { Navigate, Route, Routes,useLocation } from 'react-router-dom'
import { RouteBoundary } from './components/RouteBoundary'
import { AppShell } from './components/AppShell'
const AidEstimatePage=lazy(()=>import('./pages/AppPages').then(module=>({default:module.AidEstimatePage})))
const RepaymentPage=lazy(()=>import('./pages/RepaymentPage').then(module=>({default:module.RepaymentPage})))
const SettingsPage=lazy(()=>import('./pages/SettingsPage').then(module=>({default:module.SettingsPage})))
const SchoolsPage=lazy(()=>import('./pages/SchoolsPage').then(module=>({default:module.SchoolsPage})))
const ComparePage=lazy(()=>import('./pages/ComparePage').then(module=>({default:module.ComparePage})))
const PrintSummaryPage=lazy(()=>import('./pages/PrintSummaryPage').then(module=>({default:module.PrintSummaryPage})))
const FundingPlannerPage=lazy(()=>import('./pages/FundingPlannerPage').then(module=>({default:module.FundingPlannerPage})))
const AboutPage=lazy(()=>import('./pages/AboutPage').then(module=>({default:module.AboutPage})))
const ContactPage=lazy(()=>import('./pages/ContactPage').then(module=>({default:module.ContactPage})))
const AidOfferDecoderPage=lazy(()=>import('./pages/AidOfferDecoderPage').then(module=>({default:module.AidOfferDecoderPage})))
import { HomePage } from './pages/HomePage'
import { HowItWorksPage, PrivacyPage } from './pages/InfoPages'
const MethodologyPage=lazy(()=>import('./pages/MethodologyPages').then(module=>({default:module.MethodologyPage})))
const PolicyChangesPage=lazy(()=>import('./pages/MethodologyPages').then(module=>({default:module.PolicyChangesPage})))
const ProfilePage=lazy(()=>import('./pages/ProfilePage').then(module=>({default:module.ProfilePage})))
const StorageGate=lazy(()=>import('./components/StorageGate').then(module=>({default:module.StorageGate})))

export default function App() {
  const location=useLocation()
  return (
    <RouteBoundary key={location.pathname}><Suspense fallback={<p role="status" className="page-wrap py-12">Loading view…</p>}><Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="how-it-works" element={<HowItWorksPage />} />
        <Route path="methodology" element={<MethodologyPage />} />
        <Route path="policy-changes" element={<PolicyChangesPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="aid-offer-decoder" element={<AidOfferDecoderPage />} />
        <Route path="profile" element={<StorageGate><ProfilePage /></StorageGate>} />
        <Route path="app/aid-estimate" element={<StorageGate><AidEstimatePage /></StorageGate>} />
        <Route path="app/schools" element={<StorageGate><SchoolsPage /></StorageGate>} />
        <Route path="app/compare" element={<StorageGate><ComparePage /></StorageGate>} />
        <Route path="app/funding-planner" element={<StorageGate><FundingPlannerPage /></StorageGate>} />
        <Route path="app/repayment" element={<StorageGate><RepaymentPage /></StorageGate>} />
        <Route path="app/summary" element={<StorageGate><PrintSummaryPage /></StorageGate>} />
        <Route path="app/settings" element={<StorageGate><SettingsPage /></StorageGate>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes></Suspense></RouteBoundary>
  )
}
