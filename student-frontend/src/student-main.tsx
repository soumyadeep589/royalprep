import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { RequireSession } from './components/RequireSession'
import { studentRoutes } from './StudentRoutes'
import './style.css'
import './screens.css'

createRoot(document.getElementById('root')!).render(<BrowserRouter><Routes>
  {studentRoutes}
  <Route path="*" element={<RequireSession><main><h1>Page not found</h1><a href="/">Go home</a></main></RequireSession>}/>
</Routes></BrowserRouter>)
