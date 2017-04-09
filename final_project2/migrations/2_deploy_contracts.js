module.exports = function(deployer) {
  deployer.deploy(FundingHub);
  deployer.deploy(Project, '0xebb086b580796e7770d36e8654eb6bfe11704616', 76, 10);
};
