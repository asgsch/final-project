module.exports = function(deployer, network) {
  console.log("network: " + network);
  deployer.deploy(Migrations);
};
