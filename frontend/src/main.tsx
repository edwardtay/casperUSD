import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Note: CSPR.click requires a registered App ID from https://cspr.click/developer
// For MVP demo, we use direct Casper Wallet integration via casper-js-sdk
// Uncomment below to use CSPR.click once you have a registered App ID:
/*
import { ClickProvider } from '@make-software/csprclick-ui'
const clickOptions = {
  appName: 'CasperUSD',
  appId: 'YOUR_REGISTERED_APP_ID', // Get from https://cspr.click/developer
  contentMode: 'iframe' as const,
  providers: ['casper-wallet', 'casper-signer'],
  chainName: 'casper-test' as const,
}
*/

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
