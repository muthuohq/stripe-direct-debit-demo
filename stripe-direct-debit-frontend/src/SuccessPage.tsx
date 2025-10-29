import React, { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { Button, Card, Alert, Space, Typography } from "antd";
import config from "./config";

const { Title, Text } = Typography;

const SuccessPage: React.FC = () => {
  const [status, setStatus] = useState<string>("Processing mandate setup...");
  const [mandateConfirmed, setMandateConfirmed] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sessionId = params.get("session_id");

    if (sessionId) {
      fetch(`${config.backendBaseUrl}/api/setupintent/confirm-setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setStatus(`✅ Mandate setup confirmed successfully!\nMandate ID: ${data.mandateId}\nPayment Method: ${data.paymentMethodId}`);
            setMandateConfirmed(true);
          } else {
            setStatus("❌ Failed to confirm the mandate setup.");
          }
        })
        .catch(() => setStatus("❌ Error contacting backend to confirm the setup."));
    } else {
      setStatus("❌ No session ID returned from Stripe.");
    }
  }, [location.search]);

  const handleTestPayment = async (amount: number) => {
    setIsPaymentLoading(true);
    setPaymentStatus(`Creating test payment of £${(amount / 100).toFixed(2)}...`);
    try {
      const response = await fetch(`${config.backendBaseUrl}/api/checkout/debit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amount, currency: "gbp" })
      });

      if (!response.ok) {
        const errorData = await response.json();
        setPaymentStatus("❌ Payment failed: " + (errorData.error || "Unknown error"));
        setIsPaymentLoading(false);
        return;
      }

      const data = await response.json();
      setPaymentStatus(`✅ Test payment created successfully!\nPayment Intent ID: ${data.id}\nAmount: £${(data.amount / 100).toFixed(2)}\nStatus: ${data.status || 'processing'}`);
    } catch (err: any) {
      setPaymentStatus("❌ Error creating payment: " + err.message);
    } finally {
      setIsPaymentLoading(false);
    }
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      width: "100%",
      minHeight: "100vh",
      background: "#f5f5f5",
      padding: "2rem",
      boxSizing: "border-box",
      gap: "2rem"
    }}>
      <Card
        style={{ 
          width: "100%", 
          maxWidth: 600, 
          textAlign: "center", 
          backgroundColor: mandateConfirmed ? "#f6ffed" : "#fff", 
          borderColor: mandateConfirmed ? "#b7eb8f" : "#d9d9d9" 
        }}
      >
        <Title level={2}>Direct Debit Setup</Title>
        <Alert 
          message={status} 
          type={mandateConfirmed ? "success" : "info"} 
          showIcon 
          style={{ marginBottom: "1rem", whiteSpace: "pre-line" }}
        />
        <Link to="/">
          <Button type="default" size="large">
            Return Home
          </Button>
        </Link>
      </Card>

      {/* Test Payment Panel - Only shown after mandate is confirmed */}
      {mandateConfirmed && (
        <Card style={{ maxWidth: 600, width: "100%", textAlign: "left" }}>
          <Title level={3} style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            Test Payments
          </Title>
          
          <Text type="secondary" style={{ display: "block", marginBottom: "2rem", textAlign: "center" }}>
            Test the BACS Direct Debit mandate by creating sample payments.
          </Text>

          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <div>
              <Text strong style={{ display: "block", marginBottom: "1rem" }}>
                Quick Test Amounts:
              </Text>
              <Space direction="horizontal" size="middle" wrap style={{ width: "100%" }}>
                <Button
                  type="default"
                  size="large"
                  onClick={() => handleTestPayment(1000)}
                  loading={isPaymentLoading}
                >
                  £10.00
                </Button>
                <Button
                  type="default"
                  size="large"
                  onClick={() => handleTestPayment(2500)}
                  loading={isPaymentLoading}
                >
                  £25.00
                </Button>
                <Button
                  type="primary"
                  size="large"
                  onClick={() => handleTestPayment(5000)}
                  loading={isPaymentLoading}
                  style={{ backgroundColor: "#52c41a", borderColor: "#52c41a" }}
                >
                  £50.00
                </Button>
                <Button
                  type="default"
                  size="large"
                  onClick={() => handleTestPayment(10000)}
                  loading={isPaymentLoading}
                >
                  £100.00
                </Button>
              </Space>
            </div>

            {paymentStatus && (
              <Alert 
                message={paymentStatus} 
                type={paymentStatus.includes("❌") ? "error" : paymentStatus.includes("✅") ? "success" : "info"} 
                showIcon 
                style={{ whiteSpace: "pre-line" }}
              />
            )}
          </Space>
        </Card>
      )}
    </div>
  );
};

export default SuccessPage;