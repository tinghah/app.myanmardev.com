import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@nanostores/react';
import { $authState } from '../stores/authStore';
import { createTokenOrder, TOKEN_PACKAGES } from '../lib/orders';
import { getExchangeRate } from '../lib/exchange-rate';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'package' | 'currency' | 'method';
type Currency = 'MMK' | 'USDT';
type PaymentMethod = 'binance' | 'blockchain' | 'kbz' | 'wave' | 'aya' | 'cb' | 'bank';

export default function BuyTokensModal({ isOpen, onClose, onSuccess }: Props) {
  const { user, profile } = useStore($authState);
  const [step, setStep] = useState<Step>('package');
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
  const [currency, setCurrency] = useState<Currency | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setStep('package');
    setSelectedPackage(null);
    setCurrency(null);
    setPaymentMethod(null);
    setError(null);
    setSuccess(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!user || !profile || selectedPackage === null || !paymentMethod) return;

    const pkg = TOKEN_PACKAGES[selectedPackage];
    setLoading(true);
    setError(null);

    try {
      await createTokenOrder(
        user.uid,
        profile.email,
        pkg.tokens,
        pkg.priceUSD,
        paymentMethod
      );

      setSuccess(true);
      onSuccess();

      setTimeout(() => {
        handleClose();
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to create order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderPackageSelection = () => (
    <>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🪙</div>
        <h2 style={{ fontFamily: 'var(--display)', fontSize: '1.25rem', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Buy Tokens</h2>
        <p style={{ fontFamily: 'var(--body)', fontSize: '0.8125rem', color: 'var(--muted)', margin: '0.4rem 0 0' }}>Select a token package</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.625rem', marginBottom: '1.25rem' }}>
        {TOKEN_PACKAGES.map((pkg, index) => (
          <button
            key={index}
            onClick={() => setSelectedPackage(index)}
            style={{
              padding: '0.875rem',
              background: selectedPackage === index ? 'var(--glow)' : 'var(--base)',
              border: `1px solid ${selectedPackage === index ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: '8px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ fontFamily: 'var(--mono)', fontSize: '0.625rem', fontWeight: 600, color: selectedPackage === index ? 'var(--accent)' : 'var(--muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>{pkg.label}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--ink)', marginBottom: '0.15rem' }}>{pkg.tokens} Tokens</div>
            <div style={{ fontFamily: 'var(--body)', fontSize: '0.8125rem', color: 'var(--muted)' }}>${pkg.priceUSD.toFixed(2)} USD</div>
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.625rem' }}>
        <button onClick={handleClose} style={{ flex: 1, padding: '0.7rem', background: 'transparent', color: 'var(--ink)', border: '1px solid var(--border)', borderRadius: '6px', fontFamily: 'var(--mono)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
        <button
          onClick={() => setStep('currency')}
          disabled={selectedPackage === null}
          style={{ flex: 2, padding: '0.7rem', background: selectedPackage === null ? 'var(--surface)' : 'var(--accent)', color: selectedPackage === null ? 'var(--muted)' : 'var(--base)', border: 'none', borderRadius: '6px', fontFamily: 'var(--mono)', fontSize: '0.75rem', fontWeight: 600, cursor: selectedPackage === null ? 'not-allowed' : 'pointer' }}
        >
          Next
        </button>
      </div>
    </>
  );

  const renderCurrencySelection = () => (
    <>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontFamily: 'var(--display)', fontSize: '1.25rem', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Select Currency</h2>
        <p style={{ fontFamily: 'var(--body)', fontSize: '0.8125rem', color: 'var(--muted)', margin: '0.4rem 0 0' }}>How would you like to pay?</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <button onClick={() => setCurrency('MMK')} style={{ padding: '1rem', background: currency === 'MMK' ? 'var(--glow)' : 'var(--base)', border: `1px solid ${currency === 'MMK' ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '8px', cursor: 'pointer', textAlign: 'left' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '1rem', fontWeight: 700, color: 'var(--ink)', marginBottom: '0.25rem' }}>🇲🇲 Local MMK</div>
          <div style={{ fontFamily: 'var(--body)', fontSize: '0.8125rem', color: 'var(--muted)' }}>Pay with KBZPay, WavePay, AYA, CB or Bank Transfer</div>
        </button>
        <button onClick={() => setCurrency('USDT')} style={{ padding: '1rem', background: currency === 'USDT' ? 'var(--glow)' : 'var(--base)', border: `1px solid ${currency === 'USDT' ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '8px', cursor: 'pointer', textAlign: 'left' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '1rem', fontWeight: 700, color: 'var(--ink)', marginBottom: '0.25rem' }}>🪙 Crypto USDT</div>
          <div style={{ fontFamily: 'var(--body)', fontSize: '0.8125rem', color: 'var(--muted)' }}>Pay with Binance Pay or Blockchain Wallets</div>
        </button>
      </div>
      <div style={{ display: 'flex', gap: '0.625rem' }}>
        <button onClick={() => setStep('package')} style={{ flex: 1, padding: '0.7rem', background: 'transparent', color: 'var(--ink)', border: '1px solid var(--border)', borderRadius: '6px', fontFamily: 'var(--mono)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Back</button>
        <button
          onClick={() => setStep('method')}
          disabled={currency === null}
          style={{ flex: 2, padding: '0.7rem', background: currency === null ? 'var(--surface)' : 'var(--accent)', color: currency === null ? 'var(--muted)' : 'var(--base)', border: 'none', borderRadius: '6px', fontFamily: 'var(--mono)', fontSize: '0.75rem', fontWeight: 600, cursor: currency === null ? 'not-allowed' : 'pointer' }}
        >
          Next
        </button>
      </div>
    </>
  );

  const renderMethodSelection = () => {
    const pkg = selectedPackage !== null ? TOKEN_PACKAGES[selectedPackage] : null;
    const mmkPrice = pkg ? (pkg.priceUSD * getExchangeRate()).toLocaleString() : 0;
    const usdPrice = pkg ? pkg.priceUSD.toFixed(2) : 0;

    return (
      <>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontFamily: 'var(--display)', fontSize: '1.25rem', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Payment Details</h2>
          <p style={{ fontFamily: 'var(--body)', fontSize: '0.8125rem', color: 'var(--muted)', margin: '0.4rem 0 0' }}>Total: {currency === 'MMK' ? `${mmkPrice} MMK` : `$${usdPrice} USDT`}</p>
        </div>
        
        <div style={{ marginBottom: '1.5rem' }}>
          {currency === 'USDT' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button onClick={() => setPaymentMethod('binance')} style={{ padding: '0.75rem', background: paymentMethod === 'binance' ? 'var(--glow)' : 'var(--surface)', border: `1px solid ${paymentMethod === 'binance' ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '6px', cursor: 'pointer', textAlign: 'left', fontWeight: 600, color: 'var(--ink)' }}>Binance Pay</button>
              <button onClick={() => setPaymentMethod('blockchain')} style={{ padding: '0.75rem', background: paymentMethod === 'blockchain' ? 'var(--glow)' : 'var(--surface)', border: `1px solid ${paymentMethod === 'blockchain' ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '6px', cursor: 'pointer', textAlign: 'left', fontWeight: 600, color: 'var(--ink)' }}>Blockchain Wallet (TRC-20/ERC-20)</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button onClick={() => setPaymentMethod('kbz')} style={{ padding: '0.75rem', background: paymentMethod === 'kbz' ? 'var(--glow)' : 'var(--surface)', border: `1px solid ${paymentMethod === 'kbz' ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '6px', cursor: 'pointer', textAlign: 'left', fontWeight: 600, color: 'var(--ink)' }}>KBZ Pay</button>
              <button onClick={() => setPaymentMethod('wave')} style={{ padding: '0.75rem', background: paymentMethod === 'wave' ? 'var(--glow)' : 'var(--surface)', border: `1px solid ${paymentMethod === 'wave' ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '6px', cursor: 'pointer', textAlign: 'left', fontWeight: 600, color: 'var(--ink)' }}>Wave Pay</button>
              <button onClick={() => setPaymentMethod('aya')} style={{ padding: '0.75rem', background: paymentMethod === 'aya' ? 'var(--glow)' : 'var(--surface)', border: `1px solid ${paymentMethod === 'aya' ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '6px', cursor: 'pointer', textAlign: 'left', fontWeight: 600, color: 'var(--ink)' }}>AYA Pay</button>
              <button onClick={() => setPaymentMethod('cb')} style={{ padding: '0.75rem', background: paymentMethod === 'cb' ? 'var(--glow)' : 'var(--surface)', border: `1px solid ${paymentMethod === 'cb' ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '6px', cursor: 'pointer', textAlign: 'left', fontWeight: 600, color: 'var(--ink)' }}>CB Pay</button>
              <button onClick={() => setPaymentMethod('bank')} style={{ padding: '0.75rem', gridColumn: '1 / -1', background: paymentMethod === 'bank' ? 'var(--glow)' : 'var(--surface)', border: `1px solid ${paymentMethod === 'bank' ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '6px', cursor: 'pointer', textAlign: 'center', fontWeight: 600, color: 'var(--ink)' }}>Local Bank Transfer</button>
            </div>
          )}
        </div>

        {paymentMethod && (
          <div style={{ padding: '1rem', background: 'var(--base)', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '1.5rem', fontFamily: 'var(--mono)', fontSize: '0.8125rem', color: 'var(--muted)', lineHeight: 1.6 }}>
            <div style={{ color: 'var(--ink)', fontWeight: 700, marginBottom: '0.25rem' }}>Transfer Instructions</div>
            <div style={{ color: '#E8A33D', fontSize: '0.6875rem', marginBottom: '0.5rem' }}>Update payment details below in BuyTokensModal.tsx</div>
            {currency === 'USDT' && (
              <>
                <p style={{ margin: '0 0 0.5rem' }}>Please send <strong>${usdPrice} USDT</strong> via {paymentMethod === 'binance' ? 'Binance Pay' : 'TRC-20'}.</p>
                <code style={{ display: 'block', padding: '0.5rem', background: '#111', borderRadius: '4px', wordBreak: 'break-all' }}>{paymentMethod === 'binance' ? 'Binance ID: [YOUR_BINANCE_ID]' : 'Wallet: [YOUR_TRC20_WALLET_ADDRESS]'}</code>
              </>
            )}
            {currency === 'MMK' && (
              <>
                <p style={{ margin: '0 0 0.5rem' }}>Please transfer <strong>{mmkPrice} MMK</strong> to our {paymentMethod.toUpperCase()} account.</p>
                <code style={{ display: 'block', padding: '0.5rem', background: '#111', borderRadius: '4px' }}>Acc Name: [YOUR_ACCOUNT_NAME]<br/>Acc No: [YOUR_ACCOUNT_NUMBER]</code>
              </>
            )}
            <p style={{ marginTop: '0.5rem', marginBottom: 0, fontSize: '0.75rem', color: 'var(--accent)' }}>After transferring, click "Submit Order". An admin will verify the transaction and credit your tokens within 24 hours.</p>
          </div>
        )}

        {error && <div style={{ padding: '0.75rem', background: 'color-mix(in srgb, #E8A33D 10%, transparent)', border: '1px solid #E8A33D', borderRadius: '6px', color: '#E8A33D', fontSize: '0.75rem', marginBottom: '1rem' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '0.625rem' }}>
          <button onClick={() => setStep('currency')} style={{ flex: 1, padding: '0.7rem', background: 'transparent', color: 'var(--ink)', border: '1px solid var(--border)', borderRadius: '6px', fontFamily: 'var(--mono)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Back</button>
          <button
            onClick={handleSubmit}
            disabled={paymentMethod === null || loading}
            style={{ flex: 2, padding: '0.7rem', background: paymentMethod === null || loading ? 'var(--surface)' : 'var(--accent)', color: paymentMethod === null || loading ? 'var(--muted)' : 'var(--base)', border: 'none', borderRadius: '6px', fontFamily: 'var(--mono)', fontSize: '0.75rem', fontWeight: 600, cursor: paymentMethod === null || loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Submitting...' : 'Submit Order'}
          </button>
        </div>
      </>
    );
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(8, 9, 10, 0.5)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }} onClick={handleClose}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '2rem', maxWidth: '500px', width: '90%', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 64px rgba(0, 0, 0, 0.6), 0 0 0 1px var(--border)', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
        {success ? (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
            <h3 style={{ fontFamily: 'var(--display)', fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent)', margin: '0 0 0.5rem' }}>Order Submitted!</h3>
            <p style={{ fontFamily: 'var(--body)', fontSize: '0.875rem', color: 'var(--muted)', margin: 0, lineHeight: 1.6 }}>Your purchase request has been submitted. An admin will review the payment and add tokens to your account shortly.</p>
          </div>
        ) : (
          <>
            {step === 'package' && renderPackageSelection()}
            {step === 'currency' && renderCurrencySelection()}
            {step === 'method' && renderMethodSelection()}
          </>
        )}
        <button onClick={handleClose} style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', background: 'none', border: 'none', color: 'var(--muted)', fontSize: '1rem', cursor: 'pointer', padding: '0.25rem', lineHeight: 1, fontFamily: 'var(--mono)' }}>✕</button>
      </div>
    </div>,
    document.body
  );
}
