import { Route } from 'react-router-dom'
import { RequireSession } from './components/RequireSession'
import { Home } from './pages/Home'
import { ChapterLibrary } from './pages/ChapterLibrary'
import { Practice } from './pages/Practice'
import { StudentLogin } from './pages/StudentLogin'
import { StudyPlanner } from './pages/StudyPlanner'
import { Dashboard } from './pages/Dashboard'
import { Tools } from './pages/Tools'
import { ChapterPreview } from './pages/ChapterPreview'
import { Mocks } from './pages/Mocks'
import { CreateMock } from './pages/CreateMock'
import { MockAttempt } from './pages/MockAttempt'
import { Mistakes } from './pages/Mistakes'
import { Flashcards } from './pages/Flashcards'
import { ChapterReader } from './pages/ChapterReader'
import { StudentProfile } from './pages/StudentProfile'

export const studentRoutes = <>
  <Route path="/" element={<Home/>}/>
  <Route path="/course" element={<RequireSession><ChapterLibrary publicCatalog/></RequireSession>}/>
  <Route path="/course/:chapter" element={<RequireSession><ChapterPreview/></RequireSession>}/>
  <Route path="/tools" element={<RequireSession><Tools/></RequireSession>}/>
  <Route path="/tools/planner" element={<RequireSession><StudyPlanner/></RequireSession>}/>
  <Route path="/app" element={<RequireSession><Dashboard/></RequireSession>}/>
  <Route path="/app/chapters" element={<RequireSession><ChapterLibrary/></RequireSession>}/>
  <Route path="/app/chapters/:id" element={<RequireSession><ChapterReader/></RequireSession>}/>
  <Route path="/app/mocks" element={<RequireSession><Mocks/></RequireSession>}/>
  <Route path="/app/mocks/new" element={<RequireSession><CreateMock/></RequireSession>}/>
  <Route path="/app/attempts/:id" element={<RequireSession><MockAttempt/></RequireSession>}/>
  <Route path="/app/attempts/:id/review" element={<RequireSession><MockAttempt/></RequireSession>}/>
  <Route path="/app/results" element={<RequireSession><Mocks results/></RequireSession>}/>
  <Route path="/app/mistakes" element={<RequireSession><Mistakes/></RequireSession>}/>
  <Route path="/app/flashcards" element={<RequireSession><Flashcards/></RequireSession>}/>
  <Route path="/app/profile" element={<RequireSession><StudentProfile/></RequireSession>}/>
  <Route path="/tools/flashcards" element={<RequireSession><Flashcards/></RequireSession>}/>
  <Route path="/study/library" element={<RequireSession><ChapterLibrary/></RequireSession>}/>
  <Route path="/practice" element={<RequireSession><Practice/></RequireSession>}/>
  <Route path="/sign-in" element={<StudentLogin/>}/>
</>
