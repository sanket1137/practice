import LegalLayout from '../../components/legal/LegalLayout';

export default function RefundPolicy() {
  const sections = [
    { id: 'overview', title: '1. Overview' },
    { id: 'subscriptions', title: '2. Subscription Billing Refunds' },
    { id: 'credits-billing', title: '3. Campaign Credits & Billing Errors' },
    { id: 'downtime', title: '4. Platform & Screen Downtime' },
    { id: 'cancellations', title: '5. Campaign Cancellations' },
    { id: 'enterprise', title: '6. Enterprise & Custom Contracts' },
    { id: 'no-refunds', title: '7. Non-Refundable Items' },
    { id: 'request-process', title: '8. Refund Request Process' },
    { id: 'tax-gst', title: '9. Tax Handling & GST Refunds' },
    { id: 'chargebacks', title: '10. Chargebacks & Fraud Prevention' },
    { id: 'contact', title: '11. Contact Support' },
  ];

  return (
    <LegalLayout title="Cancellation & Refund Policy" lastUpdated="July 18, 2026" sections={sections}>
      
      {/* 1. Overview */}
      <section id="overview" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">1. Overview</h2>
        <p>
          This Cancellation and Refund Policy governs the financial terms for campaign bookings, subscription software plans, and technical services purchased on the PixelSpot platform.
        </p>
        <p>
          As a business-to-business (B2B) software-as-a-service and marketplace company operating under PIXELSPOT SOLUTIONS PRIVATE LIMITED, our pricing models are built on pre-allocated cloud resources, network reservations, and screen lease schedules. All transactions are handled in accordance with the terms below.
        </p>
      </section>

      {/* 2. Subscription Billing Refunds */}
      <section id="subscriptions" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">2. Subscription Billing Refunds</h2>
        <p>
          SaaS subscription licenses (Professional, Enterprise) grant instant access to layout tools, player management clients, and analytical dashboards:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-400">
          <li><strong>Monthly Plans:</strong> Payments for monthly licenses are non-refundable. When you cancel, your access continues until the end of the active monthly cycle, and auto-billing is deactivated.</li>
          <li><strong>Annual Plans:</strong> Cancelations within the first 14 calendar days of your initial annual subscription are eligible for a prorated refund (minus a 5% system processing fee). Cancelations requested after 14 days are non-refundable.</li>
        </ul>
      </section>

      {/* 3. Campaign Credits & Billing Errors */}
      <section id="credits-billing" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">3. Campaign Credits & Billing Errors</h2>
        <p>
          Terms regarding transaction errors, duplicates, and credit purchases:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-400">
          <li><strong>Unused Credits:</strong> Placed campaign credits are non-refundable once purchased. They hold a validity window of 365 days from the transaction date to book screen loops.</li>
          <li><strong>Failed / Duplicate Payments:</strong> In the event of a transaction glitch resulting in double charges, the duplicate amount is automatically returned to the original payment channel.</li>
          <li><strong>Billing Adjustments:</strong> If you identify errors on an invoice, you must raise a request within 30 days from the invoice date. Approved adjustments will be credited to your account wallet.</li>
        </ul>
      </section>

      {/* 4. Platform & Screen Downtime */}
      <section id="downtime" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">4. Platform & Screen Downtime</h2>
        <p>
          We verify playback loops utilizing player client diagnostics and log registers. If a physical display goes offline due to power loss, structural malfunction, or regional network failure:
        </p>
        <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-3">
          <p className="text-white font-medium">Prorated Refund Calculation:</p>
          <p className="text-sm text-gray-400">
            Approved refund credits are calculated dynamically based on missed play loops and actual screen downtime duration. Refunds are processed as:
          </p>
          <ul className="list-disc list-inside space-y-1 text-xs text-gray-500 pl-4">
            <li>Primary option: Replacement ad loops (make-good plays) on equivalent target displays.</li>
            <li>Alternative option: Wallet credits returned to your advertiser account balance.</li>
          </ul>
        </div>
      </section>

      {/* 5. Campaign Cancellations */}
      <section id="cancellations" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">5. Campaign Cancellations</h2>
        <p>
          Advertisers may cancel planned campaigns according to the schedules below:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse border border-white/10">
            <thead>
              <tr className="bg-white/5 text-white border-b border-white/10">
                <th className="p-3 border-r border-white/10">Cancellation Notice</th>
                <th className="p-3">Eligible Refund</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-white/10">
                <td className="p-3 border-r border-white/10">Greater than 48 hours prior to start</td>
                <td className="p-3 text-green-400">100% Refund (to Wallet)</td>
              </tr>
              <tr className="border-b border-white/10">
                <td className="p-3 border-r border-white/10">Between 24 and 48 hours prior to start</td>
                <td className="p-3 text-yellow-500">50% Refund (to Wallet)</td>
              </tr>
              <tr className="border-b border-white/10">
                <td className="p-3 border-r border-white/10">Less than 24 hours prior to start</td>
                <td className="p-3 text-red-500">No Refund (0%)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 6. Enterprise & Custom Contracts */}
      <section id="enterprise" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">6. Enterprise & Custom Contracts</h2>
        <p>
          Enterprise agreements, customized platform deployments, dedicated API servers, and professional custom development hours are bound by their specific master service agreements (MSA) and statement of work (SOW) documents. General refund parameters do not apply to these customized services.
        </p>
      </section>

      {/* 7. Non-Refundable Items */}
      <section id="no-refunds" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">7. Non-Refundable Items</h2>
        <p>
          PixelSpot does not issue refunds for charges related to:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-400">
          <li>Media encoding, cloud rendering, and format optimization services.</li>
          <li>Historical storage fees for creative media stored on our databases.</li>
          <li>Prorated balances for accounts terminated due to Content Policy violations.</li>
        </ul>
      </section>

      {/* 8. Refund Request Process */}
      <section id="request-process" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">8. Refund Request Process</h2>
        <p>
          To request a refund, submit a formal request via email to our billing desk:
        </p>
        <ol className="list-decimal list-inside space-y-2 text-gray-400">
          <li>Email <a href="mailto:contact@pixelspot.in" className="text-[var(--accent)] hover:underline font-medium">contact@pixelspot.in</a> containing your account name, transaction ID, invoice number, and explanation.</li>
          <li>Our audits team will verify campaign play logs, hardware status registers, and cloud server records within 5 business days.</li>
          <li>If approved, the amount will be processed to your account wallet or card payment method within 7-10 business days.</li>
        </ol>
      </section>

      {/* 9. Tax Handling & GST Refunds */}
      <section id="tax-gst" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">9. Tax Handling & GST Refunds</h2>
        <p>
          In accordance with Indian tax rules, GST collected on invoices is declared immediately to tax authorities. Refund processes for GST follow credit note procedures:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-400">
          <li>When a transaction is approved for a cash refund, a tax Credit Note will be generated.</li>
          <li>For GST-registered businesses, credit notes are updated in the GSTR-1 filings for adjustment.</li>
        </ul>
      </section>

      {/* 10. Chargebacks & Fraud Prevention */}
      <section id="chargebacks" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">10. Chargebacks & Fraud Prevention</h2>
        <p>
          Filing unauthorized payment disputes or card chargebacks is treated as transaction fraud. Accounts associated with active chargebacks are suspended, campaign deliveries are stopped, and outstanding invoices are sent to legal collections.
        </p>
      </section>

      {/* 11. Contact Support */}
      <section id="contact" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">11. Contact Support</h2>
        <p>
          If you have questions regarding refunds, contact our billing desk:
        </p>
        <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-2 text-sm text-gray-400">
          <p className="text-white font-medium">PIXELSPOT SOLUTIONS PRIVATE LIMITED</p>
          <p>Email: <a href="mailto:contact@pixelspot.in" className="text-[var(--accent)] hover:underline">contact@pixelspot.in</a></p>
          <p>Phone: +91 90826 04430</p>
        </div>
      </section>

    </LegalLayout>
  );
}
