import { useState, useEffect } from 'react'

function App() {
  const [csprPrice, setCsprPrice] = useState(0.05)
  const [collateral, setCollateral] = useState('')
  const [borrow, setBorrow] = useState('')
  const [wallet, setWallet] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  const STAKING_APY = 10.5

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
  const collateralValue = collateralNum * csprPrice
  const maxBorrow = (collateralValue / 1.5).toFixed(2)
  const ratio = borrowNum > 0 ? ((collateralValue / borrowNum) * 100).toFixed(0) : '0'
  const yearlyRewards = collateralNum * (STAKING_APY / 100)
  const yearlyRewardsUsd = yearlyRewards * csprPrice

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold">CasperUSD</h1>
            <p className="text-slate-400 text-sm">Unlock liquidity from your staked CSPR</p>
          </div>
          <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded">Testnet</span>
        </div>

        {/* LST Value Prop */}
        <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-emerald-400">⚡</span>
            <span className="font-medium">Capital Efficiency with LSTs</span>
          </div>
          <p className="text-sm text-slate-300">
            Borrow cUSD against stCSPR — keep earning <span className="text-emerald-400 font-bold">{STAKING_APY}% APY</span> staking rewards while accessing instant liquidity.
          </p>
          <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="text-slate-500">Traditional Unstaking</div>
              <div className="text-red-400">14 day wait + lose rewards</div>
            </div>
            <div>
              <div className="text-slate-500">With CasperUSD</div>
              <div className="text-emerald-400">Instant liquidity + keep APY</div>
            </div>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-slate-800 rounded-xl p-5 space-y-5">
          <div>
            <label className="text-sm text-slate-400 block mb-2">Deposit stCSPR as Collateral</label>
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
                <span className="text-emerald-400">+{yearlyRewards.toFixed(1)} CSPR/yr (${yearlyRewardsUsd.toFixed(2)})</span>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-400 block mb-2">Borrow cUSD</label>
            <input
              type="number"
              value={borrow}
              onChange={e => setBorrow(e.target.value)}
              placeholder="0"
              className="w-full bg-slate-700 rounded-lg px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-xs text-slate-500 mt-1">Max: ${maxBorrow} (150% ratio)</p>
          </div>

          {/* Stats */}
          <div className="bg-slate-700/50 rounded-lg p-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Collateral Ratio</span>
              <span className={parseInt(ratio) >= 150 ? 'text-emerald-400' : parseInt(ratio) > 0 ? 'text-red-400' : 'text-slate-500'}>
                {ratio}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Staking Rewards (continue earning)</span>
              <span className="text-emerald-400">{STAKING_APY}% APY</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Borrow Fee</span>
              <span>0.5%</span>
            </div>
          </div>

          {wallet ? (
            <div className="space-y-3">
              <button className="w-full bg-emerald-500 hover:bg-emerald-600 rounded-lg py-3 font-medium transition">
                Borrow cUSD
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

        {/* Footer Info */}
        <div className="mt-4 text-center text-xs text-slate-500">
          CSPR: ${csprPrice.toFixed(4)} • Min ratio: 150% • Liquidation: 130%
        </div>
      </div>
    </div>
  )
}

export default App
