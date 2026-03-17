import { useLocation } from "wouter";
import { Starfield, LandingNav, LandingFooter, SHARED_CSS } from "./landing-shared";

export default function PrivacyPolicy() {
  const [location] = useLocation();
  return (
    <div style={{ minHeight: "100vh", background: "#000" }}>
      <style>{SHARED_CSS}</style>
      <Starfield />
      <div style={{ position: "relative", zIndex: 1 }}>
        <LandingNav activePath={location} />
        <div style={{
          maxWidth: "900px", margin: "0 auto", padding: "60px 20px", color: "#ccc", lineHeight: 1.8, fontSize: 15
        }}>
          <h1 style={{ fontSize: 42, color: "#fff", marginBottom: 40, textAlign: "center", fontFamily: "monospace", letterSpacing: 2 }}>
            PRIVACY POLICY
          </h1>

          <div style={{ background: "rgba(30,60,120,0.15)", border: "1px solid rgba(100,160,255,0.3)", padding: 24, borderRadius: 8, marginBottom: 40 }}>
            <p style={{ fontSize: 13, color: "rgba(200,220,255,0.8)", margin: 0 }}>
              Last Updated: March 17, 2026 | Effective: March 17, 2026
            </p>
          </div>

          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 24, color: "#96c8ff", marginBottom: 16, fontFamily: "monospace", letterSpacing: 1 }}>
              1. INTRODUCTION
            </h2>
            <p>
              Frontier ("we," "our," "us," or "Company") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our game and blockchain platform.
            </p>
            <p>
              Please read this Privacy Policy carefully. If you do not agree with our policies and practices, please do not use our Service. Your continued use of the Service following the posting of revised Privacy Policy means that you accept and agree to the changes.
            </p>
          </section>

          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 24, color: "#96c8ff", marginBottom: 16, fontFamily: "monospace", letterSpacing: 1 }}>
              2. INFORMATION WE COLLECT
            </h2>
            
            <h3 style={{ fontSize: 18, color: "rgba(200,220,255,0.9)", marginBottom: 12 }}>Information Provided by You:</h3>
            <ul style={{ marginLeft: 20, marginBottom: 16 }}>
              <li><strong>Wallet Address:</strong> Your blockchain wallet address when you connect to the game</li>
              <li><strong>Profile Information:</strong> Player name, avatar selection, and game preferences</li>
              <li><strong>Communication Data:</strong> Messages, reports, and correspondence with our support team</li>
              <li><strong>Transaction Data:</strong> Records of in-game purchases, trades, and blockchain interactions</li>
            </ul>

            <h3 style={{ fontSize: 18, color: "rgba(200,220,255,0.9)", marginBottom: 12 }}>Information Collected Automatically:</h3>
            <ul style={{ marginLeft: 20, marginBottom: 16 }}>
              <li><strong>Usage Data:</strong> Game actions, interactions, gameplay duration, and player behavior</li>
              <li><strong>Device Information:</strong> Browser type, device type, IP address, and operating system</li>
              <li><strong>Cookies and Tracking:</strong> Session data, preferences, and analytics tracking (with your consent)</li>
              <li><strong>Blockchain Data:</strong> Transaction history, asset ownership, and on-chain activity associated with your address</li>
            </ul>

            <h3 style={{ fontSize: 18, color: "rgba(200,220,255,0.9)", marginBottom: 12 }}>Blockchain-Specific Data:</h3>
            <p>
              Because Frontier is built on the Algorand blockchain, certain information is inherently public and immutable. This includes your wallet address, transaction amounts, and blockchain interactions. This data is stored on decentralized ledgers and cannot be deleted.
            </p>
          </section>

          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 24, color: "#96c8ff", marginBottom: 16, fontFamily: "monospace", letterSpacing: 1 }}>
              3. HOW WE USE YOUR INFORMATION
            </h2>
            <ul style={{ marginLeft: 20 }}>
              <li>To operate, maintain, and improve the Service</li>
              <li>To enable multiplayer gameplay and faction interactions</li>
              <li>To process transactions and manage game economy</li>
              <li>To send administrative information and account updates</li>
              <li>To respond to inquiries and provide customer support</li>
              <li>To prevent fraud, abuse, and enforce our Terms of Service</li>
              <li>To analyze usage patterns and improve game design</li>
              <li>To comply with legal obligations and regulations (including KYC/AML where required)</li>
              <li>To send marketing communications (with your opt-in consent)</li>
            </ul>
          </section>

          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 24, color: "#96c8ff", marginBottom: 16, fontFamily: "monospace", letterSpacing: 1 }}>
              4. DATA SHARING AND DISCLOSURE
            </h2>
            <p>
              We do not sell, trade, or rent your personal information to third parties. However, we may share information in these cases:
            </p>
            <ul style={{ marginLeft: 20 }}>
              <li><strong>Service Providers:</strong> Third parties that assist with hosting, analytics, payment processing, and customer support</li>
              <li><strong>Blockchain Data:</strong> Your wallet address and transactions are publicly visible on the Algorand blockchain by design</li>
              <li><strong>Legal Compliance:</strong> When required by law, court order, or to protect our rights and safety</li>
              <li><strong>Business Transfers:</strong> In the event of merger, acquisition, or bankruptcy</li>
              <li><strong>With Consent:</strong> When you explicitly authorize sharing with specific parties</li>
            </ul>
          </section>

          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 24, color: "#96c8ff", marginBottom: 16, fontFamily: "monospace", letterSpacing: 1 }}>
              5. COOKIES AND TRACKING TECHNOLOGIES
            </h2>
            <p>
              We use cookies and similar technologies to:
            </p>
            <ul style={{ marginLeft: 20, marginBottom: 16 }}>
              <li>Remember your preferences and login information</li>
              <li>Understand how you use our Service</li>
              <li>Deliver personalized content and advertisements</li>
              <li>Improve security and prevent fraud</li>
            </ul>
            <p>
              You have the right to accept or reject cookies. We display a consent banner on your first visit, and you can manage preferences in your browser settings. Rejecting certain cookies may limit Service functionality.
            </p>
          </section>

          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 24, color: "#96c8ff", marginBottom: 16, fontFamily: "monospace", letterSpacing: 1 }}>
              6. DATA SECURITY
            </h2>
            <p>
              We implement industry-standard security measures to protect your information from unauthorized access, alteration, and destruction. However, no method of transmission is 100% secure. While we strive to use commercially acceptable means to protect your data, we cannot guarantee absolute security.
            </p>
            <p>
              Blockchain transactions are cryptographically secured and immutable, but we recommend using strong passwords and enabling two-factor authentication on your wallet.
            </p>
          </section>

          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 24, color: "#96c8ff", marginBottom: 16, fontFamily: "monospace", letterSpacing: 1 }}>
              7. YOUR RIGHTS AND CHOICES
            </h2>
            <ul style={{ marginLeft: 20 }}>
              <li><strong>Access:</strong> You can request access to personal data we hold about you</li>
              <li><strong>Correction:</strong> You can request correction of inaccurate information</li>
              <li><strong>Deletion:</strong> You can request deletion of your account and associated data (except blockchain transactions)</li>
              <li><strong>Marketing:</strong> You can opt out of promotional emails and communications</li>
              <li><strong>Data Portability:</strong> You can request your data in a portable format</li>
            </ul>
            <p style={{ marginTop: 16 }}>
              To exercise these rights, contact us at <a href="mailto:privacy@frontier.game" style={{ color: "#96c8ff" }}>privacy@frontier.game</a>
            </p>
          </section>

          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 24, color: "#96c8ff", marginBottom: 16, fontFamily: "monospace", letterSpacing: 1 }}>
              8. INTERNATIONAL DATA TRANSFERS
            </h2>
            <p>
              Your information may be transferred to, processed, and stored in countries other than your country of residence, which may have different data protection laws. By using Frontier, you consent to the transfer of your information to countries outside your country of residence.
            </p>
          </section>

          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 24, color: "#96c8ff", marginBottom: 16, fontFamily: "monospace", letterSpacing: 1 }}>
              9. RETENTION OF DATA
            </h2>
            <p>
              We retain your personal information for as long as necessary to provide the Service and fulfill the purposes outlined in this Privacy Policy. Blockchain data, including transaction records and wallet addresses, cannot be deleted as they are stored on the public ledger.
            </p>
          </section>

          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 24, color: "#96c8ff", marginBottom: 16, fontFamily: "monospace", letterSpacing: 1 }}>
              10. CONTENT OWNERSHIP AND INTELLECTUAL PROPERTY
            </h2>
            <p>
              All content within Frontier, including game design, artwork, narrative, code, and platform infrastructure, is the exclusive property of Frontier or our licensors. You are granted a limited, non-exclusive, non-transferable license to use the Service solely for personal, non-commercial purposes.
            </p>
            <p>
              <strong>You may not:</strong>
            </p>
            <ul style={{ marginLeft: 20 }}>
              <li>Reproduce, distribute, or transmit any game content without explicit permission</li>
              <li>Scrape, copy, or extract game data for unauthorized use</li>
              <li>Create derivative works or reverse-engineer any game systems</li>
              <li>Claim ownership of any game assets or intellectual property</li>
            </ul>
            <p style={{ marginTop: 16 }}>
              All in-game assets, including land plots, characters, and items, are digital goods licensed to you but remain the property of Frontier. Your blockchain-based ownership is limited to the smart contract's terms.
            </p>
            <p>
              © 2026 Frontier. All Rights Reserved.
            </p>
          </section>

          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 24, color: "#96c8ff", marginBottom: 16, fontFamily: "monospace", letterSpacing: 1 }}>
              11. THIRD-PARTY LINKS
            </h2>
            <p>
              Frontier may contain links to third-party websites. We are not responsible for the privacy practices of these websites. We encourage you to review their privacy policies before providing any personal information.
            </p>
          </section>

          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 24, color: "#96c8ff", marginBottom: 16, fontFamily: "monospace", letterSpacing: 1 }}>
              12. CHILDREN'S PRIVACY
            </h2>
            <p>
              Frontier is not directed to individuals under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that a child has provided us with personal information, we will delete such information immediately.
            </p>
          </section>

          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 24, color: "#96c8ff", marginBottom: 16, fontFamily: "monospace", letterSpacing: 1 }}>
              13. CONTACT US
            </h2>
            <p>
              If you have questions about this Privacy Policy or our privacy practices, please contact us:
            </p>
            <div style={{ background: "rgba(30,60,120,0.15)", border: "1px solid rgba(100,160,255,0.3)", padding: 20, borderRadius: 8, marginTop: 16 }}>
              <p><strong>Email:</strong> <a href="mailto:privacy@frontier.game" style={{ color: "#96c8ff" }}>privacy@frontier.game</a></p>
              <p><strong>Twitter/X:</strong> <a href="https://x.com/ascendancyalgox" style={{ color: "#96c8ff" }} target="_blank" rel="noopener noreferrer">@ascendancyalgox</a></p>
            </div>
          </section>

          <section>
            <h2 style={{ fontSize: 24, color: "#96c8ff", marginBottom: 16, fontFamily: "monospace", letterSpacing: 1 }}>
              14. POLICY UPDATES
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of significant changes via email or prominent notice on the Service. Your continued use following such notice constitutes acceptance of the updated Privacy Policy.
            </p>
          </section>
        </div>
        <LandingFooter />
      </div>
    </div>
  );
}
