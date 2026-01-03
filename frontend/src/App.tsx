import { useState, useEffect } from 'react'

function App() {
  const [csprPrice, setCsprPrice] = useState(0.05)
  const [collateral, setCollateral] = useState('')
  const [borrow, setBorrow] = useState('')
  const [interestRate, setInterestRate] = useState('5.0')
  const [wallet, setWallet] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [tab, setTab] = useState<'faucet' | 'borrow' | 'pool'>('faucet')
  const [poolDeposit, setPoolDeposit] = useState('')

  const STAKING_APY = 10.5
  const MIN_RATIO = 150
  const LIQUIDATION_RATIO = 110

  useEffect(() => {
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=casper-network&vs_currencies=usd')
      .then(res => res.json())
      .then(data => setCsprPrice(data['casper-network']?.usd || 0.05))
      .catch(() => {})
  }, [])

  const connectWallet = async () => {
    setConnecting(true)
    try {
      const casperWallet = (window as any).CasperWalletProvider?.()
      if (!casperWallet) {
        window.open('https://www.casperwallet.io/', '_blank')
        alert('Please install Casper Wallet extension')
        return
      }
      const connected = await casperWallet.requestConnection()
      if (connected) {
        const key = await casperWallet.getActivePublicKey()
        setWallet(key)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setConnecting(false)
    }
  }

  const disconnect = () => {
    const casperWallet = (window as any).CasperWalletProvider?.()
    casperWallet?.disconnectFromSite?.()
    setWallet(null)
  }

  const collateralNum = parseFloat(collateral) || 0
  const borrowNum = parseFloat(borrow) || 0
  const rateNum = parseFloat(interestRate) || 5
  const collateralValue = collateralNum * csprPrice
  const maxBorrow = (collateralValue / 1.5).toFixed(2)
  const ratio = borrowNum > 0 ? ((collateralValue / borrowNum) * 100) : 0
  const yearlyInterest = borrowNum * (rateNum / 100)
  const yearlyRewards = collateralNum * (STAKING_APY / 100) * csprPrice
  const netYield = yearlyRewards - yearlyInterest
  const liquidationPrice = borrowNum > 0 ? (borrowNum * LIQUIDATION_RATIO / 100) / collateralNum : 0

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold">CasperUSD</h1>
            <p className="text-slate-400 text-sm">LST-backed stablecoin protocol</p>
          </div>
          <div className="text-right">
            <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded">Testnet</span>
            <div className="text-xs text-slate-500 mt-1">CSPR ${csprPrice.toFixed(4)}</div>
          </div>
        </div>

        {/* Value Prop */}
        <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-xl p-4 mb-6">
          <div className="grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <div className="text-slate-400">Staking APY</div>
              <div className="text-emerald-400 font-bold text-lg">{STAKING_APY}%</div>
              <div className="text-xs text-slate-500">Keep earning</div>
            </div>
            <div>
              <div className="text-slate-400">Min Ratio</div>
              <div className="font-bold text-lg">{MIN_RATIO}%</div>
              <div className="text-xs text-slate-500">Collateral</div>
            </div>
            <div>
              <div className="text-slate-400">Liquidation</div>
              <div className="text-red-400 font-bold text-lg">{LIQUIDATION_RATIO}%</div>
              <div className="text-xs text-slate-500">Threshold</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab('faucet')}
            className={`flex-1 py-2 rounded-lg font-medium transition ${
              tab === 'faucet' ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-400'
            }`}
          >
            🚰 Faucet
          </button>
          <button
            onClick={() => setTab('borrow')}
            className={`flex-1 py-2 rounded-lg font-medium transition ${
              tab === 'borrow' ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400'
            }`}
          >
            Borrow
          </button>
          <button
            onClick={() => setTab('pool')}
            className={`flex-1 py-2 rounded-lg font-medium transition ${
              tab === 'pool' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400'
            }`}
          >
            Pool
          </button>
        </div>

        {tab === 'faucet' ? (
          /* Faucet Tab */
          <div className="bg-slate-800 rounded-xl p-5 space-y-5">
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold mb-2">Get Testnet Tokens</h2>
              <p className="text-sm text-slate-400">You need tokens to test the protocol</p>
            </div>

            {/* Step 1: CSPR */}
            <div className="bg-slate-700/50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="bg-purple-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                <span className="font-medium">Get Testnet CSPR</span>
              </div>
              <p className="text-sm text-slate-400 mb-3">Native gas token for transactions</p>
              <a
                href="https://testnet.cspr.live/tools/faucet"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-purple-500 hover:bg-purple-600 text-center rounded-lg py-2 font-medium transition"
              >
                Open CSPR Faucet ↗
              </a>
            </div>

            {/* Step 2: stCSPR */}
            <div className="bg-slate-700/50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="bg-emerald-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                <span className="font-medium">Get Test stCSPR</span>
              </div>
              <p className="text-sm text-slate-400 mb-3">Liquid staking token used as collateral (10,000 per claim, 1hr cooldown)</p>
              {wallet ? (
                <button
                  className="w-full bg-emerald-500 hover:bg-emerald-600 rounded-lg py-2 font-medium transition"
                  onClick={() => alert('Calling stCSPR.faucet() - Contract interaction coming soon')}
                >
                  Claim 10,000 stCSPR
                </button>
              ) : (
                <button
                  onClick={connectWallet}
                  className="w-full bg-slate-600 hover:bg-slate-500 rounded-lg py-2 font-medium transition"
                >
                  Connect Wallet First
                </button>
              )}
            </div>

            {/* Info */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-sm">
              <p className="text-slate-300 mb-2"><strong>How it works:</strong></p>
              <ol className="text-slate-400 space-y-1 list-decimal list-inside">
                <li>Get testnet CSPR from official faucet</li>
                <li>Claim stCSPR from our faucet contract</li>
                <li>Deposit stCSPR as collateral</li>
                <li>Borrow cUSD stablecoin</li>
              </ol>
            </div>

            {wallet && (
              <div className="text-center">
                <button onClick={disconnect} className="text-slate-400 text-sm hover:text-white">
                  {wallet.slice(0, 8)}...{wallet.slice(-6)} • Disconnect
                </button>
              </div>
            )}
          </div>
        ) : tab === 'borrow' ? (
          <div className="bg-slate-800 rounded-xl p-5 space-y-5">
            {/* Collateral Input */}
            <div>
              <label className="text-sm text-slate-400 block mb-2">Deposit stCSPR Collateral</label>
              <input
                type="number"
                value={collateral}
                onChange={e => setCollateral(e.target.value)}
                placeholder="0"
                className="w-full bg-slate-700 rounded-lg px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>≈ ${collateralValue.toFixed(2)}</span>
                {collateralNum > 0 && (
                  <span className="text-emerald-400">Earns ${yearlyRewards.toFixed(2)}/yr staking</span>
                )}
              </div>
            </div>

            {/* Borrow Input */}
            <div>
              <label className="text-sm text-slate-400 block mb-2">Borrow cUSD</label>
              <input
                type="number"
                value={borrow}
                onChange={e => setBorrow(e.target.value)}
                placeholder="0"
                className="w-full bg-slate-700 rounded-lg px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-xs text-slate-500 mt-1">Max: ${maxBorrow} at {MIN_RATIO}% ratio</p>
            </div>

            {/* Interest Rate - User Set (Liquity V2 style) */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm text-slate-400">Your Interest Rate</label>
                <span className="text-xs text-slate-500">Lower = higher redemption risk</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0.5"
                  max="20"
                  step="0.5"
                  value={interestRate}
                  onChange={e => setInterestRate(e.target.value)}
                  className="flex-1 accent-emerald-500"
                />
                <div className="bg-slate-700 px-3 py-1 rounded-lg min-w-[70px] text-center">
                  <span className="font-mono font-bold">{rateNum}%</span>
                </div>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-emerald-400">0.5% (high risk)</span>
                <span className="text-slate-500">20% (safe)</span>
              </div>
            </div>

            {/* Position Summary */}
            {borrowNum > 0 && (
              <div className="bg-slate-700/50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Collateral Ratio</span>
                  <span className={ratio >= MIN_RATIO ? 'text-emerald-400' : 'text-red-400'}>
                    {ratio.toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Liquidation Price</span>
                  <span className="text-amber-400">${liquidationPrice.toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Yearly Interest</span>
                  <span className="text-red-400">-${yearlyInterest.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Staking Rewards</span>
                  <span className="text-emerald-400">+${yearlyRewards.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-600 pt-2">
                  <span className="text-slate-300 font-medium">Net Yield</span>
                  <span className={netYield >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                    {netYield >= 0 ? '+' : ''}${netYield.toFixed(2)}/yr
                  </span>
                </div>
              </div>
            )}

            {/* Action Button */}
            {wallet ? (
              <div className="space-y-3">
                <button 
                  disabled={ratio < MIN_RATIO || borrowNum === 0}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg py-3 font-medium transition"
                >
                  {ratio < MIN_RATIO && borrowNum > 0 ? 'Ratio too low' : 'Open Trove'}
                </button>
                <button onClick={disconnect} className="w-full text-slate-400 text-sm hover:text-white">
                  {wallet.slice(0, 8)}...{wallet.slice(-6)} • Disconnect
                </button>
              </div>
            ) : (
              <button 
                onClick={connectWallet}
                disabled={connecting}
                className="w-full bg-emerald-500 hover:bg-emerald-600 rounded-lg py-3 font-medium transition disabled:opacity-50"
              >
                {connecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}
          </div>
        ) : (
          <div className="bg-slate-800 rounded-xl p-5 space-y-5">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <h3 className="font-medium mb-2">Earn Real Yield</h3>
              <p className="text-sm text-slate-400">
                Deposit cUSD to absorb liquidations. Earn collateral at ~10% discount + share of protocol interest.
              </p>
            </div>

            <div>
              <label className="text-sm text-slate-400 block mb-2">Deposit cUSD</label>
              <input
                type="number"
                value={poolDeposit}
                onChange={e => setPoolDeposit(e.target.value)}
                placeholder="0"
                className="w-full bg-slate-700 rounded-lg px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="bg-slate-700/50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Pool TVL</span>
                <span>$0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Your Share</span>
                <span>0%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Est. APY</span>
                <span className="text-emerald-400">~5-15%</span>
              </div>
            </div>

            {wallet ? (
              <button className="w-full bg-blue-500 hover:bg-blue-600 rounded-lg py-3 font-medium transition">
                Deposit to Pool
              </button>
            ) : (
              <button 
                onClick={connectWallet}
                disabled={connecting}
                className="w-full bg-blue-500 hover:bg-blue-600 rounded-lg py-3 font-medium transition disabled:opacity-50"
              >
                {connecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}
          </div>
        )}

        {/* Protocol Info */}
        <div className="mt-6 text-xs text-slate-500 text-center space-y-1">
          <p>Based on Liquity V2 design • User-set interest rates • TWAP Oracle</p>
          <p>Contracts deployed on Casper Testnet</p>
        </div>
      </div>
    </div>
  )
}

export default App
