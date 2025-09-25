import React, { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Button, Card, Alert } from "antd";
import config from "./config";

const stripePromise = loadStripe(config.stripePublishableKey);

const BacsDirectDebitPage: React.FC = () => {
  const [status, setStatus] = useState<string | null>(null);

  const handleRedirect = async () => {
    setStatus("Redirecting to Stripe Checkout...");
    try {
      const checkoutResponse = await fetch(`${config.backendBaseUrl}/api/checkout/session`, {
        method: "POST"
      });
      const checkoutData = await checkoutResponse.json();

      if (!checkoutData.id) {
        setStatus("Error: Backend did not return a checkout session id");
        return;
      }

      const stripe = await stripePromise;
      const result = await stripe?.redirectToCheckout({ sessionId: checkoutData.id });

      if (result?.error) {
        setStatus("Error redirecting to Checkout: " + result.error.message);
      }
    } catch (err: any) {
      setStatus("Error starting checkout: " + err.message);
    }
  };

  const handleDirectDebitPayment = async () => {
    setStatus("Triggering backend-only Direct Debit payment of 50 GBP...");
    try {
      const response = await fetch(`${config.backendBaseUrl}/api/checkout/debit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 5000, currency: "gbp" }) // 50.00 GBP in pence
      });

      if (!response.ok) {
        setStatus("Backend returned an error during debit request");
        return;
      }

      setStatus("Backend accepted debit request. Payment will be processed asynchronously.");
    } catch (err: any) {
      setStatus("Error creating payment: " + err.message);
    }
  };

  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      width: "100%",
      minHeight: "100vh",
      background: "#f5f5f5",
      padding: "2rem",
      boxSizing: "border-box"
    }}>
      <Card style={{ maxWidth: 500, width: "100%", textAlign: "center" }}>
        <h2>BACS Direct Debit Setup</h2>
        <p>Click below to continue setting up your Direct Debit mandate through Stripe Checkout.</p>
        <Button type="primary" onClick={handleRedirect} block>
          Set up Direct Debit
        </Button>
        <Button style={{ marginTop: "1rem" }} onClick={handleDirectDebitPayment} block>
          Debit 50 GBP
        </Button>
        {status && <Alert message={status} type="info" showIcon style={{ marginTop: "1rem" }} />}
      </Card>
    </div>
  );
};

export default BacsDirectDebitPage;
