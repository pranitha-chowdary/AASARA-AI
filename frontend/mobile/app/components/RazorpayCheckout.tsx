/**
 * RazorpayCheckout — Opens Razorpay's standard checkout inside a WebView.
 * Works in Expo Go without native modules.
 *
 * Props:
 *  - orderId: Razorpay order ID from create-order
 *  - amount: amount in paise
 *  - keyId: Razorpay key_id
 *  - prefill: { name, email, contact }
 *  - color: theme color
 *  - onSuccess(data: { razorpay_payment_id, razorpay_order_id, razorpay_signature })
 *  - onFailure(error: string)
 *  - onDismiss()
 */
import React, { useRef } from 'react';
import {
  Modal,
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

interface RazorpayCheckoutProps {
  visible: boolean;
  orderId: string;
  amount: number; // in paise
  keyId: string;
  currency?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  color?: string;
  description?: string;
  onSuccess: (data: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  onFailure: (error: string) => void;
  onDismiss: () => void;
}

export default function RazorpayCheckout({
  visible,
  orderId,
  amount,
  keyId,
  currency = 'INR',
  prefill = {},
  color = '#0d9488',
  description = 'Aasara AI Weekly Protection Plan',
  onSuccess,
  onFailure,
  onDismiss,
}: RazorpayCheckoutProps) {
  const webviewRef = useRef<WebView>(null);

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f0fdfa;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .loader {
      text-align: center;
      color: #0d9488;
      font-size: 16px;
      font-weight: 600;
    }
    .spinner {
      width: 40px; height: 40px;
      border: 3px solid #e2e8f0;
      border-top-color: #0d9488;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .error { color: #dc2626; }
  </style>
</head>
<body>
  <div class="loader" id="loader">
    <div class="spinner"></div>
    <p id="status">Loading Razorpay...</p>
  </div>
  <script>
    function loadScript(src) {
      return new Promise(function(resolve, reject) {
        var s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = function() { reject(new Error('Failed to load ' + src)); };
        document.head.appendChild(s);
      });
    }

    function openCheckout() {
      document.getElementById('status').textContent = 'Opening Razorpay Checkout...';
      var options = {
        key: ${JSON.stringify(keyId)},
        amount: ${amount},
        currency: ${JSON.stringify(currency)},
        name: 'Aasara AI',
        description: ${JSON.stringify(description)},
        order_id: ${JSON.stringify(orderId)},
        prefill: {
          name: ${JSON.stringify(prefill.name || '')},
          email: ${JSON.stringify(prefill.email || '')},
          contact: ${JSON.stringify(prefill.contact || '')}
        },
        theme: { color: ${JSON.stringify(color)} },
        handler: function(response) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'PAYMENT_SUCCESS',
            data: response
          }));
        },
        modal: {
          ondismiss: function() {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'PAYMENT_DISMISSED'
            }));
          },
          escape: false,
          confirm_close: true
        }
      };

      try {
        var rzp = new Razorpay(options);
        rzp.on('payment.failed', function(response) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'PAYMENT_FAILED',
            error: response.error ? response.error.description : 'Payment failed'
          }));
        });
        rzp.open();
      } catch(e) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'PAYMENT_FAILED',
          error: e.message || 'Failed to initialize Razorpay'
        }));
      }
    }

    loadScript('https://checkout.razorpay.com/v1/checkout.js')
      .then(openCheckout)
      .catch(function(err) {
        document.getElementById('status').textContent = 'Failed to load payment SDK. Check your internet.';
        document.getElementById('status').className = 'error';
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'PAYMENT_FAILED',
          error: err.message || 'Could not load Razorpay SDK'
        }));
      });
  </script>
</body>
</html>`;

  const handleMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'PAYMENT_SUCCESS') {
        onSuccess(msg.data);
      } else if (msg.type === 'PAYMENT_FAILED') {
        onFailure(msg.error || 'Payment failed');
      } else if (msg.type === 'PAYMENT_DISMISSED') {
        onDismiss();
      }
    } catch {
      // ignore non-JSON messages
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onDismiss}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onDismiss} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#475569" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Razorpay Checkout</Text>
            <Text style={styles.headerAmount}>₹{(amount / 100).toFixed(0)}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* WebView */}
        <WebView
          ref={webviewRef}
          source={{ html: htmlContent, baseUrl: Platform.OS === 'android' ? 'https://checkout.razorpay.com' : undefined }}
          style={styles.webview}
          onMessage={handleMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          javaScriptCanOpenWindowsAutomatically={true}
          setSupportMultipleWindows={false}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#0d9488" />
              <Text style={styles.loadingText}>Loading Razorpay...</Text>
            </View>
          )}
          originWhitelist={['*']}
          mixedContentMode="always"
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('WebView error:', nativeEvent);
            onFailure('Failed to load payment page. Please try again.');
          }}
          onHttpError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('WebView HTTP error:', nativeEvent.statusCode);
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0fdfa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  headerAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0d9488',
  },
  webview: {
    flex: 1,
    backgroundColor: '#f0fdfa',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f0fdfa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
});
