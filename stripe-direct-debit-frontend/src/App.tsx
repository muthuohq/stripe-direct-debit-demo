import { Routes, Route } from "react-router-dom";
import { Layout } from "antd";
import "./App.css";
import BacsDirectDebitPage from "./BacsDirectDebitPage";
import SuccessPage from "./SuccessPage";
import CancelPage from "./CancelPage";

const { Header, Content } = Layout;

function App() {
  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#7968c4ff",
          padding: "0 24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <img
            src="/logo.jpg"
            alt="ReceptionHQ Logo"
            style={{ height: 40, marginRight: 12 }}
          />
          <h1 style={{ color: "white", margin: 0, fontSize: "1.5rem" }}>
            Client Portal V2 Mock
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ color: "white" }}>demo@receptionhq.com</span>
          <a href="#" style={{ color: "#ff4d4f" }}>Logout</a>
        </div>
      </Header>
      <Content style={{ padding: "24px" }}>
        <Routes>
          <Route path="/" element={<BacsDirectDebitPage />} />
          <Route path="/success" element={<SuccessPage />} />
          <Route path="/cancel" element={<CancelPage />} />
        </Routes>
      </Content>
    </Layout>
  );
}

export default App;
