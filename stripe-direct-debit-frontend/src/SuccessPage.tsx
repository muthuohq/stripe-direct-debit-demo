import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import config from "./config";

const SuccessPage: React.FC = () => {
  const [status, setStatus] = useState<string>("Processing mandate...");
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sessionId = params.get("session_id");

    if (sessionId) {
      fetch(`${config.backendBaseUrl}/api/checkout/process-session?sessionId=${sessionId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setStatus(`Mandate setup confirmed. Mandate ID: ${data.mandateId}`);
          } else {
            setStatus("Failed to process the mandate.");
          }
        })
        .catch(() => setStatus("Error contacting backend to process the session."));
    } else {
      setStatus("No session ID returned from Stripe.");
    }
  }, [location.search]);

  return (
    <div style={{ padding: "2rem" }}>
      <h2>Direct Debit Setup - Success</h2>
      <p>{status}</p>
    </div>
  );
};

export default SuccessPage;