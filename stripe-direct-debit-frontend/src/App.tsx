import {  Routes, Route } from "react-router-dom";
import "./App.css";
import BacsDirectDebitPage from "./BacsDirectDebitPage";
import SuccessPage from "./SuccessPage";
import CancelPage from "./CancelPage";

function App() {
  return (
      <Routes>
        <Route path="/" element={<BacsDirectDebitPage />} />
        <Route path="/success" element={<SuccessPage />} />
        <Route path="/cancel" element={<CancelPage />} />
      </Routes>
  );
}

export default App;
