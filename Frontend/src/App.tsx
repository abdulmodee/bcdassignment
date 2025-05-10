// App.tsx
import React from "react";
import { CssBaseline } from "@mui/material";
import Home from "./app/home";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import VotingPage from "./app/votingPage/page";
import { DiscoverWalletProviders } from "./components/DiscoverWalletProviders";
import CreateElectionPage from "./app/createElection/page";

function App() {
  return (
    <>
      <DiscoverWalletProviders />
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/votingPage" element={<VotingPage />} />
          <Route path="/createElection" element={<CreateElectionPage />} />
        </Routes>
      </Router>
    </>
  );
}

export default App;
