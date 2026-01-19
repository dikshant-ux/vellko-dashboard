import { Routes, Route, Navigate } from "react-router-dom";
import AffiliateSignup from "./AffiliateSignup";

function App() {
  return (
    <Routes>
      <Route path="/affiliate_signup" element={<AffiliateSignup />} />
      <Route path="/" element={<Navigate to="/affiliate_signup" replace />} />
    </Routes>
  );
}

export default App;
