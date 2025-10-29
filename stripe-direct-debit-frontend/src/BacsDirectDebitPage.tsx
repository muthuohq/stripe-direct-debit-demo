import React, { useState } from "react";
import { Button, Card, Alert, Input, Checkbox, Space, Typography, Form } from "antd";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, useStripe } from "@stripe/react-stripe-js";
import config from "./config";

const { Title, Text } = Typography;

// Initialize Stripe
const stripePromise = loadStripe(config.stripePublishableKey);

interface FormData {
  name: string;
  email: string;
  resellerId: string;
  accountNumber: string;
  sortCode: string;
  addressLine1: string;
  city: string;
  postalCode: string;
}

// Inner component that uses Stripe hooks
const BacsDirectDebitForm: React.FC = () => {
  const stripe = useStripe();
  
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mandateAccepted, setMandateAccepted] = useState(false);
  const [mandateCreated, setMandateCreated] = useState(false);
  const [form] = Form.useForm();

  const [formData, setFormData] = useState<FormData>({
    name: "ohqtest",
    email: "ohqtest@mailinator.com",
    resellerId: "",
    accountNumber: "00012345",
    sortCode: "10-88-00",
    addressLine1: "Clavering House",
    city: "Tyne and Wear",
    postalCode: "NE1 3NG"
  });

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const formatSortCode = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    // Format as XX-XX-XX
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`;
  };

  const handleSortCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatSortCode(e.target.value);
    handleInputChange("sortCode", formatted);
  };

  const validateForm = () => {
    const { name, email, accountNumber, sortCode, addressLine1, city, postalCode } = formData;
    
    if (!name.trim()) {
      setStatus("Please enter your full name.");
      return false;
    }
    
    if (!email.trim() || !email.includes('@')) {
      setStatus("Please enter a valid email address.");
      return false;
    }
    
    if (!accountNumber.trim() || accountNumber.length < 6) {
      setStatus("Please enter a valid account number (at least 6 digits).");
      return false;
    }
    
    if (!sortCode.trim() || sortCode.replace(/\D/g, '').length !== 6) {
      setStatus("Please enter a valid sort code (6 digits).");
      return false;
    }
    
    if (!addressLine1.trim()) {
      setStatus("Please enter your address.");
      return false;
    }
    
    if (!city.trim()) {
      setStatus("Please enter your city.");
      return false;
    }
    
    if (!postalCode.trim()) {
      setStatus("Please enter your postal code.");
      return false;
    }
    
    if (!mandateAccepted) {
      setStatus("Please accept the Direct Debit mandate to continue.");
      return false;
    }
    
    return true;
  };

  const createSetupIntent = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setStatus("Creating Setup Intent...");
    
    try {
      // Only send non-sensitive customer data to our backend
      // Bank details will be sent directly to Stripe via Elements
      const response = await fetch(`${config.backendBaseUrl}/api/setupintent/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          resellerId: formData.resellerId
          // NOTE: Bank details (accountNumber, sortCode) are NOT sent to our backend
          // They will be handled securely by Stripe Elements
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.clientSecret) {
        setStatus("✅ Setup Intent created! Now confirming with bank details...");
        
        // Automatically proceed to confirm the setup intent with Stripe Elements
        await confirmSetupIntent(data.clientSecret);
      } else {
        setStatus("Failed to create Setup Intent: " + (data.error || "Unknown error"));
        setIsLoading(false);
      }
    } catch (error: any) {
      setStatus("❌ Error creating Setup Intent: " + error.message);
      setIsLoading(false);
    }
  };

  const confirmSetupIntent = async (secret: string) => {
    if (!stripe) {
      setStatus("❌ Stripe not loaded");
      setIsLoading(false);
      return;
    }

    setStatus("🔐 Securely confirming Setup Intent with bank details via Stripe...");

    try {
      // Clean sort code (remove dashes) - validation only, data goes directly to Stripe
      const cleanSortCode = formData.sortCode.replace(/\D/g, '');

      // PCI Compliant: Bank details are sent directly to Stripe, never to our servers
      const { error, setupIntent } = await stripe.confirmBacsDebitSetup(secret, {
        payment_method: {
          bacs_debit: {
            account_number: formData.accountNumber,
            sort_code: cleanSortCode,
          },
          billing_details: {
            name: formData.name,
            email: formData.email,
            address: {
              line1: formData.addressLine1,
              city: formData.city,
              postal_code: formData.postalCode,
              country: 'GB',
            },
          },
        },
      });

      if (error) {
        console.error('Stripe Setup Intent Error:', error.type, error.code);
        setStatus(`❌ Setup failed: ${error.message}`);
        setIsLoading(false);
      } else if (setupIntent) {
        console.log('Setup Intent Status:', setupIntent.status);
        
        switch (setupIntent.status) {
          case 'succeeded':
            setStatus("✅ BACS Direct Debit mandate created successfully! You can now process payments.");
            setMandateCreated(true);
            break;
          case 'processing':
            setStatus("🔄 Setup Intent is processing. This may take a few moments...");
            break;
          case 'requires_action':
            setStatus("⚠️ Additional action required to complete setup.");
            break;
          default:
            setStatus(`ℹ️ Setup Intent status: ${setupIntent.status}`);
        }
        setIsLoading(false);
      }
    } catch (error: any) {
      console.error('Setup Intent Confirmation Error:', error);
      setStatus("❌ Error confirming Setup Intent: " + error.message);
      setIsLoading(false);
    }
  };

  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number>(5000); // Default to £50

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
      <Card style={{ maxWidth: 600, width: "100%", textAlign: "left" }}>
        <Title level={2} style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          BACS Direct Debit Setup
        </Title>
        
        <Text type="secondary" style={{ display: "block", marginBottom: "2rem", textAlign: "center" }}>
          Set up a Direct Debit mandate using Stripe Elements to authorize future payments from your UK bank account.
        </Text>

        <Form form={form} layout="vertical" disabled={mandateCreated}>
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            {/* Customer Information */}
            <div>
              <Title level={4}>Customer Information</Title>
              <Space direction="vertical" style={{ width: "100%" }}>
                <Input
                  placeholder="Full Name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  size="large"
                  required
                />
                <Input
                  placeholder="Email Address"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  size="large"
                  required
                />
                <Input
                  placeholder="Reseller ID (optional)"
                  value={formData.resellerId}
                  onChange={(e) => handleInputChange("resellerId", e.target.value)}
                  size="large"
                />
              </Space>
            </div>

            {/* Billing Address */}
            <div>
              <Title level={4}>Billing Address</Title>
              <Space direction="vertical" style={{ width: "100%" }}>
                <Input
                  placeholder="Address Line 1"
                  value={formData.addressLine1}
                  onChange={(e) => handleInputChange("addressLine1", e.target.value)}
                  size="large"
                  required
                />
                <Input
                  placeholder="City"
                  value={formData.city}
                  onChange={(e) => handleInputChange("city", e.target.value)}
                  size="large"
                  required
                />
                <Input
                  placeholder="Postal Code"
                  value={formData.postalCode}
                  onChange={(e) => handleInputChange("postalCode", e.target.value.toUpperCase())}
                  size="large"
                  maxLength={8}
                  required
                />
              </Space>
            </div>

            {/* Bank Account Details */}
            <div>
              <Title level={4}>Bank Account Details</Title>
              <Space direction="vertical" style={{ width: "100%" }}>
                <Input
                  placeholder="Account Number"
                  value={formData.accountNumber}
                  onChange={(e) => handleInputChange("accountNumber", e.target.value.replace(/\D/g, ''))}
                  size="large"
                  maxLength={8}
                  required
                />
                <Input
                  placeholder="Sort Code (XX-XX-XX)"
                  value={formData.sortCode}
                  onChange={handleSortCodeChange}
                  size="large"
                  maxLength={8}
                  required
                />
              </Space>
            </div>

            {/* Direct Debit Mandate Agreement */}
            <div>
              <Checkbox
                checked={mandateAccepted}
                onChange={(e) => setMandateAccepted(e.target.checked)}
                disabled={mandateCreated}
              >
                <Text>
                  I authorize you to collect payments from my account via Direct Debit. 
                  I understand that this authorization will remain in effect until I cancel it.
                  I have read and agree to the Direct Debit Guarantee below.
                </Text>
              </Checkbox>
            </div>

            {/* Create Mandate Button */}
            {!mandateCreated && (
              <Button
                type="primary"
                size="large"
                block
                onClick={createSetupIntent}
                loading={isLoading}
                disabled={!mandateAccepted}
              >
                Create Direct Debit Mandate
              </Button>
            )}
          </Space>
        </Form>

        {/* Direct Debit Guarantee */}
        <div style={{ 
          fontSize: "12px", 
          color: "#666", 
          marginTop: "2rem", 
          padding: "1rem", 
          backgroundColor: "#f9f9f9", 
          borderRadius: "4px" 
        }}>
          <Text strong>Direct Debit Guarantee</Text>
          <br />
          <Text style={{ fontSize: "11px" }}>
            This Guarantee is offered by all banks and building societies that accept instructions to pay Direct Debits.
            If there are any changes to the amount, date or frequency of your Direct Debit, we will notify you 10 working days in advance of your account being debited or as otherwise agreed.
            If you request us to collect a payment, confirmation of the amount and date will be given to you at the time of the request.
            If an error is made in the payment of your Direct Debit, by us or your bank or building society, you are entitled to a full and immediate refund of the amount paid from your bank or building society.
            If you receive a refund you are not entitled to, you must pay it back when we ask you to.
            You can cancel a Direct Debit at any time by simply contacting your bank or building society. Written confirmation may be required. Please also notify us.
          </Text>
        </div>

        {status && (
          <Alert 
            message={status} 
            type={status.includes("❌") ? "error" : status.includes("✅") ? "success" : "info"} 
            showIcon 
            style={{ marginTop: "1rem" }} 
          />
        )}
      </Card>

      {/* Test Payment Panel - Only shown after mandate is created */}
      {mandateCreated && (
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
                Select Amount:
              </Text>
              <Space direction="horizontal" size="middle" wrap style={{ width: "100%" }}>
                <Button
                  type={selectedAmount === 1000 ? "primary" : "default"}
                  size="large"
                  onClick={() => setSelectedAmount(1000)}
                >
                  £10.00
                </Button>
                <Button
                  type={selectedAmount === 2500 ? "primary" : "default"}
                  size="large"
                  onClick={() => setSelectedAmount(2500)}
                >
                  £25.00
                </Button>
                <Button
                  type={selectedAmount === 5000 ? "primary" : "default"}
                  size="large"
                  onClick={() => setSelectedAmount(5000)}
                  style={selectedAmount === 5000 ? { backgroundColor: "#52c41a", borderColor: "#52c41a" } : {}}
                >
                  £50.00
                </Button>
                <Button
                  type={selectedAmount === 10000 ? "primary" : "default"}
                  size="large"
                  onClick={() => setSelectedAmount(10000)}
                >
                  £100.00
                </Button>
              </Space>
            </div>

            <div>
              <Button
                type="primary"
                size="large"
                block
                onClick={() => handleTestPayment(selectedAmount)}
                loading={isPaymentLoading}
                style={{ backgroundColor: "#1890ff", borderColor: "#1890ff" }}
              >
                💳 Debit £{(selectedAmount / 100).toFixed(2)} GBP
              </Button>
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

// Main component with Stripe Elements provider
const BacsDirectDebitPage: React.FC = () => {
  return (
    <Elements stripe={stripePromise}>
      <BacsDirectDebitForm />
    </Elements>
  );
};

export default BacsDirectDebitPage;
