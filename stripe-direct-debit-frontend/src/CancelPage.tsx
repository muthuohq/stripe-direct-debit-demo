import React from "react";

const CancelPage: React.FC = () => {
  return (
    <div style={{ padding: "2rem" }}>
      <h2>Direct Debit Setup - Cancelled</h2>
      <p>You cancelled the BACS Direct Debit setup process. If this was unintentional, please try again.</p>
    </div>
  );
};

export default CancelPage;