import { useState } from "react";
import "./App.css";
import Dashboard from "./pages/Dashboard";
import OperatorDashboard from "./pages/OperatorDashboard";

function App() {
  const [count, setCount] = useState(0);

  return (
    <>
      {/* <Dashboard /> */}
      <OperatorDashboard />
    </>
  );
}

export default App;
