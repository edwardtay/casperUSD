//! CLI tool for CasperUSD smart contracts

use casper_usd::stcspr::StCSPR;
use casper_usd::stablecoin::CasperUSD;
use casper_usd::oracle::PriceOracle;
use casper_usd::trove_manager::TroveManager;
use casper_usd::stability_pool::StabilityPool;
use odra::host::{HostEnv, NoArgs};
use odra_cli::{
    deploy::DeployScript,
    ContractProvider, DeployedContractsContainer, DeployerExt,
    OdraCli, 
};

/// Deploys all CasperUSD contracts
pub struct CasperUSDDeployScript;

impl DeployScript for CasperUSDDeployScript {
    fn deploy(
        &self,
        env: &HostEnv,
        container: &mut DeployedContractsContainer
    ) -> Result<(), odra_cli::deploy::Error> {
        // Deploy stCSPR token
        let _stcspr = StCSPR::load_or_deploy(
            &env,
            NoArgs,
            container,
            100_000_000_000
        )?;

        // Deploy cUSD stablecoin
        let _cusd = CasperUSD::load_or_deploy(
            &env,
            NoArgs,
            container,
            100_000_000_000
        )?;

        // Deploy Oracle
        let _oracle = PriceOracle::load_or_deploy(
            &env,
            NoArgs,
            container,
            100_000_000_000
        )?;

        Ok(())
    }
}

pub fn main() {
    OdraCli::new()
        .about("CLI tool for CasperUSD protocol")
        .deploy(CasperUSDDeployScript)
        .contract::<StCSPR>()
        .contract::<CasperUSD>()
        .contract::<PriceOracle>()
        .build()
        .run();
}
