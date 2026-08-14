import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { AidEstimatePage, ComparePage, RepaymentPage, SchoolsPage, SettingsPage } from './pages/AppPages'
import { HomePage } from './pages/HomePage'
import { HowItWorksPage, MethodologyPage, PolicyChangesPage, PrivacyPage } from './pages/InfoPages'
import { ProfilePage } from './pages/ProfilePage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="how-it-works" element={<HowItWorksPage />} />
        <Route path="methodology" element={<MethodologyPage />} />
        <Route path="policy-changes" element={<PolicyChangesPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="app/aid-estimate" element={<AidEstimatePage />} />
        <Route path="app/schools" element={<SchoolsPage />} />
        <Route path="app/compare" element={<ComparePage />} />
        <Route path="app/repayment" element={<RepaymentPage />} />
        <Route path="app/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
