import React, { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { Button, Card } from "antd";
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
    <div style={{ padding: "2rem", display: "flex", justifyContent: "center" }}>
      <Card
        title="Direct Debit Setup - Success"
        bordered={false}
        style={{ width: 500, textAlign: "center", backgroundColor: "#f6ffed", borderColor: "#b7eb8f" }}
      >
        <p>{status}</p>
        <Link to="/">
          <Button type="primary" style={{ marginTop: "16px" }}>
            Return Home
          </Button>
        </Link>
      </Card>
    </div>
  );
};

export default SuccessPage;