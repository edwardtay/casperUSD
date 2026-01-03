import { useState, useEffect, useCallback } from 'react'
import { CasperClient, DeployUtil, RuntimeArgs, CLPublicKey, CLValueBuilder } from 'casper-js-sdk'

// Contract hashes - UPDATE AFTER DEPLOYMENT
const CONTRACTS = {
  stcspr: 'hash-0000000000000000000000000000000000000000000000000000000000000000',
  cusd: 'hash-0000000000000000000000000000000000000000000000000000000000000000',
  troveManager: 'hash-0000000000000000000000000000000000000000000000000000000000000000',
  stabilityPool: 'hash-0000000000000000000000000000000000000000000000000000000000000000',
  oracle: 'hash-0000000000000000000000000000000000000000000000000000000000000000',
}

const RPC_URL = 'https://node.testnet.casper.network/rpc'
const CHAIN_NAME = 'casper-test'

function App() {
  const [csprPrice, setCsprPrice] = useState(0.05)
  const [collateral, setCollateral] = useState('')
  const [borrow, setBorrow] = useState('')
  const [interestRate, setInterestRate] = useState('5.0')
  const [wallet, setWallet] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [tab, setTab] = useState<'faucet' | 'borrow' | 'pool'>('faucet')
  const [poolDeposit, setPoolDeposit] = useState('')
  const [txPending, setTxPending] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [balances, setBalances] = useState({ cspr: 0, stcspr: 0, cusd: 0 })

  const STAKING_APY = 10.5
  const MIN_RATIO = 150
  const LIQUIDATION_RATIO = 110
  const DECIMALS = 1_000_000_000

  // Fetch CSPR price
  useEffect(() => {
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=casper-network&vs_currencies=usd')
      .then(res => res.json())
      .then(data => setCsprPrice(data['casper-network']?.usd || 0.05))
      .catch(() => {})
  }, [])

  // Fetch balances when wallet connected
  const fetchBalances = useCallback(async () => {
    if (!wallet) return
    try {
      // Fetch CSPR balance via RPC
      const response = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'query_balance',
          params: {
            purse_identifier: {
              main_purse_under_public_key: wallet
            }
          }
        })
      })
      const data = await response.json()
      if (data.result?.balance) {
        const csprBalance = parseInt(data.result.balance) / DECIMALS
        setBalances(prev => ({ ...prev, cspr: csprBalance }))
      }
    } catch (err) {
      console.error('Failed to fetch balances:', err)
    }
  }, [wallet])

  useEffect(() => {
    if (wallet) fetchBalances()
  }, [wallet, fetchBalances])

  // Connect wallet
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
    setBalances({ cspr: 0, stcspr: 0, cusd: 0 })
  }

  // Sign and send deploy
  const signAndSend = async (deploy: DeployUtil.Deploy): Promise<string> => {
    const casperWallet = (window as any).CasperWalletProvider?.()
    if (!casperWallet) throw new Error('Wallet not connected')

    const deployJson = DeployUtil.deployToJson(deploy)
    const signature = await casperWallet.sign(JSON.stringify(deployJson), wallet)
    
    const signedDeploy = DeployUtil.setSignature(
      deploy,
      signature.signature,
      CLPublicKey.fromHex(wallet!)
    )

    const client = new CasperClient(RPC_URL)
    const result = await client.putDeploy(signedDeploy)
    return result
  }

  // Call stCSPR faucet
  const claimStCSPR = async () => {
    if (!wallet) return
    setTxPending(true)
    setTxHash(null)

    try {
      const client = new CasperClient(RPC_URL)
      const publicKey = CLPublicKey.fromHex(wallet)

      const deploy = DeployUtil.makeDeploy(
        new DeployUtil.DeployParams(publicKey, CHAIN_NAME),
        DeployUtil.ExecutableDeployItem.newStoredContractByHash(
          Uint8Array.from(Buffer.from(CONTRACTS.stcspr.replace('hash-', ''), 'hex')),
          'faucet',
          RuntimeArgs.fromMap({})
        ),
        DeployUtil.standardPayment(3_000_000_000) // 3 CSPR gas
      )

      const hash = await signAndSend(deploy)
      setTxHash(hash)
      
      // Update balance after delay
      setTimeout(() => {
        setBalances(prev => ({ ...prev, stcspr: prev.stcspr + 10000 }))
        fetchBalances()
      }, 30000)

    } catch (err: any) {
      console.error('Faucet failed:', err)
      alert(`Transaction failed: ${err.message || err}`)
    } finally {
      setTxPending(false)
    }
  }

  // Open Trove (deposit collateral + borrow)
  const openTrove = async () => {
    if (!wallet) return
    const collateralAmount = Math.floor(parseFloat(collateral) * DECIMALS)
    const borrowAmount = Math.floor(parseFloat(borrow) * DECIMALS)
    const rate = Math.floor(parseFloat(interestRate) * DECIMALS / 100)

    if (collateralAmount <= 0 || borrowAmount <= 0) {
      alert('Enter valid amounts')
      return
    }

    setTxPending(true)
    setTxHash(null)

    try {
      const publicKey = CLPublicKey.fromHex(wallet)

      // First approve stCSPR spending
      const approveDeploy = DeployUtil.makeDeploy(
        new DeployUtil.DeployParams(publicKey, CHAIN_NAME),
        DeployUtil.ExecutableDeployItem.newStoredContractByHash(
          Uint8Array.from(Buffer.from(CONTRACTS.stcspr.replace('hash-', ''), 'hex')),
          'approve',
          RuntimeArgs.fromMap({
            spender: CLValueBuilder.key(
              CLValueBuilder.byteArray(Buffer.from(CONTRACTS.troveManager.replace('hash-', ''), 'hex'))
            ),
            amount: CLValueBuilder.u64(collateralAmount),
          })
        ),
        DeployUtil.standardPayment(2_000_000_000)
      )

      await signAndSend(approveDeploy)

      // Wait for approval to process
      await new Promise(r => setTimeout(r, 30000))

      // Open trove
      const troveDeploy = DeployUtil.makeDeploy(
        new DeployUtil.DeployParams(publicKey, CHAIN_NAME),
        DeployUtil.ExecutableDeployItem.newStoredContractByHash(
          Uint8Array.from(Buffer.from(CONTRACTS.troveManager.replace('hash-', ''), 'hex')),
          'open_trove',
          RuntimeArgs.fromMap({
            collateral: CLValueBuilder.u64(collateralAmount),
            debt: CLValueBuilder.u64(borrowAmount),
            interest_rate: CLValueBuilder.u64(rate),
          })
        ),
        DeployUtil.standardPayment(5_000_000_000)
      )

      const hash = await signAndSend(troveDeploy)
      setTxHash(hash)

    } catch (err: any) {
      console.error('Open trove failed:', err)
      alert(`Transaction failed: ${err.message || err}`)
    } finally {
      setTxPending(false)
    }
  }

  // Deposit to Stability Pool
  const depositToPool = async () => {
    if (!wallet) return
    const amount = Math.floor(parseFloat(poolDeposit) * DECIMALS)
    if (amount <= 0) {
      alert('Enter valid amount')
      return
    }

    setTxPending(true)
    setTxHash(null)

    try {
      const publicKey = CLPublicKey.fromHex(wallet)

      // Approve cUSD spending
      const approveDeploy = DeployUtil.makeDeploy(
        new DeployUtil.DeployParams(publicKey, CHAIN_NAME),
        DeployUtil.ExecutableDeployItem.newStoredContractByHash(
          Uint8Array.from(Buffer.from(CONTRACTS.cusd.replace('hash-', ''), 'hex')),
          'approve',
          RuntimeArgs.fromMap({
            spender: CLValueBuilder.key(
              CLValueBuilder.byteArray(Buffer.from(CONTRACTS.stabilityPool.replace('hash-', ''), 'hex'))
            ),
            amount: CLValueBuilder.u64(amount),
          })
        ),
        DeployUtil.standardPayment(2_000_000_000)
      )

      await signAndSend(approveDeploy)
      await new Promise(r => setTimeout(r, 30000))

      // Deposit
      const depositDeploy = DeployUtil.makeDeploy(
        new DeployUtil.DeployParams(publicKey, CHAIN_NAME),
        DeployUtil.ExecutableDeployItem.newStoredContractByHash(
          Uint8Array.from(Buffer.from(CONTRACTS.stabilityPool.replace('hash-', ''), 'hex')),
          'deposit',
          RuntimeArgs.fromMap({
            amount: CLValueBuilder.u64(amount),
          })
        ),
        DeployUtil.standardPayment(3_000_000_000)
      )

      const hash = await signAndSend(depositDeploy)
      setTxHash(hash)

    } catch (err: any) {
      console.error('Deposit failed:', err)
      alert(`Transaction failed: ${err.message || err}`)
    } finally {
      setTxPending(false)
    }
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

  const contractsDeployed = !CONTRACTS.stcspr.includes('0000000000')

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

        {/* Balances */}
        {wallet && (
          <div className="bg-slate-800 rounded-lg p-3 mb-4 grid grid-cols-3 gap-2 text-sm">
            <div>
              <span className="text-slate-400">CSPR:</span>{' '}
              <span className="font-mono">{balances.cspr.toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
            </div>
            <div>
              <span className="text-slate-400">stCSPR:</span>{' '}
              <span className="font-mono">{balances.stcspr.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-slate-400">cUSD:</span>{' '}
              <span className="font-mono text-emerald-400">${balances.cusd.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Contract Status Warning */}
        {!contractsDeployed && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4 text-sm">
            <div className="text-amber-400 font-medium mb-1">⏳ Contracts Deploying...</div>
            <p className="text-slate-400 text-xs">
              Testnet deploys can take 5-10 minutes. Check status at{' '}
              <a href="https://testnet.cspr.live/deploy/7a83406d24ab5075ece01f8ef1224b50b7dafe022362e39302890d737e46b8e5" 
                 target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                explorer
              </a>
            </p>
          </div>
        )}

        {/* TX Status */}
        {txHash && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 mb-4 text-sm">
            <div className="text-emerald-400 mb-1">Transaction submitted!</div>
            <a 
              href={`https://testnet.cspr.live/deploy/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline break-all"
            >
              View on explorer: {txHash.slice(0, 16)}...
            </a>
          </div>
        )}

        {/* Value Prop */}
        <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-xl p-4 mb-6">
          <div className="grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <div className="text-slate-400">Staking APY</div>
              <div className="text-emerald-400 font-bold text-lg">{STAKING_APY}%</div>
            </div>
            <div>
              <div className="text-slate-400">Min Ratio</div>
              <div className="font-bold text-lg">{MIN_RATIO}%</div>
            </div>
            <div>
              <div className="text-slate-400">Liquidation</div>
              <div className="text-red-400 font-bold text-lg">{LIQUIDATION_RATIO}%</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {(['faucet', 'borrow', 'pool'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg font-medium transition capitalize ${
                tab === t 
                  ? t === 'faucet' ? 'bg-purple-500' : t === 'borrow' ? 'bg-emerald-500' : 'bg-blue-500'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {t === 'faucet' ? '🚰 Faucet' : t}
            </button>
          ))}
        </div>

        {tab === 'faucet' && (
          <div className="bg-slate-800 rounded-xl p-5 space-y-5">
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold mb-2">Get Testnet Tokens</h2>
            </div>

            <div className="bg-slate-700/50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="bg-purple-500 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">1</span>
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

            <div className="bg-slate-700/50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="bg-emerald-500 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                <span className="font-medium">Get Test stCSPR</span>
              </div>
              <p className="text-sm text-slate-400 mb-3">10,000 stCSPR per claim (1hr cooldown)</p>
              {wallet ? (
                <button
                  onClick={claimStCSPR}
                  disabled={txPending || !contractsDeployed}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg py-2 font-medium transition"
                >
                  {txPending ? 'Submitting...' : 'Claim 10,000 stCSPR'}
                </button>
              ) : (
                <button onClick={connectWallet} disabled={connecting} className="w-full bg-slate-600 hover:bg-slate-500 rounded-lg py-2 font-medium transition">
                  {connecting ? 'Connecting...' : 'Connect Wallet First'}
                </button>
              )}
            </div>

            {wallet && (
              <button onClick={disconnect} className="w-full text-slate-400 text-sm hover:text-white">
                {wallet.slice(0, 8)}...{wallet.slice(-6)} • Disconnect
              </button>
            )}
          </div>
        )}

        {tab === 'borrow' && (
          <div className="bg-slate-800 rounded-xl p-5 space-y-5">
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
                <span>Balance: {balances.stcspr.toLocaleString()}</span>
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
              <p className="text-xs text-slate-500 mt-1">Max: ${maxBorrow}</p>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm text-slate-400">Interest Rate (you set)</label>
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
                <div className="bg-slate-700 px-3 py-1 rounded-lg min-w-[70px] text-center font-mono font-bold">
                  {rateNum}%
                </div>
              </div>
            </div>

            {borrowNum > 0 && (
              <div className="bg-slate-700/50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Collateral Ratio</span>
                  <span className={ratio >= MIN_RATIO ? 'text-emerald-400' : 'text-red-400'}>{ratio.toFixed(0)}%</span>
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
                  <span className="font-medium">Net Yield</span>
                  <span className={netYield >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                    {netYield >= 0 ? '+' : ''}${netYield.toFixed(2)}/yr
                  </span>
                </div>
              </div>
            )}

            {wallet ? (
              <div className="space-y-3">
                <button 
                  onClick={openTrove}
                  disabled={ratio < MIN_RATIO || borrowNum === 0 || txPending || !contractsDeployed}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg py-3 font-medium transition"
                >
                  {txPending ? 'Submitting...' : ratio < MIN_RATIO && borrowNum > 0 ? 'Ratio too low' : 'Open Trove'}
                </button>
                <button onClick={disconnect} className="w-full text-slate-400 text-sm hover:text-white">
                  {wallet.slice(0, 8)}...{wallet.slice(-6)} • Disconnect
                </button>
              </div>
            ) : (
              <button onClick={connectWallet} disabled={connecting} className="w-full bg-emerald-500 hover:bg-emerald-600 rounded-lg py-3 font-medium transition disabled:opacity-50">
                {connecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}
          </div>
        )}

        {tab === 'pool' && (
          <div className="bg-slate-800 rounded-xl p-5 space-y-5">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <h3 className="font-medium mb-2">Earn Real Yield</h3>
              <p className="text-sm text-slate-400">
                Deposit cUSD to absorb liquidations. Earn collateral at discount + protocol interest.
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
              <p className="text-xs text-slate-500 mt-1">Balance: {balances.cusd.toLocaleString()} cUSD</p>
            </div>

            <div className="bg-slate-700/50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Pool TVL</span>
                <span>$0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Est. APY</span>
                <span className="text-emerald-400">~5-15%</span>
              </div>
            </div>

            {wallet ? (
              <button 
                onClick={depositToPool}
                disabled={txPending || !contractsDeployed || !poolDeposit}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg py-3 font-medium transition"
              >
                {txPending ? 'Submitting...' : 'Deposit to Pool'}
              </button>
            ) : (
              <button onClick={connectWallet} disabled={connecting} className="w-full bg-blue-500 hover:bg-blue-600 rounded-lg py-3 font-medium transition disabled:opacity-50">
                {connecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}
          </div>
        )}

        <div className="mt-6 text-xs text-slate-500 text-center">
          <p>Liquity V2 design • User-set rates • TWAP Oracle</p>
        </div>
      </div>
    </div>
  )
}

export default App
