import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './app/Layout'
import { SettingsProvider } from './app/SettingsProvider'
import Recurrences from './pages/Recurrences'
import SettingsPage from './pages/SettingsPage'
import Spending from './pages/Spending'
import Summary from './pages/Summary'
import Transactions from './pages/Transactions'

export default function App() {
  return (
    <SettingsProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/transactions" replace />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="summary" element={<Summary />} />
          <Route path="spending" element={<Spending />} />
          <Route path="recurrences" element={<Recurrences />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/transactions" replace />} />
        </Route>
      </Routes>
    </SettingsProvider>
  )
}
