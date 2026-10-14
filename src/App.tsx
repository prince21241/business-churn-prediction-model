import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { ToastProvider } from './components/ui/Toast'
import { MlProvider } from './demo/context'
import { DashboardPage } from './pages/DashboardPage'
import { DatasetDetailPage } from './pages/DatasetDetailPage'
import { DatasetsPage } from './pages/DatasetsPage'
import { ModelDetailPage } from './pages/ModelDetailPage'
import { ModelsPage } from './pages/ModelsPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PredictionsPage } from './pages/PredictionsPage'
import { TrainingDetailPage } from './pages/TrainingDetailPage'
import { TrainingPage } from './pages/TrainingPage'

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <MlProvider>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="datasets" element={<DatasetsPage />} />
              <Route path="datasets/:datasetId" element={<DatasetDetailPage />} />
              <Route path="training" element={<TrainingPage />} />
              <Route path="training/:jobId" element={<TrainingDetailPage />} />
              <Route path="models" element={<ModelsPage />} />
              <Route path="models/:modelId" element={<ModelDetailPage />} />
              <Route path="predictions" element={<PredictionsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </MlProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
