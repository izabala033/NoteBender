import { Suspense, lazy } from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Menu from "./Menu";
import Harmonica from "./Harmonica/Harmonica";

const Circle = lazy(() => import("./Circle/Circle"));
const MusicXML = lazy(() => import("./MusicXML/MusicXML"));
const Practice = lazy(() => import("./Practice/Practice"));

function App() {
  return (
    <Router>
      <div className="grid min-h-dvh grid-rows-[auto_1fr] bg-gray-950">
        <Menu />
        <main className="min-h-0">
          <Suspense
            fallback={
              <div className="app-page">
                Loading...
              </div>
            }
          >
            <Routes>
              <Route path="/circle" element={<Circle />} />
              <Route path="/harmonica" element={<Harmonica />} />
              <Route path="/practice" element={<Practice />} />
              <Route path="/musicxml" element={<MusicXML />} />
              <Route path="/" element={<Navigate to="/harmonica" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </Router>
  );
}

export default App;
